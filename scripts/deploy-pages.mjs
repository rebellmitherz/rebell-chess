// Lädt den fertigen Build (dist/) in den Zweig gh-pages von rebellmitherz/rebell-chess (GitHub Pages).
// Aufruf über `npm run deploy` (baut vorher). Anmeldung: einmal `gh auth login`.
// Die Zugangsdaten kommen pro Befehl vom GitHub-CLI – die globale Git-Konfiguration bleibt unverändert.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'https://github.com/rebellmitherz/rebell-chess.git';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('[deploy] dist/ fehlt – erst `npm run build`.');
  process.exit(1);
}

const version = JSON.parse(execFileSync('node', ['-p', 'JSON.stringify(require("./package.json").version)'], { cwd: root }).toString());
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim();
const work = mkdtempSync(join(tmpdir(), 'rebellchess-pages-'));
const git = (...args) => execFileSync('git', args, { cwd: work, stdio: 'inherit' });
const auth = ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential'];

try {
  cpSync(dist, work, { recursive: true });
  writeFileSync(join(work, '.nojekyll'), ''); // GitHub soll die Dateien unverändert ausliefern
  git('init', '-q', '-b', 'gh-pages');
  git('add', '-A');
  git('commit', '-q', '-m', `Rebell Chess 3D ${version} (Quelle ${commit})`);
  git(...auth, 'push', '-q', '-f', REPO, 'gh-pages');
  console.log(`[deploy] ${version} veröffentlicht → https://rebellmitherz.github.io/rebell-chess/ (1–2 Minuten bis online)`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
