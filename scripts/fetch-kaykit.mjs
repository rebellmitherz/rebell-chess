// Lädt die CC0-Krieger „Knight“ und „Barbarian“ aus „KayKit : Adventurers Character Pack 1.0“ (Kay Lousberg)
// nach assets-src/kaykit-adventurers/ und prüft jede Datei gegen eine feste SHA-256-Prüfsumme.
// Aufruf: node scripts/fetch-kaykit.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main';
const MODELS = `${REPO}/addons/kaykit_character_pack_adventures/Characters/gltf`;
const FILES = [
  ['Knight.glb', `${MODELS}/Knight.glb`, '60428e3abc09ba83e595d256e3af8c5c976b46cdae599f0802fc82b4a3445168'],
  ['Barbarian.glb', `${MODELS}/Barbarian.glb`, 'cefc311a0e10c7858b6141f5ada7e33268727564fb8ac1347aab97d000669cc6'],
];
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

let fresh = 0;
for (const [name, url, hash] of FILES) {
  const file = join(root, 'assets-src', 'kaykit-adventurers', name);
  if (existsSync(file) && sha256(readFileSync(file)) === hash) continue;
  const res = await fetch(url, { headers: { 'User-Agent': 'RebellChess3D-AssetFetch/1.0' } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha256(buf) !== hash) throw new Error(`${name}: Prüfsumme stimmt nicht`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  fresh++;
}
console.log(`[assets] kaykit-adventurers: ${FILES.length} Dateien geprüft, ${fresh} neu geladen`);
