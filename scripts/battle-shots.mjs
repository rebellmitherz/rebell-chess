// Prüfbilder eines Kriegerkampfs: startet Edge/Chrome unsichtbar, spielt Züge bis zu einem Schlagzug und legt eine
// Bildfolge als JPEG ab. Braucht den laufenden Entwicklungsserver (npm run dev).
//   node scripts/battle-shots.mjs <ausgabe.jpg> [breite] [höhe] [züge, z. B. e2e4,d7d5,e4d5] [jedes n-te Bild]
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const [out = 'battle.jpg', width = '1280', height = '720', movesArg = 'e2e4,d7d5,e4d5', everyArg = '10', fen = ''] = process.argv.slice(2);
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const { existsSync } = await import('node:fs');
const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) throw new Error('Kein Edge/Chrome gefunden');

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  // eigenes Profil: läuft auch, wenn Edge schon offen ist
  userDataDir: `${process.env.TEMP ?? '.'}/rc-edge-${Date.now()}`,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${width},${height}`],
  defaultViewport: { width: +width, height: +height, deviceScaleFactor: 1 },
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('Seitenfehler:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('Konsole:', m.text()));
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.__r3f && window.__rebellchess, { timeout: 60000 });
  const moves = movesArg.split(',').map((m) => [m.slice(0, 2), m.slice(2, 4)]);
  const result = await page.evaluate(
    async ({ moves, every, fen }) => {
      const st = window.__rebellchess;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const { gl, advance } = window.__r3f;
      // Bilder von Hand rechnen: gleichmäßige 1/30 s je Bild, unabhängig von der Geschwindigkeit des Rechners
      let clock = performance.now();
      const frame = async () => {
        clock += 1000 / 30;
        await sleep(30);
        advance(clock);
      };
      const pump = async (n) => {
        for (let i = 0; i < n; i++) await frame();
      };
      st.getState().startGame({ mode: 'local', humanColor: 'w', aiLevel: 3, timeControlId: '5+0', training: false }, fen || undefined);
      // Krieger und Figuren laden lassen
      await sleep(2500);
      await pump(40);
      for (const [f, t] of moves.slice(0, -1)) {
        st.getState().tryMove(f, t);
        st.getState().endBattle();
        await pump(8);
      }
      await pump(50);
      const last = moves[moves.length - 1];
      st.getState().tryMove(last[0], last[1]);
      if (!st.getState().battle) return { error: 'kein Kampf gestartet' };
      const frames = [];
      const w = 480;
      let i = 0;
      while (st.getState().battle && i < 600) {
        i++;
        await frame();
        if (i % every === 0) {
          const c = document.createElement('canvas');
          const s2 = gl.domElement;
          c.width = w;
          c.height = Math.round((w * s2.height) / s2.width);
          c.getContext('2d').drawImage(s2, 0, 0, c.width, c.height);
          c.label = `${(i / 30).toFixed(1)} s`;
          frames.push(c);
        }
      }
      const plan = window.__battlePlan;
      const cols = 4;
      const fh = frames[0].height;
      const sheet = document.createElement('canvas');
      sheet.width = cols * w;
      sheet.height = Math.ceil(frames.length / cols) * fh;
      const ctx = sheet.getContext('2d');
      frames.forEach((f, k) => {
        ctx.drawImage(f, (k % cols) * w, Math.floor(k / cols) * fh);
        ctx.fillStyle = '#ff0';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(f.label, (k % cols) * w + 6, Math.floor(k / cols) * fh + 20);
      });
      return {
        image: sheet.toDataURL('image/jpeg', 0.8),
        seconds: (i / 30).toFixed(1),
        scenario: plan?.scenario,
        shots: plan?.shots.map((s) => `${s.kind}${s.cut ? '|' : '~'}${s.t.toFixed(1)}`).join(' '),
        cues: plan?.cues.map((c) => `${c.actor}:${c.clip.replace('sword and shield ', '')}@${c.t.toFixed(1)}`).join(', '),
      };
    },
    { moves, every: +everyArg, fen },
  );
  if (result.error) throw new Error(result.error);
  writeFileSync(out, Buffer.from(result.image.split(',')[1], 'base64'));
  console.log(`${out}: ${result.seconds} s, Szenario ${result.scenario}`);
  console.log(`Kamera: ${result.shots}`);
  console.log(`Bewegungen: ${result.cues}`);
} finally {
  await browser.close();
}
