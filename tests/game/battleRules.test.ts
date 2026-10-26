import { describe, expect, it } from 'vitest';
import { ChessGame } from '../../src/core/chessGame';
import type { MoveRecord } from '../../src/core/types';
import { FIGHT_COOLDOWN_PLIES, FRESH_BATTLE_HISTORY, isImportantCapture, nextHistory, QUICK_STREAK_LIMIT, shouldFight } from '../../src/game/battleRules';

/** Zug in einer Stellung spielen und die Zugbeschreibung zurückgeben */
const play = (fen: string, from: string, to: string): MoveRecord => new ChessGame(fen).move({ from: from as never, to: to as never })!;

const PAWN_TAKES_PAWN = ['rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2', 'e4', 'd5'] as const;
const QUEEN_TAKES_QUEEN = ['rnb1kbnr/pppp1ppp/8/4p3/3Pq3/8/PPP1QPPP/RNB1KBNR b KQkq - 0 4', 'e4', 'e2'] as const;
const PAWN_TAKES_KNIGHT = ['rnbqkb1r/pppppppp/8/8/4n3/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 3', 'd3', 'e4'] as const;
const KNIGHT_TAKES_PAWN = ['rnbqkbnr/pppp1ppp/8/4p3/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 2', 'f3', 'e5'] as const;
const ROOK_TAKEN_BY_BISHOP = ['r3k3/8/8/8/8/8/8/4K2B w q - 0 1', 'h1', 'a8'] as const;

describe('Welche Schläge sind wichtig?', () => {
  it('Bauer gegen Bauer und Figur gegen Bauer sind es nicht', () => {
    expect(isImportantCapture(play(...PAWN_TAKES_PAWN))).toBe(false);
    expect(isImportantCapture(play(...KNIGHT_TAKES_PAWN))).toBe(false);
  });

  it('Dame, Turm, Bauer schlägt Figur und Matt sind es', () => {
    expect(isImportantCapture(play(...QUEEN_TAKES_QUEEN))).toBe(true);
    expect(isImportantCapture(play(...PAWN_TAKES_KNIGHT))).toBe(true);
    expect(isImportantCapture(play(...ROOK_TAKEN_BY_BISHOP))).toBe(true);
    const mate = play('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'h5', 'f7');
    expect(mate.isCheckmate).toBe(true);
    expect(isImportantCapture(mate)).toBe(true);
  });

  it('ein Zug ohne Schlag ist nie wichtig', () => {
    expect(isImportantCapture(play('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2', 'e4'))).toBe(false);
  });
});

describe('Wann kommt wirklich ein Kampf?', () => {
  it('wichtiger Schlag: ja; unwichtiger: nein', () => {
    expect(shouldFight(play(...QUEEN_TAKES_QUEEN), 12, FRESH_BATTLE_HISTORY)).toBe(true);
    expect(shouldFight(play(...PAWN_TAKES_PAWN), 12, FRESH_BATTLE_HISTORY)).toBe(false);
  });

  it('direkt nach einem Kampf kein zweiter – außer bei Dame oder Matt', () => {
    const history = nextHistory(FRESH_BATTLE_HISTORY, true, 10);
    expect(shouldFight(play(...PAWN_TAKES_KNIGHT), 12, history)).toBe(false);
    expect(shouldFight(play(...PAWN_TAKES_KNIGHT), 10 + FIGHT_COOLDOWN_PLIES + 1, history)).toBe(true);
    expect(shouldFight(play(...QUEEN_TAKES_QUEEN), 12, history)).toBe(true);
  });

  it('nach vielen schnellen Schlägen bekommt die nächste Beute einen Kampf', () => {
    let history = FRESH_BATTLE_HISTORY;
    const bishopForKnight = play('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3', 'b5', 'c6');
    expect(shouldFight(bishopForKnight, 20, history)).toBe(false);
    for (let i = 0; i < QUICK_STREAK_LIMIT; i++) history = nextHistory(history, false, 14 + i);
    expect(shouldFight(bishopForKnight, 20, history)).toBe(true);
    // ein bloßer Bauerntausch bleibt auch dann schnell
    expect(shouldFight(play(...PAWN_TAKES_PAWN), 20, history)).toBe(false);
  });
});
