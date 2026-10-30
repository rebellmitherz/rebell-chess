import { describe, expect, it } from 'vitest';
import { ChessGame, START_FEN } from '../../src/core/chessGame';
import { Position, moveToUci } from '../../src/engine/rebell/board';
import { Searcher } from '../../src/engine/rebell/search';
import { scoreToCp } from '../../src/engine/types';

function perft(pos: Position, depth: number): number {
  const buffer = new Int32Array(256);
  const end = pos.generate(buffer, 0, false);
  let total = 0;
  for (let i = 0; i < end; i++) {
    if (!pos.make(buffer[i])) continue;
    total += depth === 1 ? 1 : perft(pos, depth - 1);
    pos.unmake(buffer[i]);
  }
  return total;
}

describe('Zuggenerator (Perft-Vergleichswerte)', () => {
  const cases: Array<[string, string, number[]]> = [
    ['Grundstellung', START_FEN, [20, 400, 8902, 197281, 4865609]],
    ['Kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862, 4085603]],
    ['Endspiel', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
    ['Umwandlungen', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
    ['Stellung 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379, 2103487]],
    ['Stellung 6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890, 3894594]],
  ];
  for (const [name, fen, expected] of cases) {
    it(name, () => {
      const pos = new Position(fen);
      expected.forEach((nodes, i) => expect(perft(pos, i + 1), `Tiefe ${i + 1}`).toBe(nodes));
    });
  }

  it('Ziehen und Zurücknehmen stellt auch den Schlüssel wieder her', () => {
    const pos = new Position(cases[1][1]);
    const { hashLo, hashHi } = pos;
    for (const move of pos.legalMoves()) {
      pos.make(move);
      pos.unmake(move);
      expect([pos.hashLo, pos.hashHi]).toEqual([hashLo, hashHi]);
    }
  });

  it('kennt in zufälligen Partien dieselben Züge wie chess.js', () => {
    let seed = 12345;
    const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let game = 0; game < 30; game++) {
      const reference = new ChessGame();
      for (let ply = 0; ply < 120 && reference.allLegalMoves().length > 0; ply++) {
        const legal = reference.allLegalMoves().map((m) => m.uci).sort();
        expect(new Position(reference.fen).legalMoves().map(moveToUci).sort()).toEqual(legal);
        reference.moveUci(legal[Math.floor(random() * legal.length)]);
      }
    }
  });
});

describe('Bewertung', () => {
  it('bildet Matt auf große Werte ab, näheres Matt ist größer', () => {
    expect(scoreToCp(35, undefined)).toBe(35);
    expect(scoreToCp(undefined, 2)).toBeGreaterThan(scoreToCp(undefined, 5));
    expect(scoreToCp(undefined, -2)).toBeLessThan(scoreToCp(undefined, -5));
  });
});

describe('Suche', () => {
  const searcher = new Searcher();

  it('findet einen legalen Zug in der Grundstellung', () => {
    const result = searcher.search(START_FEN, { depth: 6 });
    expect(new ChessGame().moveUci(result.bestMove!)).not.toBeNull();
    expect(result.depth).toBe(6);
    expect(result.pv[0]).toBe(result.bestMove);
  });

  it('findet ein Matt in 1', () => {
    const result = searcher.search('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', { depth: 6 });
    expect(result.bestMove).toBe('d1d8');
    expect(result.mate).toBe(1);
  });

  it('findet ein Matt in 3', () => {
    const result = searcher.search('r5rk/5p1p/5R2/4B3/8/8/7P/7K w - - 0 1', { depth: 10 });
    expect(result.bestMove).toBe('f6a6');
    expect(result.mate).toBe(3);
  });

  it('meldet keinen Zug, wenn die Partie vorbei ist', () => {
    const mated = searcher.search('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', { depth: 4 });
    expect(mated.bestMove).toBeNull();
    expect(mated.mate).toBe(0);
    const stalemate = searcher.search('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', { depth: 4 });
    expect(stalemate.bestMove).toBeNull();
    expect(stalemate.scoreCp).toBe(0);
  });

  it('schlägt eine hängende Dame und lässt sich keine einfache Gabel entgehen', () => {
    expect(searcher.search('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1', { depth: 5 }).bestMove).toBe('e4d5');
    expect(searcher.search('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', { depth: 6 }).bestMove).toBe('b5c7');
  });

  it('setzt mit König und Turm matt', () => {
    let seenMate = false;
    const game = new ChessGame('8/8/8/4k3/8/8/8/R3K3 w - - 0 1');
    for (let i = 0; i < 80 && game.allLegalMoves().length > 0 && !game.fen.includes(' 100 '); i++) {
      game.moveUci(searcher.search(game.fen, { movetime: 40 }).bestMove!);
      if (game.allLegalMoves().length === 0) seenMate = true;
    }
    expect(seenMate).toBe(true);
  });

  it('hält die Bedenkzeit ein', () => {
    const started = performance.now();
    const result = searcher.search(START_FEN, { movetime: 200 });
    expect(performance.now() - started).toBeLessThan(400);
    expect(result.bestMove).not.toBeNull();
  });

  it('meidet die Wiederholung, wenn sie gewinnt, und kennt sie aus dem Partieverlauf', () => {
    // Weiß steht klar besser; Ta1-b1 brächte dieselbe Stellung zum dritten Mal und wäre nur noch Remis
    const startFen = '6k1/5ppp/8/8/8/8/5PPP/R5KQ w - - 0 1';
    const moves = ['a1b1', 'g8h8', 'b1a1', 'h8g8', 'a1b1', 'g8h8', 'b1a1', 'h8g8'];
    const game = ChessGame.fromUciMoves(startFen, moves);
    const result = searcher.search(game.fen, { depth: 6 }, { startFen, moves });
    expect(result.bestMove).not.toBe('a1b1');
    expect(result.scoreCp === undefined || result.scoreCp > 300).toBe(true);
  });

  it('schwache Spielweise bleibt legal und streut', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    let seed = 7;
    const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const move = searcher.searchWeak(fen, 2, 60, random).bestMove!;
      expect(new ChessGame(fen).moveUci(move)).not.toBeNull();
      seen.add(move);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
