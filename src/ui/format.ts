import type { Color, GameResult, PieceSymbol } from '../core/types';
import { getDifficulty } from '../engine/difficulty';
import type { GameSettings } from '../game/settings';

export const COLOR_NAME: Record<Color, string> = { w: 'Weiß', b: 'Schwarz' };

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
  return color === settings.humanColor ? 'Du' : `Stockfish · ${getDifficulty(settings.aiLevel).name}`;
}

export function resultTitle(result: GameResult, settings: GameSettings): string {
  if (result.winner === null) return 'Remis';
  if (settings.mode === 'ai') return result.winner === settings.humanColor ? 'Du hast gewonnen!' : 'Stockfish gewinnt';
  return `${COLOR_NAME[result.winner]} gewinnt`;
}

export function resultReason(result: GameResult): string {
  const loser = result.winner ? COLOR_NAME[result.winner === 'w' ? 'b' : 'w'] : '';
  switch (result.reason) {
    case 'checkmate':
      return 'Schachmatt';
    case 'stalemate':
      return 'Patt – der Spieler am Zug hat keinen legalen Zug, steht aber nicht im Schach.';
    case 'insufficient-material':
      return 'Ungenügendes Material – niemand kann mehr mattsetzen.';
    case 'threefold-repetition':
      return 'Dreifache Stellungswiederholung';
    case 'fifty-move-rule':
      return '50-Züge-Regel – 50 Züge ohne Bauernzug und ohne Schlagen.';
    case 'timeout':
      return `${loser}: Zeit abgelaufen`;
    case 'timeout-insufficient-material':
      return 'Zeit abgelaufen, aber der Gegner kann nicht mehr mattsetzen.';
    case 'resignation':
      return `${loser} gibt auf`;
    case 'agreement':
      return 'Remis durch Einigung';
  }
}

export function resultScore(result: GameResult | null): string {
  if (!result) return '*';
  return result.winner === 'w' ? '1–0' : result.winner === 'b' ? '0–1' : '½–½';
}
