import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import type { PieceSymbol } from '../core/types';
import { enableFastRaycast } from './raycast';

/**
 * Prozedurale Staunton-Figuren: Drehkörper (Lathe) aus fein gesetzten Profilkurven,
 * Springerkopf als modellierte Extrusion (verjüngtes Maul, Wangen, weich schattiert),
 * Läuferkerbe per CSG-Subtraktion, Krone/Kreuz/Zinnen als Zusatzteile.
 * Pro Figurtyp wird die Geometrie einmal erzeugt, gemergt und von allen Figuren geteilt.
 */

const SEGMENTS = 48;
/** Ziel-Abstand der Profilpunkte – kurze Rundungen bekommen wenige, lange Bögen mehr Punkte */
const PROFILE_STEP = 0.02;

/** Profilpunkte nach Kurvenlänge verteilen (statt jede Teilkurve gleich fein) – spart Dreiecke ohne sichtbaren Verlust. */
function profilePoints(path: THREE.Path): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  for (const curve of path.curves) {
    const isLine = curve instanceof THREE.LineCurve;
    const max = curve instanceof THREE.EllipseCurve ? 18 : 10;
    const n = isLine ? 1 : Math.max(2, Math.min(max, Math.ceil(curve.getLength() / PROFILE_STEP)));
    for (const p of curve.getPoints(n)) {
      const last = points[points.length - 1];
      if (!last || last.distanceTo(p) > 1e-6) points.push(new THREE.Vector2(p.x, p.y));
    }
  }
  return points;
}

function lathe(build: (p: THREE.Path) => void): THREE.BufferGeometry {
  const path = new THREE.Path();
  build(path);
  return new THREE.LatheGeometry(profilePoints(path), SEGMENTS);
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = parts.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(ng.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') ng.deleteAttribute(name);
    }
    ng.clearGroups();
    return ng;
  });
  const merged = mergeGeometries(prepared, false);
  if (!merged) throw new Error('Figurgeometrie konnte nicht erzeugt werden');
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/** Gemeinsamer Sockel: Bodenplatte, gerundete Kante, Zierring. */
function base(p: THREE.Path, r: number, h = 1) {
  p.moveTo(0, 0);
  p.lineTo(r, 0);
  p.lineTo(r, 0.045 * h);
  p.quadraticCurveTo(r + 0.008, 0.075 * h, r - 0.03, 0.088 * h);
  p.lineTo(r - 0.045, 0.094 * h);
  p.quadraticCurveTo(r - 0.015, 0.118 * h, r - 0.06, 0.138 * h);
}

function pawn(): THREE.BufferGeometry {
  return lathe((p) => {
    base(p, 0.27);
    p.quadraticCurveTo(0.13, 0.17, 0.105, 0.31);
    p.lineTo(0.1, 0.335);
    p.quadraticCurveTo(0.19, 0.338, 0.185, 0.36);
    p.quadraticCurveTo(0.18, 0.382, 0.095, 0.388);
    p.absarc(0, 0.49, 0.125, Math.atan2(0.388 - 0.49, 0.095), Math.PI / 2, false);
  });
}

function rook(): THREE.BufferGeometry {
  const body = lathe((p) => {
    base(p, 0.31);
    p.quadraticCurveTo(0.2, 0.16, 0.19, 0.22);
    p.lineTo(0.172, 0.46);
    p.quadraticCurveTo(0.17, 0.5, 0.21, 0.51);
    p.quadraticCurveTo(0.245, 0.52, 0.245, 0.55);
    p.lineTo(0.245, 0.62);
    p.lineTo(0.165, 0.62);
    p.lineTo(0.165, 0.585);
    p.lineTo(0, 0.585);
  });
  const parts = [body];
  const merlons = 6;
  for (let i = 0; i < merlons; i++) {
    const a0 = (i / merlons) * Math.PI * 2 + 0.18;
    const a1 = a0 + (Math.PI * 2) / merlons - 0.36;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 0.245, a0, a1, false);
    shape.absarc(0, 0, 0.165, a1, a0, true);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.07,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.008,
      bevelSegments: 2,
      curveSegments: 8,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.62, 0);
    parts.push(g);
  }
  return merge(parts);
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Formt eine flache Extrusion (Seitenansicht x/y, Dicke z um 0 zentriert) plastisch:
 * Maul und Ohren schmaler, Wangen gewölbt. Danach weiche Normalen für runde Übergänge.
 */
function sculpt(flat: THREE.BufferGeometry, profile: (x: number, y: number) => { scale: number; bulge: number }) {
  // Die Deckflächen einer Extrusion haben nur Randpunkte – erst fein unterteilen, damit sie sich wölben lassen
  // Genug Durchläufe, damit jede Kante geteilt wird – sonst bleiben T-Stöße (fleckige Schattierung)
  const geo = new TessellateModifier(0.045, 24).modify(flat);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const { scale, bulge } = profile(x, y);
    pos.setZ(i, z * scale + Math.sign(z) * bulge);
  }
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const welded = mergeVertices(geo, 1e-5);
  welded.computeVertexNormals();
  welded.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(welded.attributes.position.count * 2), 2));
  return welded;
}

/** Plastik des Pferdekopfes in Profilkoordinaten (x = Blickrichtung, y = Höhe über dem Sockel) */
function headProfile(x: number, y: number) {
  let scale = 1;
  scale *= 1 - 0.36 * smoothstep(0.07, 0.23, x); // Maul schmal
  scale *= 1 - 0.22 * smoothstep(0.42, 0.6, y); // Ohren schmal
  scale *= 1 - 0.12 * smoothstep(-0.05, -0.19, x); // Nacken etwas schlanker
  const cheek = Math.hypot((x - 0.05) / 0.13, (y - 0.29) / 0.11);
  const bulge = 0.032 * Math.max(0, 1 - cheek) ** 2; // Wangenknochen
  return { scale, bulge };
}

function knight(): THREE.BufferGeometry {
  const plinth = lathe((p) => {
    base(p, 0.3);
    p.quadraticCurveTo(0.21, 0.155, 0.215, 0.18);
    p.lineTo(0.2, 0.19);
    p.lineTo(0, 0.19);
  });

  // Seitenansicht des Pferdekopfes (x = Blickrichtung, y = oben)
  const s = new THREE.Shape();
  s.moveTo(-0.15, 0);
  s.bezierCurveTo(-0.14, 0.09, -0.2, 0.16, -0.19, 0.25); // Hals hinten
  s.bezierCurveTo(-0.18, 0.35, -0.14, 0.42, -0.09, 0.47); // Hinterkopf
  s.lineTo(-0.06, 0.53);
  s.quadraticCurveTo(-0.035, 0.6, -0.02, 0.6); // Ohrspitze
  s.quadraticCurveTo(0.0, 0.56, 0.005, 0.51);
  s.bezierCurveTo(0.04, 0.5, 0.075, 0.47, 0.1, 0.43); // Stirn
  s.bezierCurveTo(0.14, 0.37, 0.19, 0.31, 0.215, 0.25); // Nasenrücken
  s.bezierCurveTo(0.232, 0.222, 0.233, 0.2, 0.222, 0.19); // Nüstern
  s.lineTo(0.172, 0.187); // Maulspalte
  s.lineTo(0.204, 0.171); // Unterlippe
  s.bezierCurveTo(0.2, 0.152, 0.16, 0.148, 0.12, 0.168); // Kinn
  s.bezierCurveTo(0.09, 0.185, 0.055, 0.21, 0.03, 0.205); // Ganasche
  s.bezierCurveTo(0.0, 0.17, 0.06, 0.1, 0.11, 0.05); // Kehle, Brust
  s.lineTo(0.13, 0);
  s.closePath();

  const depth = 0.15;
  const bevel = 0.04;
  const rawHead = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: 0.028,
    bevelSegments: 4,
    curveSegments: 16,
  });
  rawHead.translate(0, 0, -depth / 2);
  const head = sculpt(rawHead, headProfile);
  head.translate(-0.01, 0.175, 0);

  // Mähne: schmaler Kamm entlang des Nackens
  const m = new THREE.Shape();
  m.moveTo(-0.13, 0.05);
  m.bezierCurveTo(-0.17, 0.15, -0.2, 0.22, -0.2, 0.28);
  m.bezierCurveTo(-0.19, 0.37, -0.15, 0.43, -0.1, 0.47);
  m.lineTo(-0.08, 0.44);
  m.bezierCurveTo(-0.13, 0.38, -0.16, 0.32, -0.165, 0.26);
  m.bezierCurveTo(-0.16, 0.18, -0.13, 0.12, -0.1, 0.06);
  m.closePath();
  const maneDepth = 0.05;
  const rawMane = new THREE.ExtrudeGeometry(m, {
    depth: maneDepth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 10,
  });
  rawMane.translate(-0.012, 0, -maneDepth / 2);
  const mane = sculpt(rawMane, () => ({ scale: 1, bulge: 0 }));
  mane.translate(0, 0.175, 0);

  // Augen sitzen auf der modellierten Oberfläche
  const eyeX = 0.065;
  const eyeY = 0.405;
  const eyeProfile = headProfile(eyeX, eyeY);
  const eyeZ = (depth / 2 + bevel) * eyeProfile.scale + eyeProfile.bulge - 0.004;
  const eyes = [-1, 1].map((side) => {
    const e = new THREE.SphereGeometry(0.021, 14, 10);
    e.scale(1, 0.8, 0.5);
    e.translate(eyeX - 0.01, 0.175 + eyeY, side * eyeZ);
    return e;
  });

  // Nüstern als kleine Wülste
  const nostrils = [-1, 1].map((side) => {
    const n = new THREE.SphereGeometry(0.014, 10, 8);
    n.scale(1, 0.7, 0.5);
    const np = headProfile(0.205, 0.215);
    n.translate(0.195, 0.175 + 0.215, side * ((depth / 2 + bevel) * np.scale - 0.004));
    return n;
  });

  return merge([plinth, head, mane, ...eyes, ...nostrils]);
}

function bishop(): THREE.BufferGeometry {
  const body = lathe((p) => {
    base(p, 0.29);
    p.quadraticCurveTo(0.145, 0.18, 0.11, 0.43);
    p.lineTo(0.105, 0.475);
    p.quadraticCurveTo(0.2, 0.478, 0.19, 0.505);
    p.quadraticCurveTo(0.18, 0.525, 0.115, 0.53);
    p.quadraticCurveTo(0.165, 0.537, 0.16, 0.555);
    p.quadraticCurveTo(0.155, 0.57, 0.105, 0.575);
    p.bezierCurveTo(0.17, 0.62, 0.165, 0.71, 0.08, 0.78);
    p.quadraticCurveTo(0.05, 0.8, 0.032, 0.802);
    p.absarc(0, 0.84, 0.042, Math.atan2(0.802 - 0.84, 0.032), Math.PI / 2, false);
  });
  return merge([cutMitre(body)]);
}

/**
 * Die typische Läuferkerbe: ein schräger Schlitz von der rechten Seite bis knapp über die Mitte,
 * durch die ganze Tiefe der Mitra – per CSG aus dem Drehkörper herausgeschnitten.
 */
export const BISHOP_SLOT = { centerX: 0.1, centerY: 0.7, length: 0.2, width: 0.03, angle: -0.62 };

function cutMitre(body: THREE.BufferGeometry): THREE.BufferGeometry {
  const slot = new THREE.BoxGeometry(BISHOP_SLOT.length, BISHOP_SLOT.width, 0.6);
  const target = new Brush(body);
  const cutter = new Brush(slot);
  cutter.rotation.z = BISHOP_SLOT.angle;
  cutter.position.set(BISHOP_SLOT.centerX, BISHOP_SLOT.centerY, 0);
  cutter.updateMatrixWorld();
  target.updateMatrixWorld();
  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  return evaluator.evaluate(target, cutter, SUBTRACTION).geometry;
}

function queen(): THREE.BufferGeometry {
  const body = lathe((p) => {
    base(p, 0.33, 1.1);
    p.quadraticCurveTo(0.16, 0.2, 0.125, 0.56);
    p.lineTo(0.118, 0.63);
    p.quadraticCurveTo(0.215, 0.633, 0.205, 0.66);
    p.quadraticCurveTo(0.195, 0.682, 0.125, 0.687);
    p.quadraticCurveTo(0.19, 0.695, 0.183, 0.715);
    p.quadraticCurveTo(0.176, 0.73, 0.12, 0.735);
    p.quadraticCurveTo(0.17, 0.79, 0.228, 0.87);
    p.lineTo(0.215, 0.885);
    p.quadraticCurveTo(0.15, 0.885, 0.13, 0.9);
    p.quadraticCurveTo(0.07, 0.96, 0, 0.965);
  });
  const parts = [body];
  const spikes = 9;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const g = new THREE.SphereGeometry(0.03, 10, 7);
    g.translate(Math.cos(a) * 0.205, 0.9, Math.sin(a) * 0.205);
    parts.push(g);
  }
  const top = new THREE.SphereGeometry(0.055, 16, 10);
  top.translate(0, 1.0, 0);
  parts.push(top);
  return merge(parts);
}

function king(): THREE.BufferGeometry {
  const body = lathe((p) => {
    base(p, 0.34, 1.12);
    p.quadraticCurveTo(0.165, 0.21, 0.13, 0.6);
    p.lineTo(0.123, 0.67);
    p.quadraticCurveTo(0.225, 0.673, 0.215, 0.7);
    p.quadraticCurveTo(0.205, 0.722, 0.13, 0.727);
    p.quadraticCurveTo(0.2, 0.735, 0.193, 0.755);
    p.quadraticCurveTo(0.186, 0.77, 0.125, 0.775);
    p.quadraticCurveTo(0.16, 0.83, 0.205, 0.89);
    p.lineTo(0.195, 0.905);
    p.quadraticCurveTo(0.12, 0.915, 0.1, 0.93);
    p.quadraticCurveTo(0.05, 0.96, 0, 0.962);
  });
  const vertical = new RoundedBoxGeometry(0.065, 0.24, 0.065, 3, 0.018);
  vertical.translate(0, 1.06, 0);
  const horizontal = new RoundedBoxGeometry(0.18, 0.06, 0.065, 3, 0.018);
  horizontal.translate(0, 1.1, 0);
  return merge([body, vertical, horizontal]);
}

const builders: Record<PieceSymbol, () => THREE.BufferGeometry> = {
  p: pawn,
  r: rook,
  n: knight,
  b: bishop,
  q: queen,
  k: king,
};

const cache = new Map<PieceSymbol, THREE.BufferGeometry>();

export function getPieceGeometry(type: PieceSymbol): THREE.BufferGeometry {
  let g = cache.get(type);
  if (!g) {
    g = builders[type]();
    if (g.index) g = g.toNonIndexed(); // einheitlich: alle Figuren nicht-indiziert (Bauer ist ein reiner Drehkörper)
    g.computeBoundingBox();
    g.computeBoundingSphere();
    enableFastRaycast(g);
    cache.set(type, g);
  }
  return g;
}

/** Zierring am Sockel (Kontrastfarbe), Radius je Figur */
const ACCENT_RADIUS: Record<PieceSymbol, number> = { p: 0.212, r: 0.252, n: 0.242, b: 0.232, q: 0.272, k: 0.282 };
const accentCache = new Map<PieceSymbol, THREE.BufferGeometry>();

export function getAccentGeometry(type: PieceSymbol): THREE.BufferGeometry {
  let g = accentCache.get(type);
  if (!g) {
    g = new THREE.TorusGeometry(ACCENT_RADIUS[type], 0.012, 6, 56);
    g.rotateX(Math.PI / 2);
    const y = type === 'q' ? 0.142 : type === 'k' ? 0.145 : 0.13;
    g.translate(0, y, 0);
    accentCache.set(type, g);
  }
  return g;
}

export const PIECE_HEIGHT: Record<PieceSymbol, number> = { p: 0.62, r: 0.71, n: 0.79, b: 0.88, q: 1.06, k: 1.13 };
