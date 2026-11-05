// Erzeugt die Schachrätsel (Matt in 1, 2 und 3) mit der eigenen Rebell-KI – keine fremden Daten.
// Aufruf (mehrere parallel mit verschiedenem Startwert, danach zusammenführen):
//   PUZZLE_SEED=1 PUZZLE_OUT=scripts/out/p1.json PUZZLE_MINUTES=35 npx vitest run -c scripts/gen.config.ts
//   node scripts/merge-puzzles.mjs scripts/out/p*.json   → schreibt src/game/puzzles.json
// Weg: viele Partien der KI gegen sich selbst (schwache Stufen, mit Zufall); jede Stellung, in der die Seite am Zug
// ein Matt in höchstens 3 Zügen hat, wird geprüft: genau EIN erster Zug muss in dieser Zeit mattsetzen, es darf kein
// kürzeres Matt geben, und die Materialverteilung muss halbwegs ausgeglichen sein (sonst ist es kein Rätsel).
// Nach jedem Fund wird die Ausgabedatei neu geschrieben (Abbruch verliert nichts), Fortschritt steht in <OUT>.log.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Chess } from 'chess.js';
import { test } from 'vitest';
import { Searcher } from '../src/engine/rebell/search';

const WANT: Record<number, number> = { 1: 40, 2: 70, 3: 40 };
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function material(chess: Chess, color: 'w' | 'b'): number {
  let sum = 0;
  for (const row of chess.board()) for (const c of row) if (c) sum += (c.color === color ? 1 : -1) * VALUE[c.type];
  return sum;
}

test('Rätsel erzeugen', () => {
  const out = process.env.PUZZLE_OUT ?? 'src/game/puzzles.json';
  const budgetMs = Number(process.env.PUZZLE_MINUTES ?? 600) * 60_000;
  mkdirSync(dirname(out), { recursive: true });
  const log = (line: string) => appendFileSync(`${out}.log`, `${line}\n`);
  const searcher = new Searcher();
  const checker = new Searcher();
  let seed = Number(process.env.PUZZLE_SEED ?? 20261105);
  const random = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const found: Record<number, Array<{ fen: string; mateIn: number; sol: string[] }>> = { 1: [], 2: [], 3: [] };
  const seen = new Set<string>();
  const done = () => [1, 2, 3].every((n) => found[n].length >= WANT[n]);
  const started = Date.now();
  let games = 0;
  let checked = 0;

  const write = () => {
    const list = [1, 2, 3].flatMap((n) => found[n]);
    writeFileSync(out, JSON.stringify(list));
  };

  /** Setzt die Seite am Zug nach `uci` in höchstens `n` Zügen matt (n = 1: sofort)? */
  const matesWithin = (fen: string, uci: string, n: number): boolean => {
    const c = new Chess(fen);
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (c.isCheckmate()) return true;
    if (n === 1 || c.isGameOver()) return false;
    const r = checker.search(c.fen(), { depth: 2 * (n - 1) + 1 });
    return r.mate !== undefined && r.mate < 0 && -r.mate <= n - 1;
  };

  while (!done() && Date.now() - started < budgetMs) {
    games++;
    const chess = new Chess();
    for (let ply = 0; ply < 140 && !chess.isGameOver() && Date.now() - started < budgetMs; ply++) {
      const fen = chess.fen();
      if (ply >= 14) {
        checked++;
        const r = searcher.search(fen, { depth: 5 });
        const n = r.mate;
        if (n !== undefined && n > 0 && n <= 3 && found[n].length < WANT[n]) {
          const key = fen.split(' ').slice(0, 2).join(' ');
          const color = chess.turn();
          const diff = material(chess, color);
          if (!seen.has(key) && diff >= -6 && diff <= 5 && chess.moves().length >= 8) {
            seen.add(key);
            const firsts = chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
            const winners = firsts.filter((u) => matesWithin(fen, u, n));
            if (winners.length === 1) {
              found[n].push({ fen, mateIn: n, sol: r.pv.slice(0, 2 * n - 1) });
              write();
              log(`Matt in ${n}: ${found[n].length}/${WANT[n]} (Partie ${games}, ${checked} Stellungen, ${Math.round((Date.now() - started) / 1000)} s)`);
            }
          }
        }
      }
      // Zug der Selbstpartie: meist schwache KI, manchmal ein Zufallszug (so entstehen Fehler und damit Matt-Chancen)
      const legal = chess.moves({ verbose: true });
      let uci: string;
      if (random() < 0.1) {
        const m = legal[Math.floor(random() * legal.length)];
        uci = m.from + m.to + (m.promotion ?? '');
      } else {
        uci = searcher.searchWeak(fen, 2, 70, random).bestMove ?? legal[0].from + legal[0].to;
      }
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
  }
  write();
  log(`Fertig: ${found[1].length}+${found[2].length}+${found[3].length} Rätsel aus ${games} Partien, ${checked} Stellungen, ${Math.round((Date.now() - started) / 1000)} s`);
});
