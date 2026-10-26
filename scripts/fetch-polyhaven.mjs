// Lädt die CC0-Rohdaten von Poly Haven nach assets-src/ und prüft jede Datei gegen die MD5-Prüfsumme der API:
// - „Chess Set“ (Riley Queen), glTF 1k + Brett-Texturen 2k
// - Raumlicht „Lebombo“ (HDRI, 1k)
// - Tischplatte „Wood Table 001“ (Texturen, 1k)
// Aufruf: node scripts/fetch-polyhaven.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const headers = { 'User-Agent': 'RebellChess3D-AssetFetch/1.0' };
const md5 = (buf) => createHash('md5').update(buf).digest('hex');
const api = async (asset) => (await fetch(`https://api.polyhaven.com/files/${asset}`, { headers })).json();

async function download(dir, files) {
  let fresh = 0;
  for (const [name, info] of files) {
    const file = join(root, 'assets-src', dir, name);
    if (existsSync(file) && md5(readFileSync(file)) === info.md5) continue;
    const res = await fetch(info.url, { headers });
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (md5(buf) !== info.md5) throw new Error(`${name}: Prüfsumme stimmt nicht`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, buf);
    fresh++;
  }
  console.log(`[assets] ${dir}: ${files.length} Dateien geprüft, ${fresh} neu geladen`);
}

const chess = await api('chess_set');
const gltf = chess.gltf['1k'].gltf;
await download('polyhaven-chess-set', [
  ['chess_set_1k.gltf', gltf],
  ...Object.entries(gltf.include),
  ...['board_diff', 'board_nor_gl', 'board_arm'].map((k) => [`textures/chess_set_${k}_2k.jpg`, chess[k]['2k'].jpg]),
]);

const hdri = await api('lebombo');
await download('polyhaven-lebombo', [['lebombo_1k.hdr', hdri.hdri['1k'].hdr]]);

const wood = await api('wood_table_001');
await download(
  'polyhaven-wood-table',
  [
    ['wood_table_001_diff_1k.jpg', wood.Diffuse['1k'].jpg],
    ['wood_table_001_nor_gl_1k.jpg', wood.nor_gl['1k'].jpg],
    ['wood_table_001_arm_1k.jpg', wood.arm['1k'].jpg],
  ],
);
