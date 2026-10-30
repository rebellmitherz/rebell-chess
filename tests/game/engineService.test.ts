import { describe, expect, it, vi } from 'vitest';
import { ChessGame, START_FEN } from '../../src/core/chessGame';
import { DIFFICULTY_LEVELS } from '../../src/engine/difficulty';
import { bookMove } from '../../src/engine/rebell/book';
import { createEngineHost, type EngineRequest, type EngineResponse } from '../../src/engine/rebell/protocol';
import { createEngineService, type EngineWorker } from '../../src/game/engineService';

/** Rechnet wie der echte Worker, nur ohne eigenen Thread */
class FakeWorker implements EngineWorker {
  onmessage: ((event: { data: EngineResponse }) => void) | null = null;
  onerror: EngineWorker['onerror'] = null;
  terminated = false;
  private handle = createEngineHost(() => 0.5);
  constructor(private readonly hold = false) {}
  postMessage(request: EngineRequest) {
    if (this.hold) return;
    const response = this.handle(request);
    if (response) queueMicrotask(() => this.onmessage?.({ data: response }));
  }
  terminate() {
    this.terminated = true;
  }
}

describe('Engine-Dienst', () => {
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

  it('spielt auf jeder Stufe legale Züge', async () => {
    const service = createEngineService(() => new FakeWorker());
    for (const level of DIFFICULTY_LEVELS) {
      const quick = { ...level, limits: { ...level.limits, movetime: level.limits.movetime && 50 } };
      const move = await service.playMove(fen, quick);
      expect(new ChessGame(fen).moveUci(move!), `Stufe ${level.id}`).not.toBeNull();
    }
  });

  it('analysiert und meldet das Partieende', async () => {
    const service = createEngineService(() => new FakeWorker());
    const result = await service.analyse('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 6);
    expect(result.bestMove).toBe('d1d8');
    expect(result.mate).toBe(1);
    const mated = await service.analyse('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', 4);
    expect(mated.bestMove).toBeNull();
  });

  it('bricht eine Suche ab: Worker wird beendet, das Ergebnis ist leer', async () => {
    const workers: FakeWorker[] = [];
    const service = createEngineService(() => {
      workers.push(new FakeWorker(true));
      return workers[workers.length - 1];
    });
    const pending = service.playMove(fen, DIFFICULTY_LEVELS[6]);
    service.cancelPlay();
    await expect(pending).resolves.toBeNull();
    expect(workers[0].terminated).toBe(true);
  });

  it('meldet einen Ladefehler und startet danach neu', async () => {
    const workers: FakeWorker[] = [];
    const service = createEngineService(() => {
      workers.push(new FakeWorker(workers.length === 0));
      return workers[workers.length - 1];
    });
    const pending = service.playMove(fen, DIFFICULTY_LEVELS[3]);
    workers[0].onerror?.({ message: 'kaputt', preventDefault: vi.fn() });
    await expect(pending).rejects.toThrow('kaputt');
    await expect(service.playMove(fen, DIFFICULTY_LEVELS[3])).resolves.toBeTruthy();
  });
});

describe('Eröffnungsbuch', () => {
  it('kennt die Grundstellung, spielt legal und endet außerhalb der Theorie', () => {
    const moves = new Set([0.05, 0.3, 0.6, 0.95].map((r) => bookMove(START_FEN, () => r)));
    expect(moves.size).toBeGreaterThan(2);
    for (const move of moves) expect(new ChessGame().moveUci(move!)).not.toBeNull();
    expect(bookMove('8/8/8/4k3/8/8/8/R3K3 w - - 0 1', () => 0.5)).toBeNull();
  });

  it('antwortet auch mit Schwarz nach 1. e4', () => {
    const game = new ChessGame();
    game.moveUci('e2e4');
    const reply = bookMove(game.fen, () => 0.5);
    expect(game.moveUci(reply!)).not.toBeNull();
  });
});
