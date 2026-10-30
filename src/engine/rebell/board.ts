/**
 * Stellung der eigenen Schach-KI: 0x88-Brett mit Figurenlisten, schnelles Ziehen und Zurücknehmen.
 * Feld = Reihe * 16 + Linie (a1 = 0, h8 = 119). Figur = Art | Farbe << 3, 0 = leer.
 * Züge sind Zahlen: von | nach << 7 | Umwandlung << 14 | Merkmal << 17.
 */
export const WHITE = 0;
export const BLACK = 1;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

const FLAG_EP = 1;
const FLAG_CASTLE = 2;
const FLAG_DOUBLE = 4;

const WK = 1;
const WQ = 2;
const BK = 4;
const BQ = 8;
const NO_EP = -1;

export const KNIGHT_DIRS = [31, 33, 14, 18, -31, -33, -14, -18];
export const BISHOP_DIRS = [15, 17, -15, -17];
export const ROOK_DIRS = [1, -1, 16, -16];
export const KING_DIRS = [1, -1, 16, -16, 15, 17, -15, -17];

export const moveFrom = (m: number) => m & 127;
export const moveTo = (m: number) => (m >> 7) & 127;
export const movePromo = (m: number) => (m >> 14) & 7;
const moveFlag = (m: number) => m >> 17;
const encode = (from: number, to: number, promo = 0, flag = 0) => from | (to << 7) | (promo << 14) | (flag << 17);

export const onBoard = (sq: number) => (sq & 0x88) === 0;

/** Rochaderechte, die übrig bleiben, wenn auf diesem Feld etwas passiert */
const CASTLE_MASK = new Uint8Array(128).fill(15);
CASTLE_MASK[0x00] = 15 & ~WQ;
CASTLE_MASK[0x07] = 15 & ~WK;
CASTLE_MASK[0x04] = 15 & ~(WK | WQ);
CASTLE_MASK[0x70] = 15 & ~BQ;
CASTLE_MASK[0x77] = 15 & ~BK;
CASTLE_MASK[0x74] = 15 & ~(BK | BQ);

// Zobrist-Schlüssel: fester Zufallsstrom, damit jeder Lauf dieselben Schlüssel hat
let seed = 0x2f6e2b1;
function random32(): number {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed | 0;
}
const randomTable = (n: number) => Int32Array.from({ length: n }, random32);
const Z_PIECE_LO = randomTable(16 * 128);
const Z_PIECE_HI = randomTable(16 * 128);
const Z_CASTLE_LO = randomTable(16);
const Z_CASTLE_HI = randomTable(16);
const Z_EP_LO = randomTable(8);
const Z_EP_HI = randomTable(8);
const Z_SIDE_LO = random32();
const Z_SIDE_HI = random32();

const MAX_HISTORY = 4096;
const PIECE_LETTERS = ' pnbrqk';

export class Position {
  readonly board = new Int8Array(128);
  /** Felder der Figuren: Weiß ab 0, Schwarz ab 16 */
  readonly list = new Int16Array(32);
  readonly count = new Int32Array(2);
  private readonly index = new Int8Array(128);
  readonly kingSq = new Int32Array(2);
  side = WHITE;
  castle = 0;
  ep = NO_EP;
  halfmove = 0;
  hashLo = 0;
  hashHi = 0;

  // Rücknahme-Stapel; zugleich Verlauf für die Stellungswiederholung
  private sp = 0;
  private readonly undoCastle = new Int8Array(MAX_HISTORY);
  private readonly undoEp = new Int16Array(MAX_HISTORY);
  private readonly undoHalf = new Int16Array(MAX_HISTORY);
  private readonly undoCaptured = new Int8Array(MAX_HISTORY);
  private readonly histLo = new Int32Array(MAX_HISTORY);
  private readonly histHi = new Int32Array(MAX_HISTORY);

  constructor(fen: string) {
    this.setFen(fen);
  }

  setFen(fen: string) {
    const [placement, side, castling, ep, half] = fen.trim().split(/\s+/);
    this.board.fill(0);
    this.count.fill(0);
    this.sp = 0;
    this.hashLo = 0;
    this.hashHi = 0;
    let rank = 7;
    let file = 0;
    for (const ch of placement) {
      if (ch === '/') {
        rank--;
        file = 0;
      } else if (ch >= '1' && ch <= '8') {
        file += Number(ch);
      } else {
        const lower = ch.toLowerCase();
        const type = PIECE_LETTERS.indexOf(lower);
        this.put(rank * 16 + file, type | ((ch === lower ? BLACK : WHITE) << 3));
        file++;
      }
    }
    this.side = side === 'b' ? BLACK : WHITE;
    this.castle = 0;
    if (castling?.includes('K')) this.castle |= WK;
    if (castling?.includes('Q')) this.castle |= WQ;
    if (castling?.includes('k')) this.castle |= BK;
    if (castling?.includes('q')) this.castle |= BQ;
    this.ep = ep && ep !== '-' ? (ep.charCodeAt(1) - 49) * 16 + (ep.charCodeAt(0) - 97) : NO_EP;
    this.halfmove = Number(half) || 0;
    if (this.side === BLACK) this.flipHashSide();
    this.hashLo ^= Z_CASTLE_LO[this.castle];
    this.hashHi ^= Z_CASTLE_HI[this.castle];
    if (this.ep !== NO_EP) {
      this.hashLo ^= Z_EP_LO[this.ep & 7];
      this.hashHi ^= Z_EP_HI[this.ep & 7];
    }
  }

  private flipHashSide() {
    this.hashLo ^= Z_SIDE_LO;
    this.hashHi ^= Z_SIDE_HI;
  }

  private hashPiece(piece: number, sq: number) {
    const key = piece * 128 + sq;
    this.hashLo ^= Z_PIECE_LO[key];
    this.hashHi ^= Z_PIECE_HI[key];
  }

  private put(sq: number, piece: number) {
    const color = piece >> 3;
    const i = this.count[color]++;
    this.list[color * 16 + i] = sq;
    this.index[sq] = i;
    this.board[sq] = piece;
    if ((piece & 7) === KING) this.kingSq[color] = sq;
    this.hashPiece(piece, sq);
  }

  private take(sq: number) {
    const piece = this.board[sq];
    const color = piece >> 3;
    const i = this.index[sq];
    const lastSq = this.list[color * 16 + --this.count[color]];
    this.list[color * 16 + i] = lastSq;
    this.index[lastSq] = i;
    this.board[sq] = 0;
    this.hashPiece(piece, sq);
  }

  private shift(from: number, to: number) {
    const piece = this.board[from];
    const color = piece >> 3;
    const i = this.index[from];
    this.list[color * 16 + i] = to;
    this.index[to] = i;
    this.board[from] = 0;
    this.board[to] = piece;
    if ((piece & 7) === KING) this.kingSq[color] = to;
    this.hashPiece(piece, from);
    this.hashPiece(piece, to);
  }

  /** Greift `by` das Feld `sq` an? */
  attacked(sq: number, by: number): boolean {
    const b = this.board;
    const pawn = PAWN | (by << 3);
    const back = by === WHITE ? -16 : 16;
    let t = sq + back - 1;
    if (onBoard(t) && b[t] === pawn) return true;
    t = sq + back + 1;
    if (onBoard(t) && b[t] === pawn) return true;
    const knight = KNIGHT | (by << 3);
    for (let i = 0; i < 8; i++) {
      t = sq + KNIGHT_DIRS[i];
      if (onBoard(t) && b[t] === knight) return true;
    }
    const king = KING | (by << 3);
    for (let i = 0; i < 8; i++) {
      t = sq + KING_DIRS[i];
      if (onBoard(t) && b[t] === king) return true;
    }
    const bishop = BISHOP | (by << 3);
    const rook = ROOK | (by << 3);
    const queen = QUEEN | (by << 3);
    for (let i = 0; i < 4; i++) {
      const d = BISHOP_DIRS[i];
      for (t = sq + d; onBoard(t); t += d) {
        const p = b[t];
        if (p) {
          if (p === bishop || p === queen) return true;
          break;
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const d = ROOK_DIRS[i];
      for (t = sq + d; onBoard(t); t += d) {
        const p = b[t];
        if (p) {
          if (p === rook || p === queen) return true;
          break;
        }
      }
    }
    return false;
  }

  inCheck(): boolean {
    return this.attacked(this.kingSq[this.side], this.side ^ 1);
  }

  /**
   * Erzeugt alle Züge (ohne Prüfung, ob der eigene König danach im Schach steht) ab `out[start]`.
   * `tactical`: nur Schlagzüge und Damenumwandlungen. Gibt das Ende zurück.
   */
  generate(out: Int32Array, start: number, tactical: boolean): number {
    const b = this.board;
    const us = this.side;
    const them = us ^ 1;
    let n = start;
    const count = this.count[us];
    for (let i = 0; i < count; i++) {
      const from = this.list[us * 16 + i];
      const type = b[from] & 7;
      if (type === PAWN) {
        n = this.pawnMoves(out, n, from, tactical);
      } else if (type === KNIGHT || type === KING) {
        const dirs = type === KNIGHT ? KNIGHT_DIRS : KING_DIRS;
        for (let d = 0; d < 8; d++) {
          const to = from + dirs[d];
          if (!onBoard(to)) continue;
          const p = b[to];
          if (p ? p >> 3 === them : !tactical) out[n++] = encode(from, to);
        }
      } else {
        const dirs = type === BISHOP ? BISHOP_DIRS : type === ROOK ? ROOK_DIRS : KING_DIRS;
        for (let d = 0; d < dirs.length; d++) {
          const step = dirs[d];
          for (let to = from + step; onBoard(to); to += step) {
            const p = b[to];
            if (p) {
              if (p >> 3 === them) out[n++] = encode(from, to);
              break;
            }
            if (!tactical) out[n++] = encode(from, to);
          }
        }
      }
    }
    if (!tactical) n = this.castleMoves(out, n);
    return n;
  }

  private pawnMoves(out: Int32Array, start: number, from: number, tactical: boolean): number {
    const b = this.board;
    const us = this.side;
    const up = us === WHITE ? 16 : -16;
    const promoRank = us === WHITE ? 7 : 0;
    const startRank = us === WHITE ? 1 : 6;
    let n = start;
    const addPawn = (to: number) => {
      if (to >> 4 === promoRank) {
        out[n++] = encode(from, to, QUEEN);
        if (!tactical) {
          out[n++] = encode(from, to, ROOK);
          out[n++] = encode(from, to, BISHOP);
          out[n++] = encode(from, to, KNIGHT);
        }
      } else {
        out[n++] = encode(from, to);
      }
    };
    const one = from + up;
    if (!b[one]) {
      if (!tactical || one >> 4 === promoRank) addPawn(one);
      if (!tactical && from >> 4 === startRank && !b[one + up]) out[n++] = encode(from, one + up, 0, FLAG_DOUBLE);
    }
    for (let side = -1; side <= 1; side += 2) {
      const to = one + side;
      if (!onBoard(to)) continue;
      if (b[to]) {
        if (b[to] >> 3 !== us) addPawn(to);
      } else if (to === this.ep) {
        out[n++] = encode(from, to, 0, FLAG_EP);
      }
    }
    return n;
  }

  private castleMoves(out: Int32Array, start: number): number {
    const b = this.board;
    const us = this.side;
    const them = us ^ 1;
    const home = us === WHITE ? 0x04 : 0x74;
    const kingside = us === WHITE ? WK : BK;
    const queenside = us === WHITE ? WQ : BQ;
    let n = start;
    if (!(this.castle & (kingside | queenside)) || this.attacked(home, them)) return n;
    if (this.castle & kingside && !b[home + 1] && !b[home + 2] && !this.attacked(home + 1, them)) {
      out[n++] = encode(home, home + 2, 0, FLAG_CASTLE);
    }
    if (this.castle & queenside && !b[home - 1] && !b[home - 2] && !b[home - 3] && !this.attacked(home - 1, them)) {
      out[n++] = encode(home, home - 2, 0, FLAG_CASTLE);
    }
    return n;
  }

  /** Führt den Zug aus. false = er war nicht erlaubt (eigener König im Schach), die Stellung ist dann unverändert. */
  make(move: number): boolean {
    const from = moveFrom(move);
    const to = moveTo(move);
    const promo = movePromo(move);
    const flag = moveFlag(move);
    const us = this.side;
    const piece = this.board[from];
    const captured = flag === FLAG_EP ? PAWN | ((us ^ 1) << 3) : this.board[to];
    const sp = this.sp;
    this.undoCastle[sp] = this.castle;
    this.undoEp[sp] = this.ep;
    this.undoHalf[sp] = this.halfmove;
    this.undoCaptured[sp] = captured;
    this.histLo[sp] = this.hashLo;
    this.histHi[sp] = this.hashHi;
    this.sp = sp + 1;

    if (this.ep !== NO_EP) {
      this.hashLo ^= Z_EP_LO[this.ep & 7];
      this.hashHi ^= Z_EP_HI[this.ep & 7];
      this.ep = NO_EP;
    }
    this.hashLo ^= Z_CASTLE_LO[this.castle];
    this.hashHi ^= Z_CASTLE_HI[this.castle];

    if (flag === FLAG_EP) this.take(to + (us === WHITE ? -16 : 16));
    else if (captured) this.take(to);
    this.shift(from, to);
    if (promo) {
      this.take(to);
      this.put(to, promo | (us << 3));
    }
    if (flag === FLAG_CASTLE) {
      if (to > from) this.shift(to + 1, to - 1);
      else this.shift(to - 2, to + 1);
    }

    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.hashLo ^= Z_CASTLE_LO[this.castle];
    this.hashHi ^= Z_CASTLE_HI[this.castle];
    this.halfmove = captured || (piece & 7) === PAWN ? 0 : this.halfmove + 1;
    if (flag === FLAG_DOUBLE) {
      // Nur eintragen, wenn wirklich ein Bauer schlagen könnte: sonst zählt die Stellung als neu
      const enemy = PAWN | ((us ^ 1) << 3);
      if ((onBoard(to - 1) && this.board[to - 1] === enemy) || (onBoard(to + 1) && this.board[to + 1] === enemy)) {
        this.ep = (from + to) >> 1;
        this.hashLo ^= Z_EP_LO[this.ep & 7];
        this.hashHi ^= Z_EP_HI[this.ep & 7];
      }
    }
    this.side = us ^ 1;
    this.flipHashSide();

    if (this.attacked(this.kingSq[us], us ^ 1)) {
      this.unmake(move);
      return false;
    }
    return true;
  }

  unmake(move: number) {
    const from = moveFrom(move);
    const to = moveTo(move);
    const promo = movePromo(move);
    const flag = moveFlag(move);
    const us = this.side ^ 1;
    const sp = --this.sp;
    this.side = us;
    if (flag === FLAG_CASTLE) {
      if (to > from) this.shift(to - 1, to + 1);
      else this.shift(to + 1, to - 2);
    }
    if (promo) {
      this.take(to);
      this.put(to, PAWN | (us << 3));
    }
    this.shift(to, from);
    const captured = this.undoCaptured[sp];
    if (flag === FLAG_EP) this.put(to + (us === WHITE ? -16 : 16), captured);
    else if (captured) this.put(to, captured);
    this.castle = this.undoCastle[sp];
    this.ep = this.undoEp[sp];
    this.halfmove = this.undoHalf[sp];
    this.hashLo = this.histLo[sp];
    this.hashHi = this.histHi[sp];
  }

  /** Zug aussetzen (für die Nullzug-Suche); nur erlaubt, wenn man nicht im Schach steht */
  makeNull() {
    const sp = this.sp;
    this.undoCastle[sp] = this.castle;
    this.undoEp[sp] = this.ep;
    this.undoHalf[sp] = this.halfmove;
    this.undoCaptured[sp] = 0;
    this.histLo[sp] = this.hashLo;
    this.histHi[sp] = this.hashHi;
    this.sp = sp + 1;
    if (this.ep !== NO_EP) {
      this.hashLo ^= Z_EP_LO[this.ep & 7];
      this.hashHi ^= Z_EP_HI[this.ep & 7];
      this.ep = NO_EP;
    }
    this.halfmove = 0; // Der Nullzug unterbricht die Wiederholungssuche
    this.side ^= 1;
    this.flipHashSide();
  }

  unmakeNull() {
    const sp = --this.sp;
    this.side ^= 1;
    this.castle = this.undoCastle[sp];
    this.ep = this.undoEp[sp];
    this.halfmove = this.undoHalf[sp];
    this.hashLo = this.histLo[sp];
    this.hashHi = this.histHi[sp];
  }

  /** Remis durch Wiederholung, 50-Züge-Regel oder zu wenig Material */
  isDraw(): boolean {
    if (this.halfmove >= 100) return true;
    const oldest = Math.max(0, this.sp - this.halfmove);
    for (let i = this.sp - 2; i >= oldest; i -= 2) {
      if (this.histLo[i] === this.hashLo && this.histHi[i] === this.hashHi) return true;
    }
    return this.insufficientMaterial();
  }

  private insufficientMaterial(): boolean {
    const total = this.count[0] + this.count[1];
    if (total > 3) return false;
    if (total === 2) return true;
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < this.count[c]; i++) {
        const type = this.board[this.list[c * 16 + i]] & 7;
        if (type !== KING && type !== KNIGHT && type !== BISHOP) return false;
      }
    }
    return true;
  }

  /** Hat die Seite am Zug noch andere Figuren als Bauern und König? (Sonst ist die Nullzug-Suche unsicher) */
  hasPieces(): boolean {
    const us = this.side;
    for (let i = 0; i < this.count[us]; i++) {
      const type = this.board[this.list[us * 16 + i]] & 7;
      if (type !== PAWN && type !== KING) return true;
    }
    return false;
  }

  /** Alle erlaubten Züge */
  legalMoves(): number[] {
    const buffer = new Int32Array(256);
    const end = this.generate(buffer, 0, false);
    const legal: number[] = [];
    for (let i = 0; i < end; i++) {
      if (this.make(buffer[i])) {
        this.unmake(buffer[i]);
        legal.push(buffer[i]);
      }
    }
    return legal;
  }

  /** Spielt einen Zug in Langschrift (e2e4, e7e8q). false = nicht erlaubt. */
  playUci(uci: string): boolean {
    const move = this.legalMoves().find((m) => moveToUci(m) === uci);
    return move !== undefined && this.make(move);
  }
}

const squareName = (sq: number) => String.fromCharCode(97 + (sq & 7)) + String.fromCharCode(49 + (sq >> 4));

export function moveToUci(move: number): string {
  const promo = movePromo(move);
  return squareName(moveFrom(move)) + squareName(moveTo(move)) + (promo ? PIECE_LETTERS[promo] : '');
}
