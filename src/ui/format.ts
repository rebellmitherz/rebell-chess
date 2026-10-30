import type { Color, GameResult, PieceSymbol } from '../core/types';
import { getDifficulty } from '../engine/difficulty';
import type { GameSettings } from '../game/settings';
import { getLang, tr } from '../i18n';

/** Farbnamen in der aktuellen Sprache (Zugriff über Getter, damit ein Sprachwechsel sofort wirkt) */
export const COLOR_NAME = {
  get w() {
    return tr('Weiß');
  },
  get b() {
    return tr('Schwarz');
  },
} as Record<Color, string>;

/** Figurine-Symbole mit Text-Darstellung (︎ verhindert Emoji-Darstellung auf Smartphones) */
export const FIGURINE: Record<PieceSymbol, string> = {
  k: '♚︎',
  q: '♛︎',
  r: '♜︎',
  b: '♝︎',
  n: '♞︎',
  p: '♟︎',
};

const SAN_FIGURINE: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };

export function figurineSan(san: string): string {
  return san.replace(/^[KQRBN]/, (m) => SAN_FIGURINE[m]).replace(/=([QRBN])/, (_, p: string) => `=${SAN_FIGURINE[p]}`);
}

export function playerName(settings: GameSettings, color: Color): string {
  if (settings.mode === 'local') return COLOR_NAME[color];
  return color === settings.humanColor ? tr('Du') : `Rebell-KI · ${tr(getDifficulty(settings.aiLevel).name)}`;
}

export function resultTitle(result: GameResult, settings: GameSettings): string {
  if (result.winner === null) return tr('Remis');
  if (settings.mode === 'ai') return result.winner === settings.humanColor ? tr('Du hast gewonnen!') : tr('Die KI gewinnt');
  return tr('{color} gewinnt', { color: COLOR_NAME[result.winner] });
}

export function resultReason(result: GameResult): string {
  const loser = result.winner ? COLOR_NAME[result.winner === 'w' ? 'b' : 'w'] : '';
  switch (result.reason) {
    case 'checkmate':
      return tr('Schachmatt');
    case 'stalemate':
      return tr('Patt – der Spieler am Zug hat keinen legalen Zug, steht aber nicht im Schach.');
    case 'insufficient-material':
      return tr('Ungenügendes Material – niemand kann mehr mattsetzen.');
    case 'threefold-repetition':
      return tr('Dreifache Stellungswiederholung');
    case 'fifty-move-rule':
      return tr('50-Züge-Regel – 50 Züge ohne Bauernzug und ohne Schlagen.');
    case 'timeout':
      return tr('{loser}: Zeit abgelaufen', { loser });
    case 'timeout-insufficient-material':
      return tr('Zeit abgelaufen, aber der Gegner kann nicht mehr mattsetzen.');
    case 'resignation':
      return tr('{loser} gibt auf', { loser });
    case 'agreement':
      return tr('Remis durch Einigung');
  }
}

export function resultScore(result: GameResult | null): string {
  if (!result) return '*';
  return result.winner === 'w' ? '1–0' : result.winner === 'b' ? '0–1' : '½–½';
}

/** Figurennamen für Überschriften: Nominativ, Akkusativ, weiblich? */
const PIECE_WORDS: Record<PieceSymbol, { nom: string; acc: string; female: boolean }> = {
  p: { nom: 'Bauer', acc: 'Bauern', female: false },
  n: { nom: 'Springer', acc: 'Springer', female: false },
  b: { nom: 'Läufer', acc: 'Läufer', female: false },
  r: { nom: 'Turm', acc: 'Turm', female: false },
  q: { nom: 'Dame', acc: 'Dame', female: true },
  k: { nom: 'König', acc: 'König', female: false },
};

/** Überschrift eines Kriegerkampfs, z. B. „Weißer Springer schlägt schwarzen Bauern“ */
export function battleTitle(b: { attacker: { color: Color; type: PieceSymbol }; victim: { color: Color; type: PieceSymbol } }): string {
  if (getLang() === 'en') {
    const name = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
    const side = (c: Color) => (c === 'w' ? 'White' : 'Black');
    return `${side(b.attacker.color)} ${name[b.attacker.type]} takes ${side(b.victim.color).toLowerCase()} ${name[b.victim.type]}`;
  }
  const a = PIECE_WORDS[b.attacker.type];
  const v = PIECE_WORDS[b.victim.type];
  const aColor = b.attacker.color === 'w' ? 'Weiß' : 'Schwarz';
  const vColor = b.victim.color === 'w' ? 'weiß' : 'schwarz';
  return `${aColor}${a.female ? 'e' : 'er'} ${a.nom} schlägt ${vColor}${v.female ? 'e' : 'en'} ${v.acc}`;
}
