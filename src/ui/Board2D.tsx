import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { TrackedPiece } from '../core/pieceTracking';
import { coordsToSquare, squareToCoords, type Color, type Square } from '../core/types';
import { gameStore, useGame } from '../game/instance';
import { canHumanInteract, displayPly } from '../game/store';
import { tr } from '../i18n';

/**
 * 2D-Ansicht: flaches Brett von oben als HTML statt 3D – klar lesbar, schnell, auch auf schwachen Handys.
 * Die Figuren sind Bilder der echten Marmorfiguren (scripts/build-sprites.mjs). Die 3D-Szene bleibt darunter
 * geladen: Kriegerkämpfe laufen weiter in 3D, das 2D-Brett blendet sich dafür kurz aus.
 */

const FILES = 'abcdefgh';
const DRAG_THRESHOLD_PX = 6;

export function spriteUrl(color: Color, type: string): string {
  return new URL(`pieces2d/${color}${type}.webp`, document.baseURI).href;
}

/** Spalte/Zeile auf dem Bildschirm (0 = links bzw. oben) */
function screenPos(square: Square, side: Color): { col: number; row: number } {
  const { file, rank } = squareToCoords(square);
  return side === 'w' ? { col: file, row: 7 - rank } : { col: 7 - file, row: rank };
}

function squareAt(col: number, row: number, side: Color): Square | null {
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return side === 'w' ? coordsToSquare(col, 7 - row) : coordsToSquare(7 - col, row);
}

const at = (square: Square, side: Color) => {
  const { col, row } = screenPos(square, side);
  return { transform: `translate(${col * 100}%, ${row * 100}%)` };
};

interface Drag {
  pointerId: number;
  from: Square;
  pieceId: string;
  startX: number;
  startY: number;
  /** Auswahl vor dem Antippen (erneutes Antippen hebt sie auf) */
  wasSelected: boolean;
  active: boolean;
}

/** Pfeil für den Trainingshinweis (Brett = 8 × 8 Einheiten) */
function HintArrow({ from, to, side }: { from: Square; to: Square; side: Color }) {
  const a = screenPos(from, side);
  const b = screenPos(to, side);
  const x1 = a.col + 0.5;
  const y1 = a.row + 0.5;
  const dx = b.col - a.col;
  const dy = b.row - a.row;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const x2 = b.col + 0.5 - ux * 0.22;
  const y2 = b.row + 0.5 - uy * 0.22;
  const head = 0.38;
  const hx = x2 - ux * head;
  const hy = y2 - uy * head;
  return (
    <svg className="b2d-arrow" viewBox="0 0 8 8" aria-hidden="true">
      <line x1={x1 + ux * 0.2} y1={y1 + uy * 0.2} x2={hx} y2={hy} stroke="currentColor" strokeWidth={0.16} strokeLinecap="round" />
      <polygon fill="currentColor" points={`${x2},${y2} ${hx - uy * 0.24},${hy + ux * 0.24} ${hx + uy * 0.24},${hy - ux * 0.24}`} />
    </svg>
  );
}

export function Board2D({ left, right, top, bottom, hidden }: { left: number; right: number; top: number; bottom: number; hidden: boolean }) {
  const side = useGame((s) => s.viewSide);
  const livePieces = useGame((s) => s.pieces);
  const viewPieces = useGame((s) => s.view?.pieces ?? null);
  const selected = useGame((s) => s.selected);
  const targets = useGame((s) => s.targets);
  const pending = useGame((s) => s.pendingPromotion);
  const last = useGame((s) => {
    const ply = displayPly(s);
    return ply > 0 ? s.history[ply - 1] : undefined;
  });
  const ply = useGame((s) => displayPly(s));
  const viewing = useGame((s) => s.viewPly !== null);
  const checkSquare = useGame((s) => (s.viewPly !== null ? (s.view?.checkSquare ?? null) : s.status.checkSquare));
  const hint = useGame((s) => s.hint);
  const showLegal = useGame((s) => s.prefs.showLegalMoves);
  const showLast = useGame((s) => s.prefs.showLastMove);
  const coords = useGame((s) => s.prefs.showCoordinates);
  const theme = useGame((s) => s.prefs.pieceStyle);
  const faceToFace = useGame((s) => s.prefs.faceToFace && s.settings.mode === 'local');
  const interactive = useGame(canHumanInteract);
  const mated = useGame((s) => s.viewPly === null && s.result?.reason === 'checkmate');

  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [dragView, setDragView] = useState<{ id: string; x: number; y: number; over: Square | null } | null>(null);

  // Abgebrochene Partie, Kampf oder Analyse: laufendes Ziehen verwerfen
  useEffect(() => {
    if (!interactive && drag.current) {
      drag.current = null;
      setDragView(null);
    }
  }, [interactive]);

  const pieces: TrackedPiece[] = viewPieces ?? livePieces;
  const squareFromEvent = (e: { clientX: number; clientY: number }): Square | null => {
    const r = boardRef.current!.getBoundingClientRect();
    return squareAt(Math.floor(((e.clientX - r.left) / r.width) * 8), Math.floor(((e.clientY - r.top) / r.height) * 8), side);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || drag.current) return;
    const square = squareFromEvent(e);
    if (!square) return;
    const s = gameStore.getState();
    const piece = s.pieces.find((p) => p.square === square);
    if (canHumanInteract(s) && piece && piece.color === s.status.turn) {
      const wasSelected = s.selected === square;
      // Eigene Figur: sofort auswählen (Punkte zeigen), dann ziehen oder loslassen
      if (!wasSelected) s.selectSquare(square);
      drag.current = { pointerId: e.pointerId, from: square, pieceId: piece.id, startX: e.clientX, startY: e.clientY, wasSelected, active: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    s.selectSquare(square);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.active && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
    d.active = true;
    const r = boardRef.current!.getBoundingClientRect();
    setDragView({ id: d.pieceId, x: e.clientX - r.left, y: e.clientY - r.top, over: squareFromEvent(e) });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragView(null);
    const s = gameStore.getState();
    if (d.active) s.dropPiece(d.from, squareFromEvent(e));
    else if (d.wasSelected && squareFromEvent(e) === d.from) s.selectSquare(d.from);
  };

  const onPointerCancel = () => {
    drag.current = null;
    setDragView(null);
  };

  // Offene Umwandlungsauswahl: Bauer steht schon auf dem Zielfeld, eine geschlagene Figur ist weg
  const shown = pieces.flatMap((p) => {
    if (pending && p.square === pending.to) return [];
    return pending && p.square === pending.from ? [{ ...p, square: pending.to }] : [p];
  });
  const dropLegal = dragView?.over && targets.some((t) => t.to === dragView.over) ? dragView.over : null;
  const squares: Square[] = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) squares.push(squareAt(col, row, side)!);

  return (
    <div className={`b2d-stage${hidden ? ' hidden' : ''}`} style={{ left, right, top, bottom }}>
      <div
        ref={boardRef}
        className={`b2d-board theme-${theme}${interactive ? ' interactive' : ''}`}
        role="grid"
        aria-label={tr('Schachbrett')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {squares.map((sq, i) => {
          const { file, rank } = squareToCoords(sq);
          const light = (file + rank) % 2 === 1;
          const col = i % 8;
          const row = Math.floor(i / 8);
          return (
            <div key={sq} className={`b2d-sq ${light ? 'light' : 'dark'}`}>
              {coords && col === 0 && <span className="b2d-rank">{rank + 1}</span>}
              {coords && row === 7 && <span className="b2d-file">{FILES[file]}</span>}
            </div>
          );
        })}
        {showLast && last && (
          <>
            <div className="b2d-mark last" style={at(last.from, side)} />
            <div className="b2d-mark last" style={at(last.to, side)} />
          </>
        )}
        {selected && <div className="b2d-mark selected" style={at(selected, side)} />}
        {dropLegal && <div className="b2d-mark drop" style={at(dropLegal, side)} />}
        {checkSquare && <div className={`b2d-mark check${mated ? ' mated' : ''}`} style={at(checkSquare, side)} />}
        {shown.map((p) => (
          <div
            key={p.id}
            className={`b2d-piece${dragView?.id === p.id ? ' lifted' : ''}${faceToFace && p.color !== side ? ' turned' : ''}`}
            style={
              dragView?.id === p.id
                ? { transform: `translate(${dragView.x}px, ${dragView.y}px) translate(-50%, -58%) scale(1.18)`, transition: 'none' }
                : at(p.square, side)
            }
          >
            <img src={spriteUrl(p.color, p.type)} alt="" draggable={false} />
          </div>
        ))}
        {showLegal &&
          targets.map((t) => <div key={t.to} className={`b2d-mark ${t.isCapture ? 'capture' : 'target'}`} style={at(t.to, side)} />)}
        {!viewing && last?.isCapture && <div key={`burst-${ply}`} className="b2d-mark burst" style={at(last.to, side)} />}
        {hint?.status === 'ready' && hint.from && hint.to && <HintArrow from={hint.from} to={hint.to} side={side} />}
      </div>
    </div>
  );
}
