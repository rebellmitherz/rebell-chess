import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FILES, isLightSquare, RANKS, type Square } from '../core/types';
import { useGame } from '../game/instance';
import { FRAME_HALF, squareToWorld, worldToSquare } from './boardMath';
import { beginDrag, clickSuppressed, useDragUi } from './interaction';
import { gameStore } from '../game/instance';
import { canHumanInteract } from '../game/store';
import { getMaterials } from './materials';
import { useRealAssets } from './realAssets';

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

/**
 * Handy: Koordinaten klein in die Randfelder (wie bei Lichess) – dann darf der Rahmen aus dem Bild und das
 * Spielfeld wird größer. Buchstaben unten rechts in der untersten Reihe, Zahlen oben links in der linken Spalte,
 * jeweils aus Sicht des Spielers unten; dunkle Schrift auf hellen, helle Schrift auf dunklen Feldern.
 */
function drawCoordinatesInside(ctx: CanvasRenderingContext2D, size: number, side: 'w' | 'b') {
  ctx.clearRect(0, 0, size, size);
  const toPx = (v: number) => ((v + FRAME_HALF) / (FRAME_HALF * 2)) * size;
  ctx.font = `800 ${Math.round(size * 0.03)}px Inter, system-ui, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.005;
  const flip = side === 'b';
  const label = (text: string, x: number, z: number, light: boolean, align: 'left' | 'right', base: 'top' | 'bottom') => {
    ctx.save();
    ctx.translate(toPx(x), toPx(z));
    if (flip) ctx.rotate(Math.PI);
    ctx.textAlign = align;
    ctx.textBaseline = base;
    // Kontur in der Gegenfarbe: lesbar auf hellen wie dunklen Feldern
    ctx.strokeStyle = light ? 'rgba(255, 250, 240, 0.85)' : 'rgba(20, 16, 12, 0.85)';
    ctx.fillStyle = light ? 'rgba(62, 50, 36, 0.95)' : 'rgba(248, 238, 214, 0.97)';
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  // a1 ist ein dunkles Feld; (Spalte + Reihe) gerade = dunkel
  const inset = 0.43;
  FILES.forEach((f, i) => {
    const rankIdx = flip ? 7 : 0; // unterste Reihe aus Spielersicht
    const light = (i + rankIdx) % 2 === 1;
    const x = i - 3.5 + (flip ? -inset : inset);
    const z = 3.5 - rankIdx + (flip ? -inset : inset);
    label(f, x, z, light, 'right', 'bottom');
  });
  RANKS.forEach((r, i) => {
    const fileIdx = flip ? 7 : 0; // linke Spalte aus Spielersicht
    const light = (fileIdx + i) % 2 === 1;
    const x = fileIdx - 3.5 + (flip ? inset : -inset);
    const z = 3.5 - i + (flip ? inset : -inset);
    label(r, x, z, light, 'left', 'top');
  });
}

function useCoordinateTexture(inside: boolean, side: 'w' | 'b') {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2048;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);
  useEffect(() => {
    const draw = () => {
      const ctx = (texture.image as HTMLCanvasElement).getContext('2d')!;
      if (inside) drawCoordinatesInside(ctx, 2048, side);
      else drawCoordinates(ctx, 2048);
      texture.needsUpdate = true;
    };
    draw();
    // Nach dem Laden der Schrift neu zeichnen
    void document.fonts?.load('600 60px Cinzel').then(draw);
  }, [texture, inside, side]);
  return texture;
}

export function Board() {
  const mats = getMaterials(useGame((s) => (s.prefs.pieceStyle === 'rebell' ? 'rebell' : 'classic')));
  const showCoordinates = useGame((s) => s.prefs.showCoordinates);
  const selectSquare = useGame((s) => s.selectSquare);
  const [hover, setHover] = useState<Square | null>(null);
  const dragging = useDragUi((s) => s.draggingId !== null);
  const style = useGame((s) => s.prefs.pieceStyle);
  const real = useRealAssets(style === 'real');

  const lightGeo = useMemo(() => buildSquares(true), []);
  const darkGeo = useMemo(() => buildSquares(false), []);
  const frameGeo = useMemo(() => new RoundedBoxGeometry(FRAME_HALF * 2, 0.32, FRAME_HALF * 2, 4, 0.07), []);
  const plinthGeo = useMemo(() => new RoundedBoxGeometry(9.1, 0.5, 9.1, 4, 0.1), []);
  // Hochformat (Handy): Koordinaten in den Feldern, damit die Kamera auf das Spielfeld allein einpassen kann
  const compact = useThree((s) => s.size.width / s.size.height < 0.9);
  const viewSide = useGame((s) => s.viewSide);
  const coordTex = useCoordinateTexture(compact, viewSide);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8 || clickSuppressed()) return; // war ein Kamera-Ziehen oder Drag & Drop
    e.stopPropagation();
    const sq = worldToSquare(e.point.x, e.point.z);
    if (sq) selectSquare(sq);
  };
  /** Eigene Figur auf dem Feld unter dem Zeiger (für Ziehen und Mauszeiger) */
  const ownPieceAt = (sq: Square | null) => {
    const s = gameStore.getState();
    if (!sq || !canHumanInteract(s)) return null;
    return s.pieces.find((p) => p.square === sq && p.color === s.status.turn) ?? null;
  };
  // Ziehen beginnt auf dem Feld – auch wenn die (geneigte) Figur optisch woanders hinragt
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const sq = worldToSquare(e.point.x, e.point.z);
    const piece = ownPieceAt(sq);
    if (!piece || !sq) return;
    e.stopPropagation();
    const [x, z] = squareToWorld(sq);
    beginDrag(piece.id, sq, e.pointerId, e.nativeEvent.clientX, e.nativeEvent.clientY, x, z);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType !== 'mouse') return;
    const sq = worldToSquare(e.point.x, e.point.z);
    document.body.style.cursor = ownPieceAt(sq) ? 'pointer' : '';
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
      {real ? (
        <>
          {/* Echtes Brett (Poly Haven) auf einer Holztischplatte */}
          <mesh geometry={real.board.geometry} material={real.board.material} receiveShadow castShadow />
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.3, 0]} material={real.table} receiveShadow>
            <planeGeometry args={[18, 18]} />
          </mesh>
        </>
      ) : (
        <>
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
          {/* Boden mit sanftem Lichtkegel */}
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.8, 0]} material={mats.floor} receiveShadow>
            <circleGeometry args={[40, 64]} />
          </mesh>
        </>
      )}
      <mesh rotation-x={-Math.PI / 2} position={[0, real ? 0.003 : -0.0275, 0]} visible={showCoordinates} renderOrder={1}>
        <planeGeometry args={[FRAME_HALF * 2, FRAME_HALF * 2]} />
        <meshBasicMaterial map={coordTex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {/* Unsichtbare Klickfläche über dem Brett */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0.003, 0]}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onMove}
        onPointerOut={() => {
          setHover(null);
          document.body.style.cursor = '';
        }}
      >
        <planeGeometry args={[8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hover && !dragging && <HoverMarker square={hover} />}
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
