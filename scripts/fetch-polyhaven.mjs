// Lädt das CC0-Modell „Chess Set“ (Riley Queen, Poly Haven) in der 1k-Fassung nach assets-src/polyhaven-chess-set
// und prüft jede Datei gegen die MD5-Prüfsumme aus der Poly-Haven-API. Aufruf: node scripts/fetch-polyhaven.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'assets-src', 'polyhaven-chess-set');
const headers = { 'User-Agent': 'RebellChess3D-AssetFetch/1.0' };

const md5 = (buf) => createHash('md5').update(buf).digest('hex');

const meta = await (await fetch('https://api.polyhaven.com/files/chess_set', { headers })).json();
const entry = meta.gltf['1k'].gltf;
const files = [['chess_set_1k.gltf', entry], ...Object.entries(entry.include)];

let downloaded = 0;
for (const [name, info] of files) {
  const file = join(target, name);
  if (existsSync(file) && md5(readFileSync(file)) === info.md5) continue;
  const res = await fetch(info.url, { headers });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (md5(buf) !== info.md5) throw new Error(`${name}: Prüfsumme stimmt nicht`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  downloaded++;
}
console.log(`[assets] Poly Haven „Chess Set“: ${files.length} Dateien geprüft, ${downloaded} neu geladen → ${target}`);
