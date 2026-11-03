// Erzeugt die Bilder der 2D-Ansicht aus den echten 3D-Bausteinen (Stil „Echt“): zwölf Figuren (frontal) und das Brett von oben.
// Braucht den laufenden Entwicklungsserver (npm run dev). Aufruf: node scripts/build-sprites.mjs
// Ausgabe: public/pieces2d/<farbe><figur>.webp (z. B. wk.webp = weißer König, 256 × 256, freigestellt) und board.webp
import { existsSync, mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const OUT = 'public/pieces2d';
const RENDER = 512;
const SIZE = 256;
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) throw new Error('Kein Chrome/Edge gefunden');

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  userDataDir: `${process.env.TEMP ?? '.'}/rc-sprites-${Date.now()}`,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('Seitenfehler:', e.message));
  await page.goto(`http://localhost:5173/scripts/piece-sprites/index.html?size=${RENDER}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sprites || window.__spriteError, { timeout: 90000 });
  const { sprites, board, error } = await page.evaluate(() => ({ sprites: window.__sprites, board: window.__board, error: window.__spriteError }));
  if (error) throw new Error(error);
  mkdirSync(OUT, { recursive: true });
  await sharp(Buffer.from(board.split(',')[1], 'base64')).resize(1400, 1400, { kernel: 'lanczos3' }).webp({ quality: 88 }).toFile(`${OUT}/board.webp`);
  console.log(`${OUT}/board.webp`);
  for (const [name, url] of Object.entries(sprites)) {
    const png = Buffer.from(url.split(',')[1], 'base64');
    const file = `${OUT}/${name}.webp`;
    await sharp(png).resize(SIZE, SIZE, { kernel: 'lanczos3' }).webp({ quality: 88, alphaQuality: 100 }).toFile(file);
    console.log(file);
  }
} finally {
  await browser.close();
}
