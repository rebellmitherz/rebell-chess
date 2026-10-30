import {
  BISHOP,
  BISHOP_DIRS,
  BLACK,
  KING,
  KING_DIRS,
  KNIGHT,
  KNIGHT_DIRS,
  onBoard,
  PAWN,
  ROOK,
  ROOK_DIRS,
  WHITE,
  type Position,
} from './board';

/**
 * Stellungsbewertung in Centipawns aus Sicht der Seite am Zug. Mittelspiel- und Endspielwert werden
 * nach dem verbliebenen Material überblendet. Alle Zahlen sind von Hand gesetzt.
 */
const VALUE_MG = [0, 85, 340, 350, 480, 1000, 0];
const VALUE_EG = [0, 105, 300, 315, 530, 970, 0];
const PHASE_WEIGHT = [0, 0, 1, 1, 2, 4, 0];
const FULL_PHASE = 24;

/** Wert einer Figurenart für die Zugsortierung */
export const PIECE_VALUE = VALUE_MG;

// Tabellen aus Sicht von Weiß, oben steht die 8. Reihe
const PAWN_MG = [
  0, 0, 0, 0, 0, 0, 0, 0,
  60, 60, 60, 65, 65, 60, 60, 60,
  20, 25, 30, 40, 40, 30, 25, 20,
  5, 10, 12, 25, 25, 12, 10, 5,
  0, 0, 8, 22, 22, 2, 0, 0,
  4, 2, 0, 5, 5, -8, 2, 4,
  4, 8, 6, -18, -18, 12, 10, 2,
  0, 0, 0, 0, 0, 0, 0, 0,
];
const PAWN_EG = [
  0, 0, 0, 0, 0, 0, 0, 0,
  85, 85, 80, 75, 75, 80, 85, 85,
  55, 55, 50, 45, 45, 50, 55, 55,
  28, 26, 22, 18, 18, 22, 26, 28,
  14, 12, 8, 6, 6, 8, 12, 14,
  6, 6, 4, 6, 6, 4, 6, 6,
  8, 8, 8, 8, 8, 8, 8, 8,
  0, 0, 0, 0, 0, 0, 0, 0,
];
const KNIGHT_MG = [
  -60, -40, -30, -25, -25, -30, -40, -60,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -28, 5, 15, 20, 20, 15, 5, -28,
  -24, 8, 20, 28, 28, 20, 8, -24,
  -24, 2, 16, 22, 22, 16, 2, -24,
  -28, 4, 12, 14, 14, 12, 4, -28,
  -40, -20, 0, 4, 4, 0, -20, -40,
  -55, -30, -28, -24, -24, -28, -30, -55,
];
const KNIGHT_EG = [
  -45, -30, -20, -15, -15, -20, -30, -45,
  -30, -12, -2, 2, 2, -2, -12, -30,
  -20, 0, 8, 12, 12, 8, 0, -20,
  -15, 4, 14, 18, 18, 14, 4, -15,
  -15, 4, 14, 18, 18, 14, 4, -15,
  -20, 0, 8, 12, 12, 8, 0, -20,
  -30, -12, -2, 2, 2, -2, -12, -30,
  -45, -30, -20, -15, -15, -20, -30, -45,
];
const BISHOP_MG = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 2, 6, 8, 8, 6, 2, -10,
  -10, 8, 8, 12, 12, 8, 8, -10,
  -10, 3, 12, 12, 12, 12, 3, -10,
  -8, 12, 10, 10, 10, 10, 12, -8,
  -8, 14, 4, 6, 6, 4, 14, -8,
  -20, -8, -14, -8, -8, -14, -8, -20,
];
const BISHOP_EG = [
  -14, -8, -6, -4, -4, -6, -8, -14,
  -8, 0, 2, 3, 3, 2, 0, -8,
  -6, 2, 6, 7, 7, 6, 2, -6,
  -4, 3, 7, 10, 10, 7, 3, -4,
  -4, 3, 7, 10, 10, 7, 3, -4,
  -6, 2, 6, 7, 7, 6, 2, -6,
  -8, 0, 2, 3, 3, 2, 0, -8,
  -14, -8, -6, -4, -4, -6, -8, -14,
];
const ROOK_MG = [
  6, 8, 10, 12, 12, 10, 8, 6,
  16, 20, 22, 24, 24, 22, 20, 16,
  -4, 2, 4, 6, 6, 4, 2, -4,
  -8, 0, 0, 2, 2, 0, 0, -8,
  -10, -2, 0, 0, 0, 0, -2, -10,
  -12, -4, 0, 0, 0, 0, -4, -12,
  -14, -6, -2, 0, 0, -2, -6, -18,
  -4, -2, 4, 10, 10, 6, -6, -6,
];
const ROOK_EG = [
  8, 8, 8, 8, 8, 8, 8, 8,
  12, 12, 12, 12, 12, 12, 12, 12,
  4, 4, 4, 4, 4, 4, 4, 4,
  2, 2, 2, 2, 2, 2, 2, 2,
  0, 0, 0, 0, 0, 0, 0, 0,
  -2, -2, -2, -2, -2, -2, -2, -2,
  -4, -4, -4, -4, -4, -4, -4, -4,
  -4, -2, 0, 0, 0, 0, -2, -4,
];
const QUEEN_MG = [
  -12, -6, -4, -2, -2, -4, -6, -12,
  -8, -6, 0, 0, 0, 0, -6, -8,
  -6, 0, 4, 4, 4, 4, 0, -6,
  -4, 0, 4, 6, 6, 4, 0, -4,
  -2, 0, 4, 6, 6, 4, 0, -4,
  -6, 4, 4, 4, 4, 4, 2, -6,
  -8, 0, 4, 2, 2, 0, 0, -8,
  -12, -8, -4, 2, -2, -6, -8, -12,
];
const QUEEN_EG = [
  -14, -8, -6, -4, -4, -6, -8, -14,
  -8, 0, 4, 6, 6, 4, 0, -8,
  -6, 4, 10, 12, 12, 10, 4, -6,
  -4, 6, 12, 16, 16, 12, 6, -4,
  -4, 6, 12, 16, 16, 12, 6, -4,
  -6, 4, 10, 12, 12, 10, 4, -6,
  -8, 0, 4, 6, 6, 4, 0, -8,
  -14, -8, -6, -4, -4, -6, -8, -14,
];
const KING_MG = [
  -50, -55, -55, -60, -60, -55, -55, -50,
  -45, -50, -50, -55, -55, -50, -50, -45,
  -40, -45, -45, -50, -50, -45, -45, -40,
  -35, -40, -40, -45, -45, -40, -40, -35,
  -25, -30, -30, -35, -35, -30, -30, -25,
  -12, -20, -20, -25, -25, -20, -20, -12,
  12, 12, -6, -14, -14, -6, 12, 12,
  18, 30, 12, -8, 0, -4, 30, 20,
];
const KING_EG = [
  -55, -35, -25, -15, -15, -25, -35, -55,
  -28, -8, 2, 8, 8, 2, -8, -28,
  -20, 8, 20, 26, 26, 20, 8, -20,
  -16, 12, 26, 32, 32, 26, 12, -16,
  -18, 8, 22, 28, 28, 22, 8, -18,
  -22, 0, 12, 18, 18, 12, 0, -22,
  -30, -12, -2, 4, 4, -2, -12, -30,
  -50, -34, -24, -18, -18, -24, -34, -50,
];

const TABLES_MG = [[], PAWN_MG, KNIGHT_MG, BISHOP_MG, ROOK_MG, QUEEN_MG, KING_MG];
const TABLES_EG = [[], PAWN_EG, KNIGHT_EG, BISHOP_EG, ROOK_EG, QUEEN_EG, KING_EG];

/** Wert einer Figur auf einem Feld inklusive Material: Index Farbe << 3 | Art, dann Feld */
const SQUARE_MG = new Int16Array(16 * 128);
const SQUARE_EG = new Int16Array(16 * 128);
for (let color = WHITE; color <= BLACK; color++) {
  for (let type = PAWN; type <= KING; type++) {
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const row = color === WHITE ? 7 - rank : rank;
        const key = ((color << 3) | type) * 128 + rank * 16 + file;
        SQUARE_MG[key] = VALUE_MG[type] + TABLES_MG[type][row * 8 + file];
        SQUARE_EG[key] = VALUE_EG[type] + TABLES_EG[type][row * 8 + file];
      }
    }
  }
}

const PASSED_MG = [0, 2, 5, 12, 25, 45, 75, 0];
const PASSED_EG = [0, 8, 15, 30, 55, 90, 140, 0];
/** Bewegliche Felder: Mittelwert und Wert pro Feld */
const MOBILITY_BASE = [0, 0, 4, 6, 7, 13, 0];
const MOBILITY_MG = [0, 0, 4, 4, 2, 1, 0];
const MOBILITY_EG = [0, 0, 4, 4, 3, 2, 0];
const KING_ATTACK_WEIGHT = [0, 0, 2, 2, 3, 5, 0];

/** Felder neben dem König, nachgeschlagen über die 0x88-Differenz */
const NEAR_KING = new Uint8Array(256);
for (const d of [0, ...KING_DIRS]) NEAR_KING[d + 128] = 1;

const distance = (a: number, b: number) => Math.max(Math.abs((a >> 4) - (b >> 4)), Math.abs((a & 7) - (b & 7)));

// Wiederverwendete Puffer (die Bewertung läuft pro Suchknoten)
const pawnsOnFile = new Int8Array(16);
const highestPawn = new Int8Array(16);
const lowestPawn = new Int8Array(16);
const score = new Int32Array(4); // mg/eg je Farbe

function addPawnStructure(pos: Position, color: number) {
  const enemy = color ^ 1;
  const ownKing = pos.kingSq[color];
  const enemyKing = pos.kingSq[enemy];
  let mg = 0;
  let eg = 0;
  for (let i = 0; i < pos.count[color]; i++) {
    const sq = pos.list[color * 16 + i];
    if ((pos.board[sq] & 7) !== PAWN) continue;
    const file = sq & 7;
    const rank = sq >> 4;
    const left = file > 0 ? pawnsOnFile[color * 8 + file - 1] : 0;
    const right = file < 7 ? pawnsOnFile[color * 8 + file + 1] : 0;
    if (!left && !right) {
      mg -= 12;
      eg -= 14;
    }
    if (pawnsOnFile[color * 8 + file] > 1) {
      mg -= 7;
      eg -= 14;
    }
    let passed = true;
    for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1) && passed; f++) {
      if (!pawnsOnFile[enemy * 8 + f]) continue;
      passed = color === WHITE ? highestPawn[enemy * 8 + f] <= rank : lowestPawn[enemy * 8 + f] >= rank;
    }
    if (passed) {
      const steps = color === WHITE ? rank : 7 - rank;
      mg += PASSED_MG[steps];
      eg += PASSED_EG[steps];
      // Im Endspiel zählt, welcher König näher am Umwandlungsweg steht
      const stop = sq + (color === WHITE ? 16 : -16);
      eg += ((distance(enemyKing, stop) * 4 - distance(ownKing, stop) * 2) * steps) >> 1;
    }
  }
  score[color * 2] += mg;
  score[color * 2 + 1] += eg;
}

function addPieceActivity(pos: Position, color: number) {
  const b = pos.board;
  const enemy = color ^ 1;
  const enemyKing = pos.kingSq[enemy];
  let mg = 0;
  let eg = 0;
  let attackers = 0;
  let attackWeight = 0;
  let bishops = 0;
  for (let i = 0; i < pos.count[color]; i++) {
    const sq = pos.list[color * 16 + i];
    const type = b[sq] & 7;
    if (type === PAWN || type === KING) continue;
    let moves = 0;
    let nearKing = false;
    if (type === KNIGHT) {
      for (let d = 0; d < 8; d++) {
        const to = sq + KNIGHT_DIRS[d];
        if (!onBoard(to)) continue;
        if (!b[to] || b[to] >> 3 === enemy) moves++;
        if (NEAR_KING[to - enemyKing + 128]) nearKing = true;
      }
    } else {
      const dirs = type === BISHOP ? BISHOP_DIRS : type === ROOK ? ROOK_DIRS : KING_DIRS;
      for (let d = 0; d < dirs.length; d++) {
        const step = dirs[d];
        for (let to = sq + step; onBoard(to); to += step) {
          if (NEAR_KING[to - enemyKing + 128]) nearKing = true;
          const p = b[to];
          if (p) {
            if (p >> 3 === enemy) moves++;
            break;
          }
          moves++;
        }
      }
    }
    mg += (moves - MOBILITY_BASE[type]) * MOBILITY_MG[type];
    eg += (moves - MOBILITY_BASE[type]) * MOBILITY_EG[type];
    if (nearKing) {
      attackers++;
      attackWeight += KING_ATTACK_WEIGHT[type];
    }
    if (type === BISHOP) bishops++;
    if (type === ROOK) {
      const file = sq & 7;
      if (!pawnsOnFile[color * 8 + file]) {
        const open = !pawnsOnFile[enemy * 8 + file];
        mg += open ? 20 : 9;
        eg += open ? 8 : 4;
      }
    }
  }
  if (bishops >= 2) {
    mg += 25;
    eg += 40;
  }
  // Mehrere Angreifer am König sind weit gefährlicher als einer
  if (attackers >= 2) mg += (attackWeight * attackWeight * attackers) >> 2;
  score[color * 2] += mg;
  score[color * 2 + 1] += eg;
}

/** Bauernschild: eine Linie ohne eigenen Bauern neben dem König kostet im Mittelspiel */
function addKingShelter(pos: Position, color: number) {
  const king = pos.kingSq[color];
  const file = king & 7;
  const relativeRank = color === WHITE ? king >> 4 : 7 - (king >> 4);
  if (relativeRank > 2) {
    score[color * 2] -= 30;
    return;
  }
  let open = 0;
  for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
    if (!pawnsOnFile[color * 8 + f]) open++;
  }
  score[color * 2] -= open * 16;
}

export function evaluate(pos: Position): number {
  const b = pos.board;
  pawnsOnFile.fill(0);
  highestPawn.fill(-1);
  lowestPawn.fill(8);
  score.fill(0);
  let phase = 0;
  for (let color = WHITE; color <= BLACK; color++) {
    for (let i = 0; i < pos.count[color]; i++) {
      const sq = pos.list[color * 16 + i];
      const piece = b[sq];
      const key = piece * 128 + sq;
      score[color * 2] += SQUARE_MG[key];
      score[color * 2 + 1] += SQUARE_EG[key];
      const type = piece & 7;
      phase += PHASE_WEIGHT[type];
      if (type === PAWN) {
        const slot = color * 8 + (sq & 7);
        const rank = sq >> 4;
        pawnsOnFile[slot]++;
        if (rank > highestPawn[slot]) highestPawn[slot] = rank;
        if (rank < lowestPawn[slot]) lowestPawn[slot] = rank;
      }
    }
  }
  for (let color = WHITE; color <= BLACK; color++) {
    addPawnStructure(pos, color);
    addPieceActivity(pos, color);
    addKingShelter(pos, color);
  }
  let mg = score[0] - score[2];
  let eg = score[1] - score[3];

  // Blanker König: an den Rand drängen, eigenen König heranholen
  for (let loser = WHITE; loser <= BLACK; loser++) {
    if (pos.count[loser] !== 1) continue;
    const king = pos.kingSq[loser];
    const edge = Math.max(3 - (king >> 4), (king >> 4) - 4) + Math.max(3 - (king & 7), (king & 7) - 4);
    const mopUp = edge * 14 + (14 - 2 * distance(king, pos.kingSq[loser ^ 1])) * 5;
    eg += loser === WHITE ? -mopUp : mopUp;
  }

  const p = Math.min(phase, FULL_PHASE);
  const white = (mg * p + eg * (FULL_PHASE - p)) / FULL_PHASE;
  const tempo = 10;
  return Math.round((pos.side === WHITE ? white : -white) + tempo);
}
