import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FILES, isLightSquare, RANKS, type Square } from '../core/types';
import { useGame } from '../game/instance';
import { FRAME_HALF, squareToWorld, worldToSquare } from './boardMath';
import { getMaterials } from './materials';

/** Felder als zwei gemergte Geometrien (hell/dunkel) – jedes Feld zeigt einen anderen Ausschnitt der Steintextur. */
function buildSquares(light: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  let seed = light ? 7 : 13;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (const f of FILES) {
    for (const r of RANKS) {
      const sq = `${f}${r}` as Square;
      if (isLightSquare(sq) !== light) continue;
      const g = new RoundedBoxGeometry(0.985, 0.1, 0.985, 2, 0.014);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      const ox = rand() * 0.65;
      const oy = rand() * 0.65;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.35 + ox, uv.getY(i) * 0.35 + oy);
      const [x, z] = squareToWorld(sq);
      g.translate(x, -0.05, z);
      parts.push(g);
    }
  }
  return mergeGeometries(parts)!;
}

function drawCoordinates(ctx: CanvasRenderingContext2D, size: number) {
  ctx.clearRect(0, 0, size, size);
  const toPx = (v: number) => ((v + FRAME_HALF) / (FRAME_HALF * 2)) * size;
  const edge = 4.42;
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#f7dc8f');
  gradient.addColorStop(0.5, '#d4a94f');
  gradient.addColorStop(1, '#f2d27e');
  ctx.fillStyle = gradient;
  ctx.font = `600 ${Math.round(size * 0.03)}px Cinzel, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = (text: string, x: number, z: number, flipped: boolean) => {
    ctx.save();
    ctx.translate(toPx(x), toPx(z));
    if (flipped) ctx.rotate(Math.PI);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  FILES.forEach((f, i) => {
    label(f.toUpperCase(), i - 3.5, edge, false);
    label(f.toUpperCase(), i - 3.5, -edge, true);
  });
  RANKS.forEach((r, i) => {
    label(r, -edge, 3.5 - i, false);
    label(r, edge, 3.5 - i, true);
  });
}

function useCoordinateTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2048;
    drawCoordinates(canvas.getContext('2d')!, canvas.width);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);
  useEffect(() => {
    // Nach dem Laden der Schrift neu zeichnen
    document.fonts?.load('600 60px Cinzel').then(() => {
      drawCoordinates((texture.image as HTMLCanvasElement).getContext('2d')!, 2048);
      texture.needsUpdate = true;
    });
  }, [texture]);
  return texture;
}

export function Board() {
  const mats = getMaterials();
  const showCoordinates = useGame((s) => s.prefs.showCoordinates);
  const selectSquare = useGame((s) => s.selectSquare);
  const [hover, setHover] = useState<Square | null>(null);

  const lightGeo = useMemo(() => buildSquares(true), []);
  const darkGeo = useMemo(() => buildSquares(false), []);
  const frameGeo = useMemo(() => new RoundedBoxGeometry(FRAME_HALF * 2, 0.32, FRAME_HALF * 2, 4, 0.07), []);
  const plinthGeo = useMemo(() => new RoundedBoxGeometry(9.1, 0.5, 9.1, 4, 0.1), []);
  const coordTex = useCoordinateTexture();

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return; // war ein Kamera-Ziehen
    e.stopPropagation();
    const sq = worldToSquare(e.point.x, e.point.z);
    if (sq) selectSquare(sq);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType !== 'mouse') return;
    const sq = worldToSquare(e.point.x, e.point.z);
    if (sq !== hover) setHover(sq);
  };

  const trims: Array<[number, number, number, number]> = [
    // x, z, breite, tiefe
    [0, -4.03, 8.11, 0.05],
    [0, 4.03, 8.11, 0.05],
    [-4.03, 0, 0.05, 8.01],
    [4.03, 0, 0.05, 8.01],
  ];
  const outer = FRAME_HALF - 0.12;
  const outerTrims: Array<[number, number, number, number]> = [
    [0, -outer, outer * 2 + 0.03, 0.03],
    [0, outer, outer * 2 + 0.03, 0.03],
    [-outer, 0, 0.03, outer * 2],
    [outer, 0, 0.03, outer * 2],
  ];

  return (
    <group>
      <mesh geometry={lightGeo} material={mats.lightSquare} receiveShadow />
      <mesh geometry={darkGeo} material={mats.darkSquare} receiveShadow />
      <mesh geometry={frameGeo} material={mats.frame} position={[0, -0.19, 0]} receiveShadow castShadow />
      <mesh geometry={plinthGeo} material={mats.plinth} position={[0, -0.55, 0]} castShadow />
      {trims.map(([x, z, w, d], i) => (
        <mesh key={`t${i}`} position={[x, -0.012, z]} material={mats.trim} receiveShadow>
          <boxGeometry args={[w, 0.03, d]} />
        </mesh>
      ))}
      {outerTrims.map(([x, z, w, d], i) => (
        <mesh key={`o${i}`} position={[x, -0.024, z]} material={mats.trim}>
          <boxGeometry args={[w, 0.012, d]} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.0275, 0]} visible={showCoordinates} renderOrder={1}>
        <planeGeometry args={[FRAME_HALF * 2, FRAME_HALF * 2]} />
        <meshBasicMaterial map={coordTex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {/* Boden mit sanftem Lichtkegel */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.8, 0]} material={mats.floor} receiveShadow>
        <circleGeometry args={[40, 64]} />
      </mesh>
      {/* Unsichtbare Klickfläche über dem Brett */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0.003, 0]}
        onClick={onClick}
        onPointerMove={onMove}
        onPointerOut={() => setHover(null)}
      >
        <planeGeometry args={[8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hover && <HoverMarker square={hover} />}
    </group>
  );
}

function HoverMarker({ square }: { square: Square }) {
  const [x, z] = squareToWorld(square);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, 0.004, z]} renderOrder={2}>
      <planeGeometry args={[0.97, 0.97]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.07} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
