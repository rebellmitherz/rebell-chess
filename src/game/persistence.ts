import { ChessGame, isValidFen } from '../core/chessGame';
import type { Color, GameResult, ResultReason } from '../core/types';
import { sanitizePreferences, sanitizeSettings, type GameSettings, type Preferences } from './settings';

export const SAVE_KEY = 'rebellchess.save.v1';
export const PREFS_KEY = 'rebellchess.prefs.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SavedGame {
  version: 1;
  savedAt: string;
  settings: GameSettings;
  startFen: string;
  /** Züge in UCI-Notation – beim Laden wird jeder Zug erneut regelgeprüft */
  moves: string[];
  clock: { remaining: Record<Color, number>; started: boolean };
  /** Restzeiten vor jedem Zug (für Rückgängig) */
  clockSnapshots: Array<Record<Color, number>>;
  /** Ergebnis, das nicht aus der Stellung folgt (Aufgabe, Zeit, Einigung) */
  result: GameResult | null;
}

const REASONS: ResultReason[] = [
  'checkmate',
  'stalemate',
  'insufficient-material',
  'threefold-repetition',
  'fifty-move-rule',
  'timeout',
  'timeout-insufficient-material',
  'resignation',
  'agreement',
];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isTimes = (v: unknown): v is Record<Color, number> =>
  isObj(v) && Number.isFinite(v.w) && Number.isFinite(v.b) && (v.w as number) >= 0 && (v.b as number) >= 0;

export function encodeSave(save: SavedGame): string {
  return JSON.stringify(save);
}

/** Liest und prüft einen Spielstand. Gibt null zurück, wenn er beschädigt oder regelwidrig ist. */
export function decodeSave(json: string | null): SavedGame | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.version !== 1) return null;
  if (typeof raw.startFen !== 'string' || !isValidFen(raw.startFen)) return null;
  if (!Array.isArray(raw.moves) || !raw.moves.every((m) => typeof m === 'string')) return null;
  const moves = raw.moves as string[];
  try {
    ChessGame.fromUciMoves(raw.startFen, moves);
  } catch {
    return null;
  }
  const clockRaw = isObj(raw.clock) ? raw.clock : {};
  const remaining = isTimes(clockRaw.remaining) ? clockRaw.remaining : { w: 0, b: 0 };
  const snapshots = Array.isArray(raw.clockSnapshots) && raw.clockSnapshots.every(isTimes) ? raw.clockSnapshots : [];
  let result: GameResult | null = null;
  if (isObj(raw.result) && REASONS.includes(raw.result.reason as ResultReason)) {
    const w = raw.result.winner;
    result = { winner: w === 'w' || w === 'b' ? w : null, reason: raw.result.reason as ResultReason };
  }
  return {
    version: 1,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date(0).toISOString(),
    settings: sanitizeSettings(raw.settings),
    startFen: raw.startFen,
    moves,
    clock: { remaining: { w: remaining.w, b: remaining.b }, started: clockRaw.started === true },
    clockSnapshots: snapshots.length === moves.length ? snapshots : [],
    result,
  };
}

export function loadPreferences(storage: StorageLike | null, base: Preferences): Preferences {
  if (!storage) return base;
  try {
    const raw = storage.getItem(PREFS_KEY);
    return raw ? sanitizePreferences(JSON.parse(raw), base) : base;
  } catch {
    return base;
  }
}

export function savePreferences(storage: StorageLike | null, prefs: Preferences): void {
  try {
    storage?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* Speicher voll oder gesperrt – Einstellungen gelten dann nur für diese Sitzung */
  }
}

/** localStorage, falls verfügbar (privater Modus/gesperrte Cookies → null). */
export function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = '__rebellchess_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}
