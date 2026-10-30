import { Position } from './board';

/**
 * Kleines Eröffnungsbuch: bekannte Hauptzüge, damit die KI abwechslungsreich und ohne Rechenzeit beginnt.
 * Zugfolgen, die mehrfach vorkommen, werden entsprechend häufiger gewählt.
 */
const LINES = [
  'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7',
  'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3 d7d6',
  'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 b1c3 f8b4',
  'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d6d5',
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6',
  'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5',
  'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3 d8c7',
  'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 d2d3 d7d6',
  'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7',
  'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6',
  'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2 e8g8',
  'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8',
  'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5',
  'd2d4 d7d5 g1f3 g8f6 c2c4 e7e6 b1c3 c7c6 e2e3 b8d7',
  'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5',
  'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2 f8e7',
  'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8',
  'g1f3 d7d5 g2g3 g8f6 f1g2 e7e6 e1g1 f8e7 d2d3 e8g8',
  'g1f3 g8f6 c2c4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7',
  'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5 f6d5',
  'c2c4 c7c5 g1f3 g8f6 b1c3 b8c6 g2g3 d7d5 c4d5 f6d5',
];

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Schlüssel einer Stellung: Figuren, Seite, Rochade (ohne Zugzähler) */
const bookKey = (fen: string) => fen.split(' ').slice(0, 3).join(' ');

let book: Map<string, string[]> | null = null;

/** Stellungsschlüssel als FEN-Anfang: dafür die Figuren aus dem Brett zurückschreiben */
function placementOf(pos: Position): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = pos.board[rank * 16 + file];
      if (!piece) {
        empty++;
        continue;
      }
      if (empty) row += empty;
      empty = 0;
      const letter = ' pnbrqk'[piece & 7];
      row += piece >> 3 ? letter : letter.toUpperCase();
    }
    rows.push(row + (empty || ''));
  }
  const castling = (pos.castle & 1 ? 'K' : '') + (pos.castle & 2 ? 'Q' : '') + (pos.castle & 4 ? 'k' : '') + (pos.castle & 8 ? 'q' : '');
  return `${rows.join('/')} ${pos.side ? 'b' : 'w'} ${castling || '-'}`;
}

function buildBook(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of LINES) {
    const pos = new Position(START);
    for (const uci of line.split(' ')) {
      const key = placementOf(pos);
      if (!pos.playUci(uci)) throw new Error(`Eröffnungsbuch: unerlaubter Zug ${uci} in „${line}“`);
      const moves = map.get(key);
      if (moves) moves.push(uci);
      else map.set(key, [uci]);
    }
  }
  return map;
}

/** Zug aus dem Buch für diese Stellung, sonst null */
export function bookMove(fen: string, random: () => number): string | null {
  book ??= buildBook();
  const moves = book.get(bookKey(fen));
  return moves ? moves[Math.floor(random() * moves.length)] : null;
}
