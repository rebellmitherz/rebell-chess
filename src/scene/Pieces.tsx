import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { TrackedPiece } from '../core/pieceTracking';
import type { Square } from '../core/types';
import { useGame } from '../game/instance';
import { canHumanInteract } from '../game/store';
import { squareToWorld } from './boardMath';
import { getMaterials } from './materials';
import { getAccentGeometry, getPieceGeometry } from './pieceGeometry';
import { Burst } from './Effects';
import { clickSuppressed, pointerDrag, sceneHandles } from './interaction';

/** Springer schauen zum Gegner, leicht gedreht, damit das Profil aus Spielersicht erkennbar bleibt. */
const KNIGHT_YAW = 0.75;

function pieceYaw(piece: TrackedPiece): number {
  if (piece.type !== 'n') return 0;
  return piece.color === 'w' ? Math.PI / 2 + KNIGHT_YAW : -Math.PI / 2 + KNIGHT_YAW;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function setPointer(active: boolean) {
  document.body.style.cursor = active ? 'pointer' : '';
}

function Piece({
  piece,
  lifted,
  interactive,
  displaySquare,
}: {
  piece: TrackedPiece;
  lifted: boolean;
  interactive: boolean;
  /** Feld, auf dem die Figur gezeigt wird (bei offener Umwandlungsauswahl schon das Zielfeld) */
  displaySquare: Square;
}) {
  const group = useRef<THREE.Group>(null!);
  const selectSquare = useGame((s) => s.selectSquare);
  const [x, z] = squareToWorld(displaySquare);
  const anim = useRef({
    from: new THREE.Vector2(x, z),
    to: new THREE.Vector2(x, z),
    t: 1,
    duration: 0.3,
    hop: 0,
    lift: 0,
    scale: 0,
    pop: 0,
    wasDragged: false,
  });

  useLayoutEffect(() => {
    group.current.position.set(x, 0, z);
    group.current.scale.setScalar(0.001);
  }, []); // nur beim ersten Einhängen

  useEffect(() => {
    const a = anim.current;
    const g = group.current;
    a.from.set(g.position.x, g.position.z);
    a.to.set(x, z);
    const dist = a.from.distanceTo(a.to);
    if (dist < 1e-3) return;
    a.t = 0;
    a.duration = Math.min(0.6, 0.24 + dist * 0.045);
    a.hop = piece.type === 'n' ? 0.42 + dist * 0.04 : Math.min(0.16, dist * 0.035);
  }, [x, z, piece.type]);

  const firstType = useRef(piece.type);
  useEffect(() => {
    if (piece.type !== firstType.current) anim.current.pop = 1;
    firstType.current = piece.type;
  }, [piece.type]);

  useFrame((_, dt) => {
    const a = anim.current;
    const g = group.current;
    const dragged = pointerDrag.active && pointerDrag.pieceId === piece.id;
    if (dragged) {
      // Figur folgt dem Zeiger (leicht gedämpft), schwebt über dem Brett
      g.position.x = THREE.MathUtils.damp(g.position.x, pointerDrag.x, 28, dt);
      g.position.z = THREE.MathUtils.damp(g.position.z, pointerDrag.z, 28, dt);
      g.position.y = THREE.MathUtils.damp(g.position.y, 0.42, 18, dt);
      g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, 1.08, 14, dt));
      a.wasDragged = true;
      return;
    }
    if (a.wasDragged) {
      // Losgelassen: vom aktuellen Punkt zum (neuen oder alten) Feld gleiten
      a.wasDragged = false;
      a.from.set(g.position.x, g.position.z);
      a.to.set(x, z);
      a.t = 0;
      a.duration = 0.18 + a.from.distanceTo(a.to) * 0.03;
      a.hop = 0;
      a.lift = g.position.y;
    }
    let y = 0;
    if (a.t < 1) {
      a.t = Math.min(1, a.t + dt / a.duration);
      const e = easeInOut(a.t);
      g.position.x = THREE.MathUtils.lerp(a.from.x, a.to.x, e);
      g.position.z = THREE.MathUtils.lerp(a.from.y, a.to.y, e);
      y = Math.sin(Math.PI * a.t) * a.hop;
    }
    a.lift = THREE.MathUtils.damp(a.lift, lifted ? 0.16 : 0, 14, dt);
    g.position.y = y + a.lift;
    a.scale = THREE.MathUtils.damp(a.scale, 1, 9, dt);
    a.pop = THREE.MathUtils.damp(a.pop, 0, 5, dt);
    g.scale.setScalar(Math.max(0.001, a.scale * (1 + a.pop * 0.3)));
  });

  const mats = getMaterials();
  const yaw = pieceYaw(piece);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8 || clickSuppressed()) return;
    e.stopPropagation();
    selectSquare(piece.square);
  };

  // Ziehen vorbereiten: Kamera sofort abschalten, damit sie die Geste nicht übernimmt
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    if (sceneHandles.controls) sceneHandles.controls.enabled = false;
    Object.assign(pointerDrag, {
      pointerId: e.pointerId,
      pieceId: piece.id,
      from: piece.square,
      startX: e.nativeEvent.clientX,
      startY: e.nativeEvent.clientY,
      active: false,
      x,
      z,
    });
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
        <mesh geometry={getPieceGeometry(piece.type)} material={mats.piece[piece.color]} castShadow receiveShadow />
        <mesh geometry={getAccentGeometry(piece.type)} material={mats.accent[piece.color]} />
      </group>
    </group>
  );
}

/** Geschlagene Figur: versinkt, wird transparent, Funken steigen auf. */
function Ghost({ piece, onDone }: { piece: TrackedPiece; onDone: () => void }) {
  const group = useRef<THREE.Group>(null!);
  const [x, z] = squareToWorld(piece.square);
  const material = useMemo(() => {
    const m = getMaterials().piece[piece.color].clone();
    m.transparent = true;
    return m;
  }, [piece.color]);
  const t = useRef(0);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, dt) => {
    t.current += dt;
    const k = Math.min(1, t.current / 0.6);
    group.current.position.y = -k * 0.25 + Math.sin(k * Math.PI) * 0.12;
    group.current.scale.setScalar(1 - k * 0.55);
    group.current.rotation.y = k * 1.4;
    material.opacity = 1 - k;
    if (t.current > 1.1) onDone();
  });
  const yaw = pieceYaw(piece);
  return (
    <group position={[x, 0, z]}>
      <group ref={group}>
        <mesh geometry={getPieceGeometry(piece.type)} material={material} rotation-y={yaw} />
      </group>
      <Burst color={piece.color === 'w' ? '#ffd27a' : '#cfd6e6'} />
    </group>
  );
}

export function Pieces() {
  const pieces = useGame((s) => s.pieces);
  const selected = useGame((s) => s.selected);
  const turn = useGame((s) => s.status.turn);
  const canInteract = useGame(canHumanInteract);
  const pending = useGame((s) => s.pendingPromotion);

  const prev = useRef<TrackedPiece[]>(pieces);
  const [ghosts, setGhosts] = useState<Array<{ key: string; piece: TrackedPiece }>>([]);

  useEffect(() => {
    const ids = new Set(pieces.map((p) => p.id));
    const removed = prev.current.filter((p) => !ids.has(p.id));
    // Nur echte Schlagzüge animieren (nicht das Zurücksetzen auf eine neue Partie)
    if (removed.length > 0 && removed.length <= 2) {
      const stamp = performance.now();
      setGhosts((g) => [...g, ...removed.map((p) => ({ key: `${p.id}-${stamp}`, piece: p }))]);
    }
    prev.current = pieces;
  }, [pieces]);

  return (
    <group>
      {pieces.map((p) => (
        <Piece
          key={p.id}
          piece={p}
          lifted={p.square === selected && !pending}
          interactive={canInteract && p.color === turn}
          displaySquare={pending && pending.from === p.square ? pending.to : p.square}
        />
      ))}
      {ghosts.map((g) => (
        <Ghost key={g.key} piece={g.piece} onDone={() => setGhosts((all) => all.filter((x) => x.key !== g.key))} />
      ))}
    </group>
  );
}
