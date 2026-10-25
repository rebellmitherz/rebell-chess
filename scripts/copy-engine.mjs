// Kopiert die Stockfish-Lite-Engine (single-threaded) aus node_modules nach public/engine,
// damit Vite sie als statische Datei ausliefert. Läuft automatisch vor dev und build.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'stockfish');
const target = join(root, 'public', 'engine');
const files = [
  ['bin/stockfish-19-lite-single.js', 'stockfish-19-lite-single.js'],
  ['bin/stockfish-19-lite-single.wasm', 'stockfish-19-lite-single.wasm'],
  ['Copying.txt', 'STOCKFISH-LICENSE-GPL-3.0.txt'],
];

mkdirSync(target, { recursive: true });
for (const [from, to] of files) {
  const src = join(source, from);
  if (!existsSync(src)) {
    console.error(`[engine:copy] Fehlt: ${src} – bitte "npm install" ausführen.`);
    process.exit(1);
  }
  const dst = join(target, to);
  if (!existsSync(dst) || statSync(dst).size !== statSync(src).size) copyFileSync(src, dst);
}
console.log('[engine:copy] Stockfish 19 Lite bereit in public/engine');
