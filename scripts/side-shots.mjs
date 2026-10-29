// Vergleichsbilder: dieselbe Stellung aus Sicht von Weiß und von Schwarz, je Stil und Ansicht.
// Braucht den laufenden Entwicklungsserver (npm run dev). Aufruf: node scripts/side-shots.mjs [Ausgabeordner]
import { existsSync, mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const OUT = process.argv[2] ?? 'shots-side';
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) throw new Error('Kein Edge/Chrome gefunden');
const MIDGAME = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  userDataDir: `${process.env.TEMP ?? '.'}/rc-edge-${Date.now()}`,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1 });
await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__r3f && window.__rebellchess, { timeout: 90000 });

for (const style of ['real', 'classic', 'rebell']) {
  for (const view of ['top', '3d']) {
    for (const side of ['w', 'b']) {
      await page.evaluate(
        async (style, view, side, fen) => {
          const st = window.__rebellchess;
          st.getState().setPrefs({ sound: false, hideSidebar: true, turnBoard: side === 'b', pieceStyle: style, viewMode: view });
          st.getState().startGame({ mode: 'local', humanColor: 'w', aiLevel: 3, timeControlId: 'none', training: false }, fen);
          await new Promise((r) => setTimeout(r, 5000));
        },
        style,
        view,
        side,
        side === 'b' ? MIDGAME.replace(' w ', ' b ') : MIDGAME,
      );
      const file = `${OUT}/${style}-${view}-${side}.png`;
      await page.screenshot({ path: file });
      console.log(file);
    }
  }
}
await browser.close();
