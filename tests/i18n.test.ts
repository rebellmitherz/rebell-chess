import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DIFFICULTY_LEVELS } from '../src/engine/difficulty';
import { TIME_CONTROLS } from '../src/game/settings';
import { EN } from '../src/i18n/en';
import { detectLang, getLang, pick, setLang, tr } from '../src/i18n';
import { ChessGame } from '../src/core/chessGame';
import { explainMove, formatEval, PIECE_NAMES } from '../src/core/explain';
import { battleTitle, resultReason, resultTitle } from '../src/ui/format';
import { DEFAULT_SETTINGS } from '../src/game/settings';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'i18n' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Alle tr('…')-Aufrufe mit festem Text im Quellcode */
function literalKeys(): Array<{ key: string; file: string }> {
  const out: Array<{ key: string; file: string }> = [];
  for (const file of sources('src')) {
    const text = readFileSync(file, 'utf-8');
    for (const m of text.matchAll(/\btr\(\s*'((?:[^'\\]|\\.)*)'/g)) out.push({ key: m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'), file });
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => setLang('de'));

describe('Übersetzungen', () => {
  it('hat für jeden tr(\'…\')-Aufruf im Code einen englischen Text', () => {
    const keys = literalKeys();
    expect(keys.length).toBeGreaterThan(150);
    const missing = keys.filter(({ key }) => !(key in EN)).map(({ key, file }) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });

  it('hat für Stufen, Stärken und Bedenkzeiten englische Texte', () => {
    for (const l of DIFFICULTY_LEVELS) for (const key of [l.name, l.strength, l.description]) expect(EN[key], key).toBeTruthy();
    for (const t of TIME_CONTROLS) expect(EN[t.name], t.name).toBeTruthy();
  });

  it('übernimmt dieselben Platzhalter in den englischen Text', () => {
    for (const [de, en] of Object.entries(EN)) expect(placeholders(en), de).toEqual(placeholders(de));
  });

  it('lässt keinen englischen Text leer oder gleich dem deutschen (außer bei gleichen Wörtern)', () => {
    const same = new Set(['Pause', 'Blitz', 'Bullet', 'Training', 'Sprache / Language']);
    for (const [de, en] of Object.entries(EN)) {
      expect(en.trim(), de).not.toBe('');
      if (!same.has(de) && de.length > 12) expect(en, de).not.toBe(de);
    }
  });

  it('wechselt die Sprache und fügt Platzhalter ein', () => {
    expect(tr('Partie gespeichert.')).toBe('Partie gespeichert.');
    setLang('en');
    expect(getLang()).toBe('en');
    expect(tr('Partie gespeichert.')).toBe('Game saved.');
    expect(tr('Partie mit {n} Halbzügen geladen.', { n: 12 })).toBe('Game with 12 half-moves loaded.');
    // Kontext-Zusatz wird nicht angezeigt, wenn es keine Übersetzung gibt
    expect(tr('Unbekannt|kontext')).toBe('Unbekannt');
    setLang('de');
    expect(tr('Zurück|undo')).toBe('Zurück');
    expect(pick('a', 'b')).toBe('a');
  });

  it('wählt die Sprache nach dem Gerät (nur de-… ist deutsch)', () => {
    expect(['de', 'en']).toContain(detectLang());
  });

  it('übersetzt Zugerklärungen, Ergebnisse und Kampftitel', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
    const de = explainMove(fen, { from: 'b8', to: 'c6' })!;
    setLang('en');
    const en = explainMove(fen, { from: 'b8', to: 'c6' })!;
    expect(de.title).toContain('Springer');
    expect(en.title).toContain('Knight');
    expect(en.points.join(' ')).not.toMatch(/Springer|Läufer|Zentrum|Entwickelt/);
    expect(new ChessGame().legalMovesFrom('e2').length).toBe(2);
    expect(PIECE_NAMES.q).toBe('Queen');
    expect(formatEval(undefined, 3)).toBe('Mate in 3');
    expect(formatEval(undefined, -2)).toBe('Mate in 2 (against you)');
    expect(resultTitle({ winner: 'w', reason: 'checkmate' }, { ...DEFAULT_SETTINGS, mode: 'local' })).toBe('White wins');
    expect(resultReason({ winner: 'b', reason: 'resignation' })).toBe('White resigns');
    expect(battleTitle({ attacker: { color: 'w', type: 'n' }, victim: { color: 'b', type: 'q' } })).toBe('White knight takes black queen');
    setLang('de');
    expect(battleTitle({ attacker: { color: 'w', type: 'n' }, victim: { color: 'b', type: 'q' } })).toBe('Weißer Springer schlägt schwarze Dame');
  });
});
