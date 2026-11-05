// Führt die Teilergebnisse der Rätsel-Erzeugung zusammen: doppelte und fast gleiche Stellungen raus (aus derselben
// Partie, nur ein paar Felder anders), je Mattlänge höchstens WANT,
// leichte zuerst, Nummern vergeben. Aufruf: node scripts/merge-puzzles.mjs scripts/out/p1.json scripts/out/p2.json …
import { readFileSync, writeFileSync } from 'node:fs';

const WANT = { 1: 40, 2: 70, 3: 40 };
const seen = new Set();
const groups = { 1: [], 2: [], 3: [] };
const kept = [];
/** Brett als 64 Zeichen (leer = '.') */
const squares = (fen) => fen.split(' ')[0].replace(/\d/g, (d) => '.'.repeat(Number(d))).replace(/\//g, '');
/** Fast gleich: weniger als 8 Felder unterscheiden sich */
const similar = (a, b) => {
  let diff = 0;
  for (let i = 0; i < 64; i++) if (a[i] !== b[i] && ++diff >= 8) return false;
  return true;
};
// Längere Matts zuerst: aus derselben Partie ist das Matt in 3 spannender als das Matt in 1 zwei Züge später
const all = process.argv.slice(2).flatMap((file) => JSON.parse(readFileSync(file, 'utf8')));
all.sort((a, b) => b.mateIn - a.mateIn);
{
  for (const p of all) {
    const key = p.fen.split(' ').slice(0, 2).join(' ');
    if (seen.has(key) || groups[p.mateIn].length >= WANT[p.mateIn]) continue;
    const board = squares(p.fen);
    if (kept.some((b) => similar(b, board))) continue;
    seen.add(key);
    kept.push(board);
    groups[p.mateIn].push(p);
  }
}
const list = [1, 2, 3].flatMap((n) => groups[n].map((p, i) => ({ id: `m${n}-${String(i + 1).padStart(2, '0')}`, fen: p.fen, mateIn: n, sol: p.sol })));
writeFileSync('src/game/puzzles.json', `[\n${list.map((p) => JSON.stringify(p)).join(',\n')}\n]\n`);
console.log(`src/game/puzzles.json: ${groups[1].length} × Matt in 1, ${groups[2].length} × Matt in 2, ${groups[3].length} × Matt in 3`);
