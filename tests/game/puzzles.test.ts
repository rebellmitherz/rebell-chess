import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { PUZZLES } from '../../src/game/progress';

describe('Rätsel', () => {
  it('sind vorhanden, eindeutig nummeriert und nach Mattlänge sortiert', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
    expect(PUZZLES.map((p) => p.mateIn)).toEqual([...PUZZLES.map((p) => p.mateIn)].sort());
    for (const n of [1, 2, 3]) expect(PUZZLES.filter((p) => p.mateIn === n).length, `Matt in ${n}`).toBeGreaterThan(0);
  });

  it('jede Lösung ist regelgerecht und endet nach n eigenen Zügen im Matt', () => {
    for (const p of PUZZLES) {
      const c = new Chess(p.fen);
      expect(c.isGameOver(), p.id).toBe(false);
      expect(p.sol.length, p.id).toBe(2 * p.mateIn - 1);
      for (const uci of p.sol) expect(c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }), `${p.id} ${uci}`).toBeTruthy();
      expect(c.isCheckmate(), p.id).toBe(true);
    }
  });

  it('bei Matt in 1 setzt genau ein Zug matt', () => {
    for (const p of PUZZLES.filter((x) => x.mateIn === 1)) {
      const c = new Chess(p.fen);
      const mates = c.moves({ verbose: true }).filter((m) => {
        const t = new Chess(p.fen);
        t.move(m);
        return t.isCheckmate();
      });
      expect(mates.length, p.id).toBe(1);
    }
  });
});
