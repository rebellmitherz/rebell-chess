import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ChessGame, START_FEN } from '../../src/core/chessGame';
import { DIFFICULTY_LEVELS } from '../../src/engine/difficulty';
import { StockfishEngine } from '../../src/engine/StockfishEngine';
import { createNodeTransport } from '../helpers/nodeTransport';

describe('Stockfish 19 Lite (echte Engine)', () => {
  let engine: StockfishEngine;

  beforeAll(async () => {
    engine = new StockfishEngine(createNodeTransport());
    await engine.init();
  });
  afterAll(() => engine.dispose());

  it('findet einen legalen Zug in der Grundstellung', async () => {
    const result = await engine.search(START_FEN, { depth: 8 });
    expect(result.bestMove).toMatch(/^[a-h][1-8][a-h][1-8]$/);
    expect(new ChessGame().moveUci(result.bestMove!)).not.toBeNull();
    expect(result.depth).toBe(8);
  });

  it('findet ein Matt in 1', async () => {
    const result = await engine.search('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', { depth: 6 });
    expect(result.bestMove).toBe('d1d8');
    expect(result.mate).toBe(1);
  });

  it('meldet keinen Zug, wenn die Partie vorbei ist', async () => {
    const result = await engine.search('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', { depth: 4 });
    expect(result.bestMove).toBeNull();
  });

  it('akzeptiert alle Schwierigkeitsstufen und spielt legale Züge', async () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    for (const level of DIFFICULTY_LEVELS) {
      await engine.setOptions(level.options);
      const result = await engine.search(fen, { ...level.limits, movetime: Math.min(level.limits.movetime ?? 200, 200) });
      expect(new ChessGame(fen).moveUci(result.bestMove!), `Stufe ${level.id}`).not.toBeNull();
    }
  });

  it('bricht eine lange Suche mit stop() ab', async () => {
    const started = Date.now();
    const pending = engine.search(START_FEN, { movetime: 20_000 });
    setTimeout(() => engine.stop(), 300);
    const result = await pending;
    expect(result.bestMove).not.toBeNull();
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
