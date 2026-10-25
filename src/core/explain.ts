import { ChessGame, type MoveInput } from './chessGame';
import { PIECE_VALUES, opposite, type MoveRecord, type PieceSymbol, type Square } from './types';

export const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'Bauer',
  n: 'Springer',
  b: 'Läufer',
  r: 'Turm',
  q: 'Dame',
  k: 'König',
};

/** Akkusativ mit Artikel: „den Springer“, „die Dame“ */
export const PIECE_ACCUSATIVE: Record<PieceSymbol, string> = {
  p: 'den Bauern',
  n: 'den Springer',
  b: 'den Läufer',
  r: 'den Turm',
  q: 'die Dame',
  k: 'den König',
};

/** „von einem Bauern“, „von einer Dame“ */
const BY_PIECE: Record<PieceSymbol, string> = {
  p: 'von einem Bauern',
  n: 'von einem Springer',
  b: 'von einem Läufer',
  r: 'von einem Turm',
  q: 'von der Dame',
  k: 'vom König',
};

const CENTER: Square[] = ['d4', 'e4', 'd5', 'e5'];
const EXTENDED_CENTER: Square[] = ['c3', 'd3', 'e3', 'f3', 'c4', 'f4', 'c5', 'f5', 'c6', 'd6', 'e6', 'f6'];

/** „Springer g1–f3“, „Bauer e7×d6“, „Bauer a7–a8 (Dame)“ */
export function describeMove(
  move: Pick<MoveRecord, 'piece' | 'from' | 'to' | 'isCapture' | 'isKingsideCastle' | 'isQueensideCastle'> & { promotion?: PieceSymbol },
): string {
  if (move.isKingsideCastle) return 'Kurze Rochade (0-0)';
  if (move.isQueensideCastle) return 'Lange Rochade (0-0-0)';
  const promo = move.promotion ? ` (${PIECE_NAMES[move.promotion]})` : '';
  return `${PIECE_NAMES[move.piece]} ${move.from}${move.isCapture ? '×' : '–'}${move.to}${promo}`;
}

/**
 * Verständliche Erklärung eines Zuges in der Stellung `fenBefore`.
 * Liefert kurze Sätze, wichtigste zuerst; Warnungen stehen am Ende.
 * `suggested`: der Zug ist ein Engine-Vorschlag – ein ungedeckter Stein ist dann ein bewusstes Angebot.
 * Gibt null zurück, wenn der Zug illegal ist.
 */
export function explainMove(
  fenBefore: string,
  input: MoveInput,
  options: { suggested?: boolean } = {},
): { title: string; points: string[] } | null {
  const game = new ChessGame(fenBefore);
  const moveNumber = Number(fenBefore.split(' ')[5] ?? '1');
  const castlingBefore = fenBefore.split(' ')[2] ?? '-';
  const move = game.move(input);
  if (!move) return null;

  const me = move.color;
  const them = opposite(me);
  const points: string[] = [];
  const warnings: string[] = [];

  if (move.isCheckmate) points.push('Schachmatt – der gegnerische König kann nicht mehr entkommen.');
  else if (move.isCheck) points.push('Gibt Schach: Der Gegner muss zuerst seinen König in Sicherheit bringen.');

  if (move.isKingsideCastle || move.isQueensideCastle) {
    points.push('Rochade: Der König kommt in Sicherheit und der Turm wird aktiv.');
  }

  if (move.promotion) {
    points.push(`Umwandlung: Der Bauer wird zu ${move.promotion === 'q' ? 'einer Dame' : `einem ${PIECE_NAMES[move.promotion]}`}.`);
  }

  if (move.isEnPassant) {
    points.push('Schlägt den Bauern „en passant“ (im Vorbeigehen) – nur direkt nach dessen Doppelschritt erlaubt.');
  } else if (move.captured) {
    const gain = PIECE_VALUES[move.captured] - PIECE_VALUES[move.piece];
    const defended = game.attackers(move.to, them).length > 0;
    if (!defended) points.push(`Schlägt ${PIECE_ACCUSATIVE[move.captured]} auf ${move.to} und gewinnt Material.`);
    else if (gain > 0) points.push(`Schlägt ${PIECE_ACCUSATIVE[move.captured]} auf ${move.to} – ein vorteilhafter Abtausch.`);
    else points.push(`Schlägt ${PIECE_ACCUSATIVE[move.captured]} auf ${move.to} (Abtausch).`);
  }

  // Bedrohte gegnerische Figuren durch die gezogene Figur
  const threatened = game
    .pieces()
    .filter((p) => p.color === them && p.type !== 'k')
    .filter((p) => game.attackers(p.square, me).includes(move.to))
    .filter((p) => {
      const undefended = game.attackers(p.square, them).length === 0;
      return undefended || PIECE_VALUES[p.type] > PIECE_VALUES[move.promotion ?? move.piece];
    });
  if (threatened.length >= 2 || (threatened.length === 1 && move.isCheck)) {
    const names = threatened.map((p) => `${PIECE_ACCUSATIVE[p.type]} auf ${p.square}`);
    points.push(`Doppelangriff (Gabel) auf ${move.isCheck ? 'den König und ' : ''}${names.join(' und ')}.`);
  } else if (threatened.length === 1) {
    const t = threatened[0];
    points.push(`Greift ${PIECE_ACCUSATIVE[t.type]} auf ${t.square} an.`);
  }

  // Sicherheit der gezogenen Figur
  const movedType = move.promotion ?? move.piece;
  if (movedType !== 'k' && !move.isCheckmate) {
    const attackers = game.attackers(move.to, them);
    if (attackers.length > 0) {
      const defenders = game.attackers(move.to, me);
      const cheapest = attackers
        .map((sq) => game.pieceAt(sq)!.type)
        .sort((a, b) => PIECE_VALUES[a] - PIECE_VALUES[b])[0];
      const name = PIECE_NAMES[movedType];
      if (defenders.length === 0) {
        warnings.push(
          options.suggested
            ? `${name} auf ${move.to} darf geschlagen werden – laut Stockfish lohnt sich dieses Angebot.`
            : `Vorsicht: ${name} auf ${move.to} steht ungedeckt und kann geschlagen werden.`,
        );
      } else if (PIECE_VALUES[cheapest] < PIECE_VALUES[movedType]) {
        warnings.push(
          options.suggested
            ? `${name} auf ${move.to} wird ${BY_PIECE[cheapest]} angegriffen – Stockfish nimmt das bewusst in Kauf.`
            : `Vorsicht: ${name} auf ${move.to} kann ${BY_PIECE[cheapest]} geschlagen werden.`,
        );
      }
    }
  }

  // Positionelle Ideen
  const backRank = me === 'w' ? '1' : '8';
  if ((move.piece === 'n' || move.piece === 'b') && move.from[1] === backRank && moveNumber <= 12) {
    points.push('Entwickelt eine Leichtfigur – in der Eröffnung sollen Springer und Läufer schnell ins Spiel.');
  }
  if (CENTER.includes(move.to)) {
    points.push(move.piece === 'p' ? 'Besetzt das Zentrum mit einem Bauern.' : 'Die Figur steht stark im Zentrum.');
  } else if (move.piece === 'p' && EXTENDED_CENTER.includes(move.to) && moveNumber <= 10) {
    points.push('Kämpft um die Kontrolle des Zentrums.');
  }
  const myCastling = me === 'w' ? /[KQ]/ : /[kq]/;
  if (move.piece === 'k' && !move.isKingsideCastle && !move.isQueensideCastle && myCastling.test(castlingBefore)) {
    points.push('Der König zieht – danach ist keine Rochade mehr möglich.');
  }

  if (points.length === 0) points.push('Ein ruhiger Zug, der die Stellung der Figuren verbessert.');

  return { title: describeMove(move), points: [...points, ...warnings] };
}

export type MoveQuality = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface MoveClassification {
  quality: MoveQuality;
  label: string;
  /** Verlust in Bauerneinheiten ×100 aus Sicht des Ziehenden */
  cpLoss: number;
}

const QUALITY_LABELS: Record<MoveQuality, string> = {
  best: 'Sehr guter Zug',
  good: 'Guter Zug',
  inaccuracy: 'Ungenauigkeit',
  mistake: 'Fehler',
  blunder: 'Grober Fehler',
};

const clampCp = (cp: number) => Math.max(-1000, Math.min(1000, cp));

/**
 * Bewertet einen Zug anhand der Engine-Bewertungen (jeweils aus Sicht des Ziehenden, in Centipawns):
 * `bestCp` = Bewertung nach dem besten Zug, `playedCp` = Bewertung nach dem gespielten Zug.
 */
export function classifyMove(bestCp: number, playedCp: number): MoveClassification {
  const cpLoss = Math.max(0, clampCp(bestCp) - clampCp(playedCp));
  let quality: MoveQuality;
  if (cpLoss < 20) quality = 'best';
  else if (cpLoss < 60) quality = 'good';
  else if (cpLoss < 120) quality = 'inaccuracy';
  else if (cpLoss < 300) quality = 'mistake';
  else quality = 'blunder';
  return { quality, label: QUALITY_LABELS[quality], cpLoss };
}

export function formatEval(cp: number | undefined, mate: number | undefined): string {
  if (mate !== undefined) return mate > 0 ? `Matt in ${mate}` : `Matt in ${-mate} (gegen dich)`;
  if (cp === undefined) return '–';
  const v = cp / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}
