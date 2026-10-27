// Erzeugt die Vorschaubilder für Spieleportale (CrazyGames u. a.) über ein unsichtbares Edge/Chrome.
// Braucht den laufenden Entwicklungsserver (npm run dev). Aufruf: node scripts/store-shots.mjs
// Ausgabe: crazygames/images/<größe>/<nr>-<name>.png  (Größen: 1920x1080 quer, 800x800 quadratisch, 800x1200 hoch)
import { existsSync, mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const SIZES = [
  { name: '1920x1080', width: 1920, height: 1080, mobile: false },
  { name: '800x800', width: 800, height: 800, mobile: false },
  { name: '800x1200', width: 800, height: 1200, mobile: true },
];
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) throw new Error('Kein Edge/Chrome gefunden');
const MATE_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
const MIDGAME = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7';
const FIGHT_FEN = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  userDataDir: `${process.env.TEMP ?? '.'}/rc-edge-${Date.now()}`,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'],
});

async function open(size) {
  const page = await browser.newPage();
  await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1, isMobile: size.mobile, hasTouch: size.mobile });
  await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__r3f && window.__rebellchess, { timeout: 90000 });
  return page;
}

/** Spielstellung einstellen und warten, bis alles steht */
const setup = (page, prefs, fen, side = 'w') =>
  page.evaluate(
    async (prefs, fen, side) => {
      const st = window.__rebellchess;
      st.getState().setPrefs({ sound: false, hideSidebar: false, turnBoard: false, ...prefs });
      st.getState().startGame({ mode: 'local', humanColor: side, aiLevel: 3, timeControlId: 'none', training: false }, fen);
      await new Promise((r) => setTimeout(r, 4500));
    },
    prefs,
    fen,
    side,
  );

for (const size of SIZES) {
  const dir = `crazygames/images/${size.name}`;
  mkdirSync(dir, { recursive: true });
  const shot = async (page, name) => {
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${dir}/${name}.png` });
    console.log(`${dir}/${name}.png`);
  };

  // 1) Kriegerkampf – Bildlauf von Hand, damit der Moment genau getroffen wird
  {
    const page = await open(size);
    await setup(page, { battleMode: 'always', pieceStyle: 'real', viewMode: 'top' }, FIGHT_FEN);
    await page.evaluate(async () => {
      const st = window.__rebellchess;
      const { advance } = window.__r3f;
      st.getState().tryMove('e4', 'd5');
      window.requestAnimationFrame = () => 0; // Zeit steht, nur die Bilder von Hand laufen
      let clock = performance.now();
      for (let i = 0; i < 75; i++) {
        clock += 1000 / 30;
        await new Promise((r) => setTimeout(r, 20));
        advance(clock);
      }
    });
    await shot(page, '1-kriegerkampf');
    await page.close();
  }

  // 2) Draufsicht Echt, mitten in der Partie
  {
    const page = await open(size);
    await setup(page, { pieceStyle: 'real', viewMode: 'top', battleMode: 'quick', hideSidebar: size.width > size.height }, MIDGAME);
    await shot(page, '2-brett-echt');
    await page.close();
  }

  // 3) und 4) Edel und Rebell schräg
  for (const [style, name] of [['classic', '3-edel-gruen'], ['rebell', '4-rebell-rot']]) {
    const page = await open(size);
    await setup(page, { pieceStyle: style, viewMode: 'perspective', battleMode: 'quick' }, MIDGAME);
    await shot(page, name);
    await page.close();
  }

  // 5) Schachmatt-Stempel
  {
    const page = await open(size);
    await setup(page, { pieceStyle: 'real', viewMode: 'top', battleMode: 'quick' }, MATE_FEN);
    await page.evaluate(() => window.__rebellchess.getState().tryMove('h5', 'f7'));
    await page.waitForSelector('.mate-stamp', { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 700));
    await shot(page, '5-schachmatt');
    await page.close();
  }
}
await browser.close();
