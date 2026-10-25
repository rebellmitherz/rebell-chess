import type { Color, PieceSymbol, Square } from 'chess.js';

export type { Color, PieceSymbol, Square };

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export type ResultReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient-material'
  | 'threefold-repetition'
  | 'fifty-move-rule'
  | 'timeout'
  | 'timeout-insufficient-material'
  | 'resignation'
  | 'agreement';

export interface GameResult {
  /** null = Remis */
  winner: Color | null;
  reason: ResultReason;
}

/** Serialisierbare Beschreibung eines ausgeführten Zuges. */
export interface MoveRecord {
  san: string;
  uci: string;
  color: Color;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  isCapture: boolean;
  isEnPassant: boolean;
  isKingsideCastle: boolean;
  isQueensideCastle: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  fenBefore: string;
  fenAfter: string;
}

/** Ein mögliches Zielfeld für die ausgewählte Figur. */
export interface MoveOption {
  to: Square;
  isCapture: boolean;
  isPromotion: boolean;
}

export interface GameStatus {
  turn: Color;
  inCheck: boolean;
  /** Feld des Königs, der im Schach steht */
  checkSquare: Square | null;
  /** Ergebnis aus der Stellung (Matt, Patt, Remisregeln); null = Partie läuft */
  result: GameResult | null;
}

export interface BoardPiece {
  square: Square;
  color: Color;
  type: PieceSymbol;
}

export const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export const PIECE_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const PROMOTION_PIECES: PieceSymbol[] = ['q', 'r', 'b', 'n'];

export function squareToCoords(square: Square): { file: number; rank: number } {
  return { file: square.charCodeAt(0) - 97, rank: Number(square[1]) - 1 };
}

export function coordsToSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${RANKS[rank]}` as Square;
}

export function isLightSquare(square: Square): boolean {
  const { file, rank } = squareToCoords(square);
  return (file + rank) % 2 === 1;
}
