import { describe, expect, it } from 'vitest';
import { ChessGame, START_FEN } from '../../src/core/chessGame';
import { classifyMove, describeMove, explainMove, formatEval } from '../../src/core/explain';
import { canStillCheckmate } from '../../src/core/material';

const piecesOf = (fen: string) => new ChessGame(fen).pieces();

describe('Zugerklärungen', () => {
  it('erklärt Entwicklung und Zentrum', () => {
    const knight = explainMove(START_FEN, { from: 'g1', to: 'f3' })!;
    expect(knight.title).toBe('Springer g1–f3');
    expect(knight.points.join(' ')).toContain('Leichtfigur');
    const pawn = explainMove(START_FEN, { from: 'e2', to: 'e4' })!;
    expect(pawn.points.join(' ')).toContain('Zentrum');
  });

  it('erklärt Matt, Schach und Rochade', () => {
    const mate = explainMove('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', { from: 'd8', to: 'h4' })!;
    expect(mate.points[0]).toContain('Schachmatt');
    const castle = explainMove('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', { from: 'e1', to: 'g1' })!;
    expect(castle.title).toBe('Kurze Rochade (0-0)');
    expect(castle.points.join(' ')).toContain('Rochade');
  });

  it('warnt vor ungedeckten Figuren und erkennt Gabeln', () => {
    // Dame zieht nach h5, wo sie vom Springer f6 geschlagen werden kann
    const hanging = explainMove('rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2', { from: 'd1', to: 'h5' })!;
    expect(hanging.points.join(' ')).toContain('Vorsicht');
    // Springergabel auf c7: König e8 und Turm a8
    const fork = explainMove('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', { from: 'b5', to: 'c7' })!;
    expect(fork.points.join(' ')).toContain('Gabel');
  });

  it('stellt Warnungen ans Ende und formuliert sie bei Engine-Vorschlägen als Angebot', () => {
    // Damengambit: c4 ist ungedeckt und kann von d5 geschlagen werden
    const fen = 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2';
    const played = explainMove(fen, { from: 'c2', to: 'c4' })!;
    expect(played.points[0]).toContain('Zentrum');
    expect(played.points.at(-1)).toContain('Vorsicht');
    const suggested = explainMove(fen, { from: 'c2', to: 'c4' }, { suggested: true })!;
    expect(suggested.points.join(' ')).not.toContain('Vorsicht');
    expect(suggested.points.at(-1)).toContain('Angebot');
  });

  it('erklärt Schlagzüge und gibt bei illegalen Zügen null zurück', () => {
    const capture = explainMove('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1', { from: 'd1', to: 'd5' })!;
    expect(capture.points.join(' ')).toContain('die Dame');
    expect(explainMove(START_FEN, { from: 'e2', to: 'e5' })).toBeNull();
  });

  it('beschreibt Züge kurz', () => {
    const rec = new ChessGame().moveUci('e2e4')!;
    expect(describeMove(rec)).toBe('Bauer e2–e4');
    const promo = new ChessGame('1r5k/P7/8/8/8/8/8/7K w - - 0 1').moveUci('a7b8q')!;
    expect(describeMove(promo)).toBe('Bauer a7×b8 (Dame)');
  });
});

describe('Zugbewertung', () => {
  it('stuft den Verlust gegenüber dem besten Zug ein', () => {
    expect(classifyMove(50, 45).quality).toBe('best');
    expect(classifyMove(50, 10).quality).toBe('good');
    expect(classifyMove(50, -50).quality).toBe('inaccuracy');
    expect(classifyMove(50, -200).quality).toBe('mistake');
    expect(classifyMove(300, -400).quality).toBe('blunder');
    expect(classifyMove(-20, 40).cpLoss).toBe(0);
  });

  it('formatiert Bewertungen', () => {
    expect(formatEval(34, undefined)).toBe('+0.3');
    expect(formatEval(-120, undefined)).toBe('-1.2');
    expect(formatEval(undefined, 3)).toBe('Matt in 3');
  });
});

describe('Mattmaterial bei Zeitüberschreitung', () => {
  it('nur König oder eine Leichtfigur gegen nackten König reicht nicht', () => {
    expect(canStillCheckmate(piecesOf('8/8/8/4k3/8/8/8/4K3 w - - 0 1'), 'w')).toBe(false);
    expect(canStillCheckmate(piecesOf('8/8/8/4k3/8/8/8/3NK3 w - - 0 1'), 'w')).toBe(false);
    expect(canStillCheckmate(piecesOf('8/8/8/4k3/8/8/8/3BK3 w - - 0 1'), 'w')).toBe(false);
  });

  it('Bauer, Turm, Dame oder zwei Leichtfiguren reichen', () => {
    expect(canStillCheckmate(piecesOf('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1'), 'w')).toBe(true);
    expect(canStillCheckmate(piecesOf('8/8/8/4k3/8/8/8/2NNK3 w - - 0 1'), 'w')).toBe(true);
    expect(canStillCheckmate(piecesOf('8/8/8/4k3/8/8/8/2BBK3 w - - 0 1'), 'w')).toBe(true);
  });

  it('Springer gegen König mit Figuren kann (Hilfs-)Matt setzen', () => {
    expect(canStillCheckmate(piecesOf('8/8/8/4k3/4p3/8/8/3NK3 w - - 0 1'), 'w')).toBe(true);
  });

  it('gleichfarbige Läufer auf beiden Seiten sind tot', () => {
    // Weißer Läufer d1 (hell), schwarzer Läufer f3 (hell)
    expect(canStillCheckmate(piecesOf('8/8/8/4k3/8/5b2/8/3BK3 w - - 0 1'), 'w')).toBe(false);
  });
});
