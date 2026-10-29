import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { TrackedPiece } from '../core/pieceTracking';
import type { Color, MoveRecord, PieceSymbol, Square } from '../core/types';
import { gameStore, useGame } from '../game/instance';
import { canHumanInteract, displayPly } from '../game/store';
import { battleRuntime } from './Battle';
import { squareToWorld } from './boardMath';
import { ATTACK_IMPACT, KNOCK_TOTAL, knockPose, moveDuration, movePose, type MoveProfile, type Pose } from './choreography';
import { Burst } from './Effects';
import { emitImpact } from './ImpactFX';
import { beginDrag, clickSuppressed, pointerDrag } from './interaction';
import { getMaterials, getModelMaterials } from './materials';
import { getAccentGeometry, getPieceGeometry } from './pieceGeometry';
import { useModelPieces } from './pieceModels';
import { useRealAssets } from './realAssets';
import { addRim, copyRim, PIECE_RIM } from './rim';
import { warriorsReady } from './warriors';

/** Springer schauen zum Gegner, leicht gedreht, damit das Profil aus Spielersicht erkennbar bleibt. */
const KNIGHT_YAW = 0.75;

function pieceYaw(piece: TrackedPiece): number {
  if (piece.type !== 'n') return 0;
  return piece.color === 'w' ? Math.PI / 2 + KNIGHT_YAW : -Math.PI / 2 + KNIGHT_YAW;
}

/**
 * Steht eine Figur im Kriegerkampf zwischen Kamera und Kämpfern? Dann taucht sie kurz weg, damit sie nicht die
 * Sicht verdeckt (die Kamera fliegt dafür nah über das Brett).
 */
const probe = new THREE.Vector3();
const fightPoint = new THREE.Vector3();

function blocksBattleView(camera: THREE.Camera, x: number, z: number): boolean {
  const battle = gameStore.getState().battle;
  if (!battle) return false;
  // Nur wenn die Kamera nah über dem Brett filmt – in der Draufsicht (vor und nach dem Kampf) bleibt alles stehen
  if (camera.position.y > 5) return false;
  const [mx, mz] = squareToWorld(battle.victimSquare);
  const [fx, fz] = squareToWorld(battle.from);
  // Kampfplatz: zwischen Opfer und Startfeld, nahe am Opfer
  fightPoint.set(mx * 0.75 + fx * 0.25, 0.6, mz * 0.75 + fz * 0.25);
  // Die Kämpfer selbst brauchen Platz: Figuren direkt auf ihren Feldern bleiben stehen (sie sind schon weg)
  const fightDepth = camera.position.distanceTo(fightPoint);
  // Figur (Mitte und Kopf) im Bild – vor den Kämpfern oder dicht dahinter? Fernere bleiben als Kulisse stehen
  for (const y of [0.3, 0.9]) {
    probe.set(x, y, z);
    const depth = camera.position.distanceTo(probe);
    if (depth > fightDepth + 0.9) continue;
    probe.project(camera);
    if (probe.z < 1 && Math.abs(probe.x) < 1.15 && Math.abs(probe.y) < 1.15) return true;
  }
  return false;
}

function setPointer(active: boolean) {
  document.body.style.cursor = active ? 'pointer' : '';
}

// Wiederverwendete Hilfsobjekte (keine Speicherlast pro Bild)
const tiltAxis = new THREE.Vector3();
const qTilt = new THREE.Quaternion();
const qTopple = new THREE.Quaternion();
const qView = new THREE.Quaternion();
const X_AXIS = new THREE.Vector3(1, 0, 0);

/** Ansicht von oben: Figuren um ihren Fuß zum Spieler neigen, damit man ihre Form sieht */
export const TOP_VIEW_TILT = 1.0;
/** Gegenüber-Modus: flachere Neigung, damit die Figuren für beide Spieler ordentlich aussehen und sich weniger überdecken */
export const FACE_TO_FACE_TILT = 0.5;
export const TOP_VIEW_SCALE = 1.08;
const noRaycast = () => null;

/** Neigt eine Figur um ihren Fußpunkt in Richtung (dirX, dirZ); positiv = Kopf nach vorn. */
function tiltQuaternion(target: THREE.Quaternion, dirX: number, dirZ: number, angle: number) {
  const len = Math.hypot(dirX, dirZ) || 1;
  tiltAxis.set(dirZ / len, 0, -dirX / len); // oben × Richtung
  return target.setFromAxisAngle(tiltAxis, angle);
}

/** Aussehen der Figuren: Geometrien und Materialien des gewählten Stils */
interface PieceLook {
  geometry: (type: PieceSymbol) => THREE.BufferGeometry;
  /** Zierring am Fuß (null = keiner, z. B. bei echten Marmorfiguren) */
  accent: ((type: PieceSymbol) => THREE.BufferGeometry) | null;
  material: Record<Color, THREE.MeshPhysicalMaterial>;
}

function usePieceLook(): PieceLook {
  const style = useGame((s) => s.prefs.pieceStyle);
  const theme = style === 'rebell' ? 'rebell' : 'classic';
  const model = useModelPieces(style !== 'rebell');
  const real = useRealAssets(style === 'real');
  return useMemo(() => {
    const withRim = (look: PieceLook): PieceLook => {
      for (const c of ['w', 'b'] as const) {
        const m = look.material[c];
        if (!rimmed.has(m)) {
          rimmed.add(m);
          addRim(m, PIECE_RIM[c]);
        }
      }
      return look;
    };
    if (model && real) return withRim({ geometry: (t) => model.geometries[t], accent: null, material: real.pieces });
    if (model) {
      return withRim({
        geometry: (t) => model.geometries[t],
        accent: (t) => model.accents[t],
        material: getModelMaterials(model.ao, theme),
      });
    }
    return withRim({ geometry: getPieceGeometry, accent: getAccentGeometry, material: getMaterials(theme).piece });
  }, [model, real, theme]);
}

/** Materialien, die den Randsaum schon haben */
const rimmed = new WeakSet<THREE.Material>();

interface PieceProps {
  piece: TrackedPiece;
  lifted: boolean;
  interactive: boolean;
  look: PieceLook;
  /** Feld, auf dem die Figur gezeigt wird (bei offener Umwandlungsauswahl schon das Zielfeld) */
  displaySquare: Square;
  /** Bewegungsablauf, falls sich das Feld gerade ändert */
  profile: MoveProfile;
  /** König steht im Schach */
  inCheck: boolean;
  /** König ist mattgesetzt */
  mated: boolean;
  /** Neigung zum Spieler (Ansicht von oben), um die x-Achse; 0 = stehend */
  viewTilt: number;
  /** Größe (Ansicht von oben etwas kleiner, damit sich geneigte Figuren weniger überdecken) */
  viewScale: number;
  /** Figur selbst anklickbar (3D-Ansicht); von oben zählt nur das Feld */
  pickable: boolean;
  /** Kämpft gerade als Krieger – erscheint erst bei der Rückverwandlung wieder */
  hidden: boolean;
}

function Piece({ piece, lifted, interactive, look, displaySquare, profile, inCheck, mated, viewTilt, viewScale, pickable, hidden }: PieceProps) {
  const group = useRef<THREE.Group>(null!);
  const selectSquare = useGame((s) => s.selectSquare);
  const [x, z] = squareToWorld(displaySquare);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const anim = useRef({
    fromX: x,
    fromZ: z,
    toX: x,
    toZ: z,
    profile: 'glide' as MoveProfile,
    /** Startzeit (Uhr der Szene); -1 = beim nächsten Bild starten, null = keine Bewegung */
    start: null as number | null,
    lift: 0,
    scale: 0,
    pop: 0,
    wasDragged: false,
    trembleStart: -10,
    mateStart: -10,
    topple: 0,
    viewTilt: viewTilt,
    viewScale: viewScale,
    wasHidden: false,
    /** 1 = taucht weg, weil die Figur im Kampf zwischen Kamera und Kriegern steht */
    duck: 0,
  });

  useLayoutEffect(() => {
    group.current.position.set(x, 0, z);
    group.current.scale.setScalar(0.001);
  }, []); // nur beim ersten Einhängen

  useEffect(() => {
    const a = anim.current;
    const g = group.current;
    if (Math.hypot(g.position.x - x, g.position.z - z) < 1e-3) return;
    a.fromX = g.position.x;
    a.fromZ = g.position.z;
    a.toX = x;
    a.toZ = z;
    a.profile = profileRef.current;
    a.start = -1;
  }, [x, z]);

  const firstType = useRef(piece.type);
  useEffect(() => {
    if (piece.type !== firstType.current) anim.current.pop = 1;
    firstType.current = piece.type;
  }, [piece.type]);

  useEffect(() => {
    if (inCheck) anim.current.trembleStart = -1;
  }, [inCheck]);
  useEffect(() => {
    if (mated) anim.current.mateStart = -1;
  }, [mated]);

  useFrame((state, frameDt) => {
    const a = anim.current;
    const g = group.current;
    const now = state.clock.elapsedTime;
    // Ein einziger ungültiger Zeitschritt (Tab im Hintergrund, Sprung der Uhr) darf keinen Wert dauerhaft zerstören
    const dt = Number.isFinite(frameDt) ? Math.min(Math.max(frameDt, 0), 0.1) : 0;
    for (const k of ['scale', 'pop', 'duck', 'lift', 'topple', 'viewTilt', 'viewScale'] as const) {
      if (!Number.isFinite(a[k])) a[k] = k === 'scale' || k === 'viewScale' ? 1 : 0;
    }
    const dragged = pointerDrag.active && pointerDrag.pieceId === piece.id;
    if (dragged) {
      // Figur folgt dem Zeiger (leicht gedämpft), schwebt über dem Brett
      g.position.x = THREE.MathUtils.damp(g.position.x, pointerDrag.x, 28, dt);
      g.position.z = THREE.MathUtils.damp(g.position.z, pointerDrag.z, 28, dt);
      g.position.y = THREE.MathUtils.damp(g.position.y, 0.42, 18, dt);
      g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, 1.08 * a.viewScale, 14, dt));
      g.quaternion.setFromAxisAngle(X_AXIS, a.viewTilt * 0.6);
      a.wasDragged = true;
      return;
    }
    if (a.wasDragged) {
      // Losgelassen: vom aktuellen Punkt zum (neuen oder alten) Feld; beim Schlagen mit Angriff
      a.wasDragged = false;
      a.fromX = g.position.x;
      a.fromZ = g.position.z;
      a.toX = x;
      a.toZ = z;
      a.profile = Math.hypot(a.fromX - x, a.fromZ - z) > 0.3 ? profileRef.current : 'glide';
      a.start = -1;
      a.lift = 0;
    }
    if (hidden && !battleRuntime.reveal) {
      // Kampf läuft: Figur steht unsichtbar auf dem Zielfeld bereit
      a.start = null;
      a.scale = 0;
      a.lift = 0;
      a.wasHidden = true;
      g.position.set(x, 0, z);
      g.scale.setScalar(0.001);
      return;
    }
    if (a.wasHidden) {
      a.wasHidden = false;
      a.fromX = a.toX = x;
      a.fromZ = a.toZ = z;
      a.pop = 0.6;
    }
    if (a.start === -1) a.start = now;
    if (a.trembleStart === -1) a.trembleStart = now;
    if (a.mateStart === -1) a.mateStart = now;

    let pose: Pose = { x: a.toX, z: a.toZ, y: 0, tilt: 0, squash: 1 };
    if (a.start !== null) {
      const t = now - a.start;
      pose = movePose(a.profile, a.fromX, a.fromZ, a.toX, a.toZ, t);
      if (t > moveDuration(a.profile, Math.hypot(a.toX - a.fromX, a.toZ - a.fromZ))) a.start = null;
    }
    const dirX = a.toX - a.fromX;
    const dirZ = a.toZ - a.fromZ;

    // Auswahl: schweben mit leichtem Wiegen
    a.lift = THREE.MathUtils.damp(a.lift, lifted ? 0.17 + Math.sin(now * 3.2) * 0.035 : 0, 12, dt);
    // Schach: König zittert kurz
    const tt = now - a.trembleStart;
    const tremble = inCheck && tt < 1.1 ? Math.sin(tt * 42) * 0.075 * Math.exp(-tt * 2.5) : 0;
    // Matt: König kippt um, nachdem der Mattzug gelandet ist
    a.topple = THREE.MathUtils.damp(a.topple, mated && now - a.mateStart > 0.85 ? 1 : 0, 3.2, dt);

    g.position.set(pose.x, pose.y + a.lift + a.topple * 0.26, pose.z);
    tiltQuaternion(qTilt, dirX || 0.001, dirZ || 1, pose.tilt + tremble);
    // Umkippen leicht übertrieben, dann zurückfedern (Werte > 1 nach dem Dämpfen gibt es nicht – Bogen über sin)
    const fall = a.topple * 1.5 + Math.sin(a.topple * Math.PI) * 0.12;
    qTopple.setFromAxisAngle(X_AXIS, piece.color === 'w' ? fall : -fall);
    // Neigung zum Spieler weich nachführen (das Brett dreht sich bei zwei Spielern)
    a.viewTilt = THREE.MathUtils.damp(a.viewTilt, viewTilt, 6, dt);
    a.viewScale = THREE.MathUtils.damp(a.viewScale, viewScale, 6, dt);
    qView.setFromAxisAngle(X_AXIS, a.viewTilt * (1 - a.topple));
    g.quaternion.copy(qView).multiply(qTilt).multiply(qTopple);

    a.scale = THREE.MathUtils.damp(a.scale, 1, 9, dt);
    a.pop = THREE.MathUtils.damp(a.pop, 0, 5, dt);
    a.duck = THREE.MathUtils.damp(a.duck, blocksBattleView(state.camera, pose.x, pose.z) ? 1 : 0, 14, dt);
    const s = Math.max(0.001, a.scale * (1 + a.pop * 0.3) * a.viewScale * (1 - a.duck));
    const wide = 1 / Math.sqrt(pose.squash);
    g.scale.set(s * wide, s * pose.squash, s * wide);
  });

  const mats = getMaterials(useGame((s) => (s.prefs.pieceStyle === 'rebell' ? 'rebell' : 'classic')));
  const yaw = pieceYaw(piece);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8 || clickSuppressed()) return;
    e.stopPropagation();
    selectSquare(piece.square);
  };

  // Ziehen vorbereiten (3D-Ansicht; von oben startet das Ziehen über das Feld)
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    beginDrag(piece.id, piece.square, e.pointerId, e.nativeEvent.clientX, e.nativeEvent.clientY, x, z);
  };

  return (
    <group
      ref={group}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (interactive) setPointer(true);
      }}
      onPointerOut={() => setPointer(false)}
    >
      <group rotation-y={yaw}>
        <mesh
          geometry={look.geometry(piece.type)}
          material={look.material[piece.color]}
          castShadow
          receiveShadow
          raycast={pickable ? undefined : noRaycast}
        />
        {look.accent && <mesh geometry={look.accent(piece.type)} material={mats.accent[piece.color]} raycast={noRaycast} />}
      </group>
    </group>
  );
}

const SHARDS = 24;
let shardGeometry: THREE.BufferGeometry | null = null;

/**
 * Geschlagene Figur. Mit Kampf-Animation: wartet auf den Einschlag, wird zurückgeschleudert,
 * überschlägt sich, zerspringt in Splitter und verblasst. Ohne: versinkt mit Funken.
 */
function Ghost({
  piece,
  onDone,
  look,
  battle,
  viewTilt,
  viewScale,
}: {
  piece: TrackedPiece;
  onDone: () => void;
  look: PieceLook;
  viewTilt: number;
  viewScale: number;
  /** Schlagrichtung (vom Angreifer weg) – null = einfaches Verschwinden */
  battle: { dirX: number; dirZ: number } | null;
}) {
  const group = useRef<THREE.Group>(null!);
  const shards = useRef<THREE.Group>(null!);
  const [x, z] = squareToWorld(piece.square);
  const material = useMemo(() => {
    const m = look.material[piece.color].clone();
    m.transparent = true;
    copyRim(look.material[piece.color], m);
    return m;
  }, [piece.color, look]);
  shardGeometry ??= new THREE.TetrahedronGeometry(0.075);
  const shardState = useMemo(
    () =>
      Array.from({ length: SHARDS }, () => {
        const a = Math.random() * Math.PI * 2;
        const out = 0.8 + Math.random() * 1.6;
        return {
          vx: Math.cos(a) * out + (battle?.dirX ?? 0) * (1.2 + Math.random() * 1.8),
          vy: 1.8 + Math.random() * 2.6,
          vz: Math.sin(a) * out + (battle?.dirZ ?? 0) * (1.2 + Math.random() * 1.8),
          y0: 0.2 + Math.random() * 0.7,
          spin: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12),
          size: 0.6 + Math.random() * 0.9,
        };
      }),
    [battle],
  );
  const t = useRef(0);
  const [hit, setHit] = useState(false);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    t.current += dt;
    const g = group.current;
    if (!battle) {
      const k = Math.min(1, t.current / 0.6);
      g.position.y = -k * 0.25 + Math.sin(k * Math.PI) * 0.12;
      g.scale.setScalar(1 - k * 0.55);
      g.rotation.y = k * 1.4;
      material.opacity = 1 - k;
      if (t.current > 1.1) onDone();
      return;
    }
    const len = Math.hypot(battle.dirX, battle.dirZ) || 1;
    const dx = battle.dirX / len;
    const dz = battle.dirZ / len;
    const k = knockPose(dx, dz, t.current);
    g.position.set(k.dx, k.y, k.dz);
    tiltQuaternion(g.quaternion, dx, dz, k.spin);
    material.opacity = k.opacity;
    if (k.hit && !hit) {
      setHit(true);
      emitImpact({ x, z, dirX: dx, dirZ: dz, victim: piece.color, power: 1.25, ring: false });
    }
    // Splitter: ballistisch, drehend, verblassend
    if (k.hit && shards.current) {
      const ts = t.current - ATTACK_IMPACT;
      shards.current.children.forEach((child, i) => {
        const sh = shardState[i];
        const y = Math.max(0.02, sh.y0 + sh.vy * ts - 4.9 * ts * ts);
        child.position.set(sh.vx * ts * 0.6, y, sh.vz * ts * 0.6);
        child.rotation.set(sh.spin.x * ts, sh.spin.y * ts, sh.spin.z * ts);
        child.scale.setScalar(sh.size * Math.max(0, 1 - ts / 1.0));
      });
    }
    if (t.current > KNOCK_TOTAL + 0.1) onDone();
  });

  const yaw = pieceYaw(piece);
  return (
    <group position={[x, 0, z]} rotation-x={viewTilt} scale={viewScale}>
      <group ref={group}>
        <mesh geometry={look.geometry(piece.type)} material={material} rotation-y={yaw} castShadow={!!battle && !hit} raycast={noRaycast} />
      </group>
      {battle ? (
        hit && (
          <group ref={shards}>
            {shardState.map((_, i) => (
              <mesh key={i} geometry={shardGeometry!} material={material} />
            ))}
          </group>
        )
      ) : (
        <Burst color={piece.color === 'w' ? '#ffd27a' : '#cfd6e6'} />
      )}
    </group>
  );
}

/** Letzter gezeigter Zug (Partie oder Analyse-Ansicht) */
function shownLastMove(): MoveRecord | undefined {
  const s = gameStore.getState();
  const ply = displayPly(s);
  return ply > 0 ? s.history[ply - 1] : undefined;
}

export function Pieces() {
  const pieces = useGame((s) => s.view?.pieces ?? s.pieces);
  const selected = useGame((s) => s.selected);
  const turn = useGame((s) => s.status.turn);
  const canInteract = useGame(canHumanInteract);
  const pending = useGame((s) => s.pendingPromotion);
  const battleOn = useGame((s) => s.prefs.battleMode !== 'off');
  const battle = useGame((s) => s.battle);
  // Kriegerkampf: Figuren stehen aufrecht (Kamera von der Seite), der Angreifer ist solange Krieger
  const fighting = battle !== null && warriorsReady() !== null;
  const last = useGame((s) => {
    const ply = displayPly(s);
    return ply > 0 ? s.history[ply - 1] : undefined;
  });
  const checkSquare = useGame((s) => (s.viewPly !== null ? (s.view?.checkSquare ?? null) : s.status.checkSquare));
  const mateSquare = useGame((s) => {
    const ply = displayPly(s);
    return ply > 0 && s.history[ply - 1].isCheckmate ? checkSquareOf(s) : null;
  });
  const look = usePieceLook();
  const topView = useGame((s) => s.prefs.viewMode === 'top');
  const viewSide = useGame((s) => s.viewSide);
  // Kopf zeigt vom Spieler weg (Bildschirm oben): Weiß unten → nach -z, Schwarz unten → nach +z
  const viewTilt = topView && !fighting ? (viewSide === 'w' ? -TOP_VIEW_TILT : TOP_VIEW_TILT) : 0;
  const viewScale = topView && !fighting ? TOP_VIEW_SCALE : 1;
  // Gegenüber-Modus: Schwarz sitzt auf der anderen Seite des flach liegenden Geräts – seine Figuren neigen sich zu ihm
  const faceToFace = useGame((s) => s.prefs.faceToFace && s.settings.mode === 'local');
  const tiltFor = (color: Color) => {
    if (!faceToFace || viewTilt === 0) return viewTilt;
    return color === 'b' ? FACE_TO_FACE_TILT : -FACE_TO_FACE_TILT;
  };

  const prev = useRef<TrackedPiece[]>(pieces);
  const [ghosts, setGhosts] = useState<Array<{ key: string; piece: TrackedPiece; battle: { dirX: number; dirZ: number } | null }>>([]);

  useEffect(() => {
    const ids = new Set(pieces.map((p) => p.id));
    const removed = prev.current.filter((p) => !ids.has(p.id));
    // Nur echte Schlagzüge animieren (nicht das Zurücksetzen auf eine neue Partie)
    const s = gameStore.getState();
    const warriorFight = s.battle !== null && s.battle.ply === s.history.length && warriorsReady() !== null;
    // Beim Kriegerkampf übernehmen die Krieger – keine zerspringende Figur
    if (removed.length > 0 && removed.length <= 2 && !warriorFight) {
      const move = shownLastMove();
      let battle: { dirX: number; dirZ: number } | null = null;
      if (battleOn && move?.isCapture) {
        const [fx, fz] = squareToWorld(move.from);
        const [tx, tz] = squareToWorld(move.to);
        battle = { dirX: tx - fx, dirZ: tz - fz };
      }
      const stamp = performance.now();
      setGhosts((g) => [...g, ...removed.map((p) => ({ key: `${p.id}-${stamp}`, piece: p, battle }))]);
    }
    prev.current = pieces;
  }, [pieces, battleOn]);

  const profileFor = (p: TrackedPiece): MoveProfile =>
    battleOn && last?.isCapture && last.to === p.square && last.color === p.color ? 'attack' : p.type === 'n' ? 'hop' : 'glide';

  return (
    <group>
      {pieces.map((p) => (
        <Piece
          key={p.id}
          piece={p}
          lifted={p.square === selected && !pending}
          interactive={canInteract && p.color === turn}
          displaySquare={pending && pending.from === p.square ? pending.to : p.square}
          look={look}
          profile={profileFor(p)}
          inCheck={p.type === 'k' && p.square === checkSquare}
          mated={p.type === 'k' && p.square === mateSquare}
          viewTilt={tiltFor(p.color)}
          viewScale={viewScale}
          pickable={!topView}
          hidden={fighting && battle.to === p.square && battle.attacker.color === p.color}
        />
      ))}
      {ghosts.map((g) => (
        <Ghost
          key={g.key}
          piece={g.piece}
          look={look}
          battle={g.battle}
          viewTilt={tiltFor(g.piece.color)}
          viewScale={viewScale}
          onDone={() => setGhosts((all) => all.filter((x) => x.key !== g.key))}
        />
      ))}
    </group>
  );
}

/** Schachfeld der gezeigten Stellung (für Matt in der Analyse-Ansicht) */
function checkSquareOf(s: { viewPly: number | null; view: { checkSquare: Square | null } | null; status: { checkSquare: Square | null } }) {
  return s.viewPly !== null ? (s.view?.checkSquare ?? null) : s.status.checkSquare;
}
