import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PieceSymbol } from '../core/types';

/**
 * Prozedurale Staunton-Figuren: Drehkörper (Lathe) aus fein gesetzten Profilkurven,
 * Springerkopf als gefaste Extrusion, Krone/Kreuz/Zinnen als Zusatzteile.
 * Pro Figurtyp wird die Geometrie einmal erzeugt, gemergt und von allen Figuren geteilt.
 */

const SEGMENTS = 64;

function lathe(build: (p: THREE.Path) => void, divisions = 12): THREE.BufferGeometry {
  const path = new THREE.Path();
  build(path);
  return new THREE.LatheGeometry(path.getPoints(divisions), SEGMENTS);
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
  s.bezierCurveTo(-0.14, 0.09, -0.2, 0.16, -0.19, 0.25);
  s.bezierCurveTo(-0.18, 0.35, -0.14, 0.42, -0.09, 0.47);
  s.lineTo(-0.06, 0.53);
  s.quadraticCurveTo(-0.035, 0.6, -0.02, 0.6);
  s.quadraticCurveTo(0.0, 0.56, 0.005, 0.51);
  s.bezierCurveTo(0.04, 0.5, 0.075, 0.47, 0.1, 0.43);
  s.bezierCurveTo(0.14, 0.37, 0.19, 0.31, 0.215, 0.25);
  s.bezierCurveTo(0.235, 0.21, 0.225, 0.17, 0.195, 0.16);
  s.bezierCurveTo(0.17, 0.15, 0.13, 0.155, 0.1, 0.175);
  s.bezierCurveTo(0.075, 0.19, 0.05, 0.21, 0.03, 0.205);
  s.bezierCurveTo(0.0, 0.17, 0.06, 0.1, 0.11, 0.05);
  s.lineTo(0.13, 0);
  s.closePath();

  const depth = 0.15;
  const head = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.028,
    bevelSegments: 5,
    curveSegments: 24,
  });
  head.translate(-0.01, 0.175, -depth / 2);

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
  const mane = new THREE.ExtrudeGeometry(m, {
    depth: maneDepth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.012,
    bevelSegments: 3,
    curveSegments: 16,
  });
  mane.translate(-0.012, 0.175, -maneDepth / 2);

  // Augen als kleine Halbkugeln auf beiden Seiten
  const eyes = [-1, 1].map((side) => {
    const e = new THREE.SphereGeometry(0.022, 12, 8);
    e.scale(1, 0.8, 0.5);
    e.translate(0.06, 0.175 + 0.4, side * (depth / 2 + 0.038));
    return e;
  });

  return merge([plinth, head, mane, ...eyes]);
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
  // Angedeutete Mitra-Kerbe: schräger, dünner Steg
  const notch = new RoundedBoxGeometry(0.2, 0.022, 0.03, 2, 0.008);
  notch.rotateZ(-0.75);
  notch.translate(0.035, 0.705, 0);
  return merge([body, notch]);
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
    const g = new THREE.SphereGeometry(0.03, 14, 10);
    g.translate(Math.cos(a) * 0.205, 0.9, Math.sin(a) * 0.205);
    parts.push(g);
  }
  const top = new THREE.SphereGeometry(0.055, 20, 14);
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
    g = new THREE.TorusGeometry(ACCENT_RADIUS[type], 0.012, 10, 72);
    g.rotateX(Math.PI / 2);
    const y = type === 'q' ? 0.142 : type === 'k' ? 0.145 : 0.13;
    g.translate(0, y, 0);
    accentCache.set(type, g);
  }
  return g;
}

export const PIECE_HEIGHT: Record<PieceSymbol, number> = { p: 0.62, r: 0.71, n: 0.79, b: 0.88, q: 1.06, k: 1.13 };
