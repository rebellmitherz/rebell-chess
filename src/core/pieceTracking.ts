import { Chess } from 'chess.js';
import type { Color, MoveRecord, PieceSymbol, Square } from './types';

/** Figur mit stabiler ID – dieselbe Figur behält ihre ID über alle Züge (für 3D-Animationen). */
export interface TrackedPiece {
  id: string;
  color: Color;
  type: PieceSymbol;
  square: Square;
}

export interface TrackedPosition {
  pieces: TrackedPiece[];
  /** Geschlagene Figuren in Reihenfolge des Schlagens */
  captured: TrackedPiece[];
}

export function initialTrackedPieces(fen: string): TrackedPiece[] {
  const chess = new Chess(fen);
  const out: TrackedPiece[] = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell) out.push({ id: `${cell.color}${cell.type}-${cell.square}`, color: cell.color, type: cell.type, square: cell.square });
    }
  }
  return out;
}

function rookCastlingSquares(move: MoveRecord): [Square, Square] | null {
  const rank = move.color === 'w' ? '1' : '8';
  if (move.isKingsideCastle) return [`h${rank}` as Square, `f${rank}` as Square];
  if (move.isQueensideCastle) return [`a${rank}` as Square, `d${rank}` as Square];
  return null;
}

/** Wendet einen Zug auf die verfolgten Figuren an (unveränderlich). */
export function applyMoveToTracked(position: TrackedPosition, move: MoveRecord): TrackedPosition {
  const pieces = position.pieces.map((p) => ({ ...p }));
  const captured = [...position.captured];

  const captureSquare: Square | null = move.isEnPassant
    ? (`${move.to[0]}${move.from[1]}` as Square)
    : move.isCapture
      ? move.to
      : null;

  if (captureSquare) {
    const idx = pieces.findIndex((p) => p.square === captureSquare && p.color !== move.color);
    if (idx >= 0) captured.push(...pieces.splice(idx, 1));
  }

  const mover = pieces.find((p) => p.square === move.from);
  if (mover) {
    mover.square = move.to;
    if (move.promotion) mover.type = move.promotion;
  }

  const rook = rookCastlingSquares(move);
  if (rook) {
    const r = pieces.find((p) => p.square === rook[0] && p.color === move.color && p.type === 'r');
    if (r) r.square = rook[1];
  }

  return { pieces, captured };
}

export function trackPieces(startFen: string, moves: MoveRecord[]): TrackedPosition {
  let pos: TrackedPosition = { pieces: initialTrackedPieces(startFen), captured: [] };
  for (const m of moves) pos = applyMoveToTracked(pos, m);
  return pos;
}
