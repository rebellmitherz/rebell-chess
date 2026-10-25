import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Square } from '../core/types';
import { useGame } from '../game/instance';
import { squareToWorld } from './boardMath';
import { Burst } from './Effects';

const Y = 0.006;

function overlayMaterial(color: string, opacity: number) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

let shared: ReturnType<typeof buildShared> | null = null;
function buildShared() {
  return {
    square: new THREE.PlaneGeometry(0.97, 0.97),
    dot: new THREE.CircleGeometry(0.13, 40),
    ring: new THREE.RingGeometry(0.39, 0.47, 56),
    selectRing: new THREE.RingGeometry(0.42, 0.485, 56),
    lastMove: overlayMaterial('#e7c36a', 0.26),
    selected: overlayMaterial('#f6d47c', 0.34),
    selectedRing: overlayMaterial('#ffe29a', 0.95),
    target: overlayMaterial('#f2cf78', 0.88),
    capture: overlayMaterial('#ff8f5a', 0.92),
  };
}
const getShared = () => (shared ??= buildShared());

function Flat({ square, geometry, material, y = Y, order = 3 }: { square: Square; geometry: THREE.BufferGeometry; material: THREE.Material; y?: number; order?: number }) {
  const [x, z] = squareToWorld(square);
  return <mesh geometry={geometry} material={material} position={[x, y, z]} rotation-x={-Math.PI / 2} renderOrder={order} />;
}

function CheckGlow({ square }: { square: Square }) {
  const material = useRef<THREE.MeshBasicMaterial>(null!);
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,70,60,1)');
    g.addColorStop(0.45, 'rgba(255,40,40,0.55)');
    g.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  useFrame(({ clock }) => {
    material.current.opacity = 0.55 + Math.sin(clock.elapsedTime * 5) * 0.25;
  });
  const [x, z] = squareToWorld(square);
  return (
    <mesh position={[x, Y + 0.002, z]} rotation-x={-Math.PI / 2} renderOrder={4}>
      <planeGeometry args={[1.5, 1.5]} />
      <meshBasicMaterial ref={material} map={texture} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/** Flacher Pfeil für den Trainingshinweis */
function HintArrow({ from, to }: { from: Square; to: Square }) {
  const [x1, z1] = squareToWorld(from);
  const [x2, z2] = squareToWorld(to);
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const geometry = useMemo(() => {
    const start = 0.18;
    const end = length - 0.12;
    const head = Math.min(0.42, length * 0.45);
    const w = 0.075;
    const hw = 0.22;
    const s = new THREE.Shape();
    s.moveTo(start, -w);
    s.lineTo(end - head, -w);
    s.lineTo(end - head, -hw);
    s.lineTo(end, 0);
    s.lineTo(end - head, hw);
    s.lineTo(end - head, w);
    s.lineTo(start, w);
    s.closePath();
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [length]);
  const material = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    material.current.opacity = 0.7 + Math.sin(clock.elapsedTime * 3) * 0.15;
  });
  return (
    <mesh geometry={geometry} position={[x1, 0.03, z1]} rotation-y={Math.atan2(-dz, dx)} renderOrder={6}>
      <meshBasicMaterial ref={material} color="#3ee6a6" transparent depthWrite={false} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

export function Highlights() {
  const s = getShared();
  const selected = useGame((st) => st.selected);
  const targets = useGame((st) => st.targets);
  const last = useGame((st) => st.history[st.history.length - 1]);
  const checkSquare = useGame((st) => st.status.checkSquare);
  const hint = useGame((st) => st.hint);
  const showLegal = useGame((st) => st.prefs.showLegalMoves);
  const showLast = useGame((st) => st.prefs.showLastMove);
  const result = useGame((st) => st.result);

  return (
    <group>
      {showLast && last && (
        <>
          <Flat square={last.from} geometry={s.square} material={s.lastMove} />
          <Flat square={last.to} geometry={s.square} material={s.lastMove} />
        </>
      )}
      {selected && (
        <>
          <Flat square={selected} geometry={s.square} material={s.selected} order={4} />
          <Flat square={selected} geometry={s.selectRing} material={s.selectedRing} order={5} />
        </>
      )}
      {showLegal &&
        targets.map((t) =>
          t.isCapture ? (
            <Flat key={t.to} square={t.to} geometry={s.ring} material={s.capture} order={5} />
          ) : (
            <Flat key={t.to} square={t.to} geometry={s.dot} material={s.target} order={5} />
          ),
        )}
      {checkSquare && <CheckGlow square={checkSquare} />}
      {hint?.status === 'ready' && hint.from && hint.to && <HintArrow from={hint.from} to={hint.to} />}
      {last?.promotion && <PromotionFlash key={`${last.to}-${last.fenAfter}`} square={last.to} />}
      {result?.reason === 'checkmate' && checkSquare && <MateBurst key={`mate-${checkSquare}`} square={checkSquare} />}
    </group>
  );
}

function PromotionFlash({ square }: { square: Square }) {
  const [x, z] = squareToWorld(square);
  return (
    <group position={[x, 0, z]}>
      <Burst color="#ffe39a" count={48} />
    </group>
  );
}

function MateBurst({ square }: { square: Square }) {
  const [x, z] = squareToWorld(square);
  return (
    <group position={[x, 0.3, z]}>
      <Burst color="#ff7a5a" count={60} />
    </group>
  );
}
