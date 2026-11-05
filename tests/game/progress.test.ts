import { describe, expect, it } from 'vitest';
import { ChessGame } from '../../src/core/chessGame';
import type { MoveRecord } from '../../src/core/types';
import {
  applyResult,
  decodeProgress,
  EMPTY_PROGRESS,
  isUnlocked,
  levelInfo,
  moveAchievements,
  nextOpponentId,
  type GameSummary,
} from '../../src/game/progress';
import { DEFAULT_SETTINGS, type GameSettings } from '../../src/game/settings';

/** Züge in einer Stellung spielen und die Zugbeschreibungen zurückgeben */
function moves(fen: string, list: string[]): MoveRecord[] {
  const g = new ChessGame(fen);
  return list.map((uci) => g.move({ from: uci.slice(0, 2) as never, to: uci.slice(2, 4) as never, promotion: uci[4] as never })!);
}

const SCHOLAR = moves('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7']);
const campaign = (opponent: number): GameSettings => ({ ...DEFAULT_SETTINGS, aiLevel: opponent, context: { kind: 'campaign', opponent } });
const summary = (settings: GameSettings, winner: 'w' | 'b' | null, extra: Partial<GameSummary> = {}): GameSummary => ({
  settings,
  result: { winner, reason: winner ? 'checkmate' : 'stalemate' },
  history: SCHOLAR,
  undoUsed: false,
  hintUsed: false,
  xpAwarded: 0,
  ...extra,
});

describe('Stufe und Rang', () => {
  it('beginnt bei Stufe 1 und steigt mit der Erfahrung', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, from: 0, to: 60 });
    expect(levelInfo(59).level).toBe(1);
    expect(levelInfo(60).level).toBe(2);
    expect(levelInfo(600).level).toBe(5);
    expect(levelInfo(90).progress).toBeCloseTo(0.25);
  });
});

describe('Feldzug', () => {
  it('Sieg schnell und ohne Zurücknehmen: drei Sterne, nächster Gegner frei', () => {
    const { data, reward } = applyResult(EMPTY_PROGRESS, summary(campaign(1), 'w'));
    expect(reward.starFlags).toEqual([true, true, true]);
    expect(data.stars['1']).toBe(3);
    expect(reward.unlocked).toBe(2);
    expect(isUnlocked(data, 2)).toBe(true);
    expect(isUnlocked(data, 3)).toBe(false);
    expect(nextOpponentId(data)).toBe(2);
    expect(reward.achievements).toEqual(expect.arrayContaining(['first-win', 'fast-mate', 'perfect']));
    // Sieg Stufe 1 = 45, plus 10 je neuem Stern
    expect(data.xp).toBe(45 + 30);
  });

  it('mit Zurücknehmen nur zwei Sterne; Niederlage bringt keinen Stern und schaltet nichts frei', () => {
    expect(applyResult(EMPTY_PROGRESS, summary(campaign(1), 'w', { undoUsed: true })).reward.stars).toBe(2);
    const lost = applyResult(EMPTY_PROGRESS, summary(campaign(1), 'b'));
    expect(lost.reward.stars).toBe(0);
    expect(lost.reward.unlocked).toBeUndefined();
    expect(lost.data.xp).toBe(10);
  });

  it('nach Zurücknehmen und neuem Ende gibt es nur den Unterschied an Erfahrung', () => {
    const first = applyResult(EMPTY_PROGRESS, summary(campaign(1), 'b'));
    const again = applyResult(first.data, summary(campaign(1), 'b', { xpAwarded: first.reward.xpGame, undoUsed: true }));
    expect(again.data.xp).toBe(first.data.xp);
    expect(again.data.games).toBe(first.data.games);
  });
});

describe('Rätsel', () => {
  const puzzle: GameSettings = { ...DEFAULT_SETTINGS, aiLevel: 5, context: { kind: 'puzzle', id: 'm2-01', mateIn: 2 } };
  it('gelöst: Erfahrung, Serie, Erfolg; nochmal gelöst: weniger Erfahrung', () => {
    const a = applyResult(EMPTY_PROGRESS, summary(puzzle, 'w'));
    expect(a.data.puzzles).toEqual(['m2-01']);
    expect(a.data.streak).toBe(1);
    expect(a.data.xp).toBe(35);
    expect(a.reward.achievements).toContain('puzzle-1');
    const b = applyResult(a.data, summary(puzzle, 'w'));
    expect(b.data.xp).toBe(40);
    expect(b.data.puzzles).toEqual(['m2-01']);
  });
  it('nicht gelöst (Aufgabe): Serie reißt ab', () => {
    const solved = applyResult(EMPTY_PROGRESS, summary(puzzle, 'w')).data;
    const failed = applyResult(solved, { ...summary(puzzle, 'b'), result: { winner: 'b', reason: 'resignation' } });
    expect(failed.data.streak).toBe(0);
    expect(failed.data.bestStreak).toBe(1);
  });
});

describe('Erfolge und Speicher', () => {
  it('Rochade, Dame geschlagen und Umwandlung werden erkannt', () => {
    const castle = moves('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', ['e1g1'])[0];
    expect(moveAchievements(castle)).toEqual(['castle']);
    const promo = moves('8/P6k/8/8/8/8/8/K7 w - - 0 1', ['a7a8q'])[0];
    expect(moveAchievements(promo)).toEqual(['promotion']);
  });
  it('liest beschädigte oder fremde Daten als leeren Fortschritt', () => {
    expect(decodeProgress('{kaputt')).toEqual(EMPTY_PROGRESS);
    expect(decodeProgress(JSON.stringify({ xp: -5, stars: { 1: 9, 99: 2 }, puzzles: ['a', 3] }))).toMatchObject({ xp: 0, stars: { 1: 3 }, puzzles: ['a'] });
  });
});
