import { Chess, DEFAULT_POSITION, validateFen, type Move } from 'chess.js';
import type {
  BoardPiece,
  Color,
  GameResult,
  GameStatus,
  MoveOption,
  MoveRecord,
  PieceSymbol,
  Square,
} from './types';

export const START_FEN = DEFAULT_POSITION;

export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

const UCI_PATTERN = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

export function parseUci(uci: string): MoveInput | null {
  const m = UCI_PATTERN.exec(uci);
  if (!m) return null;
  return { from: m[1] as Square, to: m[2] as Square, promotion: m[3] as PieceSymbol | undefined };
}

export function isValidFen(fen: string): boolean {
  return validateFen(fen).ok;
}

function toRecord(move: Move): MoveRecord {
  return {
    san: move.san,
    uci: move.lan,
    color: move.color,
    from: move.from,
    to: move.to,
    piece: move.piece,
    captured: move.captured,
    promotion: move.promotion,
    isCapture: move.isCapture() || move.isEnPassant(),
    isEnPassant: move.isEnPassant(),
    isKingsideCastle: move.isKingsideCastle(),
    isQueensideCastle: move.isQueensideCastle(),
    isCheck: move.san.includes('+') || move.san.includes('#'),
    isCheckmate: move.san.includes('#'),
    fenBefore: move.before,
    fenAfter: move.after,
  };
}

/**
 * Regelkonforme Partie. Dünne Hülle um chess.js, damit der Rest der App nur
 * mit serialisierbaren Daten (MoveRecord, GameStatus) arbeitet.
 */
export class ChessGame {
  private chess: Chess;
  readonly startFen: string;

  constructor(startFen: string = START_FEN) {
    this.chess = new Chess(startFen);
    this.startFen = this.chess.fen();
  }

  /** Baut eine Partie aus Startstellung + UCI-Zügen nach. Wirft bei einem illegalen Zug. */
  static fromUciMoves(startFen: string, moves: string[]): ChessGame {
    const game = new ChessGame(startFen);
    moves.forEach((uci, i) => {
      if (!game.moveUci(uci)) throw new Error(`Illegaler Zug ${i + 1}: ${uci}`);
    });
    return game;
  }

  get fen(): string {
    return this.chess.fen();
  }

  get turn(): Color {
    return this.chess.turn();
  }

  get ply(): number {
    return this.chess.history().length;
  }

  pieceAt(square: Square): BoardPiece | null {
    const p = this.chess.get(square);
    return p ? { square, color: p.color, type: p.type } : null;
  }

  pieces(): BoardPiece[] {
    const out: BoardPiece[] = [];
    for (const row of this.chess.board()) {
      for (const cell of row) if (cell) out.push({ square: cell.square, color: cell.color, type: cell.type });
    }
    return out;
  }

  /** Legale Zielfelder einer Figur. Umwandlungszüge werden zu einem Zielfeld zusammengefasst. */
  legalMovesFrom(square: Square): MoveOption[] {
    const byTarget = new Map<Square, MoveOption>();
    for (const m of this.chess.moves({ square, verbose: true })) {
      const existing = byTarget.get(m.to);
      if (existing) continue;
      byTarget.set(m.to, { to: m.to, isCapture: m.isCapture() || m.isEnPassant(), isPromotion: m.isPromotion() });
    }
    return [...byTarget.values()];
  }

  allLegalMoves(): MoveRecord[] {
    return this.chess.moves({ verbose: true }).map(toRecord);
  }

  isPromotionMove(from: Square, to: Square): boolean {
    return this.chess.moves({ square: from, verbose: true }).some((m) => m.to === to && m.isPromotion());
  }

  /** Führt einen Zug aus. Gibt null zurück, wenn der Zug illegal ist (Partie bleibt unverändert). */
  move(input: MoveInput): MoveRecord | null {
    try {
      const result = this.chess.move({ from: input.from, to: input.to, promotion: input.promotion });
      return toRecord(result);
    } catch {
      return null;
    }
  }

  moveUci(uci: string): MoveRecord | null {
    const input = parseUci(uci);
    return input ? this.move(input) : null;
  }

  undo(): MoveRecord | null {
    const m = this.chess.undo();
    return m ? toRecord(m) : null;
  }

  history(): MoveRecord[] {
    return this.chess.history({ verbose: true }).map(toRecord);
  }

  uciMoves(): string[] {
    return this.chess.history({ verbose: true }).map((m) => m.lan);
  }

  findKing(color: Color): Square | null {
    return this.chess.findPiece({ type: 'k', color })[0] ?? null;
  }

  /** Greifen Figuren von `by` das Feld an? */
  isAttacked(square: Square, by: Color): boolean {
    return this.chess.isAttacked(square, by);
  }

  attackers(square: Square, by: Color): Square[] {
    return this.chess.attackers(square, by);
  }

  status(): GameStatus {
    const turn = this.chess.turn();
    const inCheck = this.chess.inCheck();
    return {
      turn,
      inCheck,
      checkSquare: inCheck ? this.findKing(turn) : null,
      result: this.positionResult(),
    };
  }

  /** Ergebnis, das sich allein aus der Stellung ergibt. Matt hat Vorrang vor allen Remisregeln. */
  positionResult(): GameResult | null {
    const c = this.chess;
    if (c.isCheckmate()) return { winner: c.turn() === 'w' ? 'b' : 'w', reason: 'checkmate' };
    if (c.isStalemate()) return { winner: null, reason: 'stalemate' };
    if (c.isInsufficientMaterial()) return { winner: null, reason: 'insufficient-material' };
    if (c.isThreefoldRepetition()) return { winner: null, reason: 'threefold-repetition' };
    if (c.isDrawByFiftyMoves()) return { winner: null, reason: 'fifty-move-rule' };
    return null;
  }

  pgn(headers: Record<string, string> = {}): string {
    const copy = new Chess(this.startFen);
    if (this.startFen !== START_FEN) {
      copy.setHeader('SetUp', '1');
      copy.setHeader('FEN', this.startFen);
    }
    for (const [k, v] of Object.entries(headers)) copy.setHeader(k, v);
    for (const uci of this.uciMoves()) copy.move(parseUci(uci)!);
    return copy.pgn();
  }

  clone(): ChessGame {
    return ChessGame.fromUciMoves(this.startFen, this.uciMoves());
  }
}

/** Liest eine PGN-Partie ein. Gibt Startstellung + UCI-Züge zurück oder null bei Fehlern. */
export function parsePgn(pgn: string): { startFen: string; moves: string[] } | null {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const headers = chess.getHeaders();
    const startFen = headers.FEN && isValidFen(headers.FEN) ? headers.FEN : START_FEN;
    return { startFen, moves: chess.history({ verbose: true }).map((m) => m.lan) };
  } catch {
    return null;
  }
}
