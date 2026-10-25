import { describe, expect, it } from 'vitest';
import { parseBestMove, parseInfoLine, scoreToCp } from '../../src/engine/uci';

describe('UCI-Parser', () => {
  it('liest info-Zeilen', () => {
    const info = parseInfoLine('info depth 8 seldepth 12 multipv 1 score cp -36 nodes 7548 nps 290307 hashfull 3 time 26 pv c7c5 g1f3 b8c6');
    expect(info).toEqual({ depth: 8, multipv: 1, scoreCp: -36, nodes: 7548, pv: ['c7c5', 'g1f3', 'b8c6'] });
    expect(parseInfoLine('info depth 3 score mate -2 pv e1e2')).toMatchObject({ mate: -2 });
    expect(parseInfoLine('info depth 5 score cp 20 lowerbound nodes 9')).toMatchObject({ scoreCp: 20, bound: 'lower', nodes: 9 });
    expect(parseInfoLine('info string NNUE evaluation enabled')).toBeNull();
    expect(parseInfoLine('readyok')).toBeNull();
  });

  it('liest bestmove-Zeilen', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ bestMove: 'e2e4', ponder: 'e7e5' });
    expect(parseBestMove('bestmove e7e8q')).toEqual({ bestMove: 'e7e8q', ponder: undefined });
    expect(parseBestMove('bestmove (none)')).toEqual({ bestMove: null, ponder: undefined });
    expect(parseBestMove('info depth 1')).toBeNull();
  });

  it('bildet Matt auf große Werte ab', () => {
    expect(scoreToCp(35, undefined)).toBe(35);
    expect(scoreToCp(undefined, 1)).toBeGreaterThan(scoreToCp(undefined, 3));
    expect(scoreToCp(undefined, -2)).toBeLessThan(-90_000);
  });
});
