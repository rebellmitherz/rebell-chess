import { create } from 'zustand';
import type { Color, GameResult, MoveRecord } from '../core/types';
import { tr } from '../i18n';
import { getOpponent, LINES, OPPONENTS, say, type Bi } from './opponents';
import type { StorageLike } from './persistence';
import PUZZLE_LIST from './puzzles.json';
import type { GameSettings } from './settings';
import type { GameStoreApi } from './store';

/**
 * Fortschritt des Spielers über alle Partien: Erfahrung (Stufe und Rang), Sterne im Feldzug, gelöste Rätsel und
 * Erfolge. Getrennt vom Partiezustand gespeichert; die Partie meldet nur ihre Ereignisse (Zug, Kampf, Ergebnis).
 */

export interface Puzzle {
  id: string;
  fen: string;
  mateIn: number;
  /** Lösung (Züge beider Seiten, UCI) */
  sol: string[];
}

export const PUZZLES = PUZZLE_LIST as Puzzle[];

export interface ProgressData {
  xp: number;
  /** Beste Sterne je Gegner (0–3) */
  stars: Record<string, number>;
  /** Gelöste Rätsel (Nummern) */
  puzzles: string[];
  /** Rätsel in Folge gelöst */
  streak: number;
  bestStreak: number;
  achievements: string[];
  /** Beendete Partien (ohne Rätsel) */
  games: number;
  /** Erlebte Kriegerkämpfe */
  duels: number;
}

export const PROGRESS_KEY = 'rebellchess.progress.v1';

export const EMPTY_PROGRESS: ProgressData = { xp: 0, stars: {}, puzzles: [], streak: 0, bestStreak: 0, achievements: [], games: 0, duels: 0 };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const nat = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function decodeProgress(json: string | null): ProgressData {
  if (!json) return EMPTY_PROGRESS;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return EMPTY_PROGRESS;
  }
  if (!isObj(raw)) return EMPTY_PROGRESS;
  const stars: Record<string, number> = {};
  if (isObj(raw.stars)) for (const [k, v] of Object.entries(raw.stars)) if (getOpponent(Number(k))) stars[k] = Math.min(3, nat(v));
  return {
    xp: nat(raw.xp),
    stars,
    puzzles: strings(raw.puzzles),
    streak: nat(raw.streak),
    bestStreak: nat(raw.bestStreak),
    achievements: strings(raw.achievements),
    games: nat(raw.games),
    duels: nat(raw.duels),
  };
}

// ---------- Stufe und Rang ----------

/** Erfahrung, ab der eine Stufe erreicht ist: 0, 60, 180, 360, 600, 900 … */
export const levelStart = (level: number) => 30 * level * (level - 1);

const RANKS: Array<[number, string]> = [
  [1, 'Rekrut'],
  [2, 'Knappe'],
  [3, 'Krieger'],
  [5, 'Ritter'],
  [7, 'Hauptmann'],
  [10, 'Feldherr'],
  [14, 'Rebellenkönig'],
];

export function rankName(level: number): string {
  let name = RANKS[0][1];
  for (const [from, n] of RANKS) if (level >= from) name = n;
  return tr(name);
}

export function levelInfo(xp: number) {
  let level = 1;
  while (xp >= levelStart(level + 1)) level++;
  const from = levelStart(level);
  const to = levelStart(level + 1);
  return { level, from, to, progress: (xp - from) / (to - from), rank: rankName(level) };
}

// ---------- Feldzug ----------

export const totalStars = (d: ProgressData) => Object.values(d.stars).reduce((a, b) => a + b, 0);
export const isUnlocked = (d: ProgressData, id: number) => id === 1 || (d.stars[String(id - 1)] ?? 0) > 0;
/** Erster Gegner, der noch nicht besiegt ist (sonst der Rebell) */
export const nextOpponentId = (d: ProgressData) => OPPONENTS.find((o) => !(d.stars[String(o.id)] > 0))?.id ?? OPPONENTS[OPPONENTS.length - 1].id;
/** Zahl eigener Züge, mit der der dritte Stern noch erreicht ist */
export const FAST_WIN_MOVES = 30;

// ---------- Rätsel ----------

export const nextPuzzle = (d: ProgressData): Puzzle | undefined => PUZZLES.find((p) => !d.puzzles.includes(p.id)) ?? PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
export const getPuzzle = (id: string) => PUZZLES.find((p) => p.id === id);

// ---------- Erfolge ----------

export interface Achievement {
  id: string;
  name: string;
  desc: string;
}

/** Erfolge (Texte deutsch, Übersetzung über tr beim Anzeigen) */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-win', name: 'Erster Sieg', desc: 'Gewinne eine Partie gegen die KI.' },
  { id: 'first-duel', name: 'Zu den Waffen', desc: 'Erlebe deinen ersten Kriegerkampf.' },
  { id: 'queen-hunter', name: 'Damenjäger', desc: 'Schlage die gegnerische Dame.' },
  { id: 'promotion', name: 'Aufstieg', desc: 'Verwandle einen Bauern.' },
  { id: 'castle', name: 'Burgherr', desc: 'Mache eine Rochade.' },
  { id: 'fast-mate', name: 'Blitzsieg', desc: 'Setze in höchstens 20 Zügen matt.' },
  { id: 'puzzle-1', name: 'Rätselfreund', desc: 'Löse dein erstes Rätsel.' },
  { id: 'puzzle-10', name: 'Rätselmeister', desc: 'Löse 10 Rätsel.' },
  { id: 'streak-5', name: 'Lauf', desc: 'Löse 5 Rätsel hintereinander.' },
  { id: 'campaign-3', name: 'Feldherr', desc: 'Besiege 3 Gegner im Feldzug.' },
  { id: 'perfect', name: 'Makellos', desc: 'Hole 3 Sterne gegen einen Gegner.' },
  { id: 'rebel-king', name: 'Rebellenkönig', desc: 'Besiege den Rebellen.' },
];

function unlock(d: ProgressData, ids: string[]): { data: ProgressData; fresh: string[] } {
  const fresh = ids.filter((id, i) => !d.achievements.includes(id) && ids.indexOf(id) === i);
  return fresh.length ? { data: { ...d, achievements: [...d.achievements, ...fresh] }, fresh } : { data: d, fresh };
}

/** Zug-Erfolge (Rochade, Dame geschlagen, Umwandlung) für einen Zug eines menschlichen Spielers */
export function moveAchievements(record: MoveRecord): string[] {
  const out: string[] = [];
  if (record.isKingsideCastle || record.isQueensideCastle) out.push('castle');
  if (record.captured === 'q') out.push('queen-hunter');
  if (record.promotion) out.push('promotion');
  return out;
}

// ---------- Ergebnis einer Partie ----------

export interface GameSummary {
  settings: GameSettings;
  result: GameResult;
  history: MoveRecord[];
  undoUsed: boolean;
  hintUsed: boolean;
  /** Schon für diese Partie vergebene Erfahrung (nach Zurücknehmen nur die Differenz) */
  xpAwarded: number;
}

export interface Reward {
  kind: 'campaign' | 'puzzle' | 'free' | 'local';
  won: boolean;
  draw: boolean;
  /** Feldzug: Sterne dieser Partie und welche Bedingungen erfüllt sind */
  stars: number;
  starFlags: [boolean, boolean, boolean];
  /** Feldzug: vorherige Bestleistung gegen diesen Gegner */
  prevBest: number;
  /** Vergebene Erfahrung (gesamt für diese Partie) */
  xpGame: number;
  xpBefore: number;
  xpAfter: number;
  achievements: string[];
  /** Feldzug: nächster Gegner wurde gerade freigeschaltet */
  unlocked?: number;
  /** Spruch des Gegners zum Ende */
  quote?: Bi;
  /** Rätsel: Serie nach diesem Rätsel */
  streak?: number;
}

const humanMoves = (s: GameSummary) =>
  s.settings.mode === 'ai' ? s.history.filter((m) => m.color === s.settings.humanColor).length : Math.ceil(s.history.length / 2);

export function applyResult(d: ProgressData, s: GameSummary): { data: ProgressData; reward: Reward } {
  const ctx = s.settings.context;
  const human: Color | null = s.settings.mode === 'ai' ? s.settings.humanColor : null;
  const won = human !== null && s.result.winner === human;
  const draw = s.result.winner === null;
  let data: ProgressData = { ...d };
  const ach: string[] = [];
  let xp = 0;
  let stars = 0;
  let starFlags: [boolean, boolean, boolean] = [false, false, false];
  let prevBest = 0;
  let unlocked: number | undefined;
  let quote: Bi | undefined;
  let streak: number | undefined;
  let kind: Reward['kind'] = s.settings.mode === 'local' ? 'local' : 'free';

  if (ctx?.kind === 'puzzle') {
    kind = 'puzzle';
    const solved = won && s.result.reason === 'checkmate';
    const first = !d.puzzles.includes(ctx.id);
    if (solved) {
      xp = first ? 15 + 10 * ctx.mateIn : 5;
      streak = d.streak + 1;
      data = { ...data, puzzles: first ? [...d.puzzles, ctx.id] : d.puzzles, streak, bestStreak: Math.max(d.bestStreak, streak) };
      ach.push('puzzle-1');
      if (data.puzzles.length >= 10) ach.push('puzzle-10');
      if (streak >= 5) ach.push('streak-5');
    } else {
      streak = 0;
      data = { ...data, streak: 0 };
    }
  } else {
    data.games = d.games + (s.xpAwarded > 0 ? 0 : 1);
    if (s.settings.mode === 'ai') {
      const level = ctx?.kind === 'campaign' ? (getOpponent(ctx.opponent)?.level ?? s.settings.aiLevel) : s.settings.aiLevel;
      xp = won ? 30 + 15 * level : draw ? 10 + 5 * level : 10;
      if (won) ach.push('first-win');
      if (won && s.result.reason === 'checkmate' && humanMoves(s) <= 20) ach.push('fast-mate');
    } else xp = 10;
    if (ctx?.kind === 'campaign') {
      kind = 'campaign';
      const opp = getOpponent(ctx.opponent)!;
      prevBest = d.stars[String(opp.id)] ?? 0;
      starFlags = [won, won && !s.undoUsed && !s.hintUsed, won && humanMoves(s) <= FAST_WIN_MOVES];
      stars = starFlags.filter(Boolean).length;
      if (stars > prevBest) {
        data.stars = { ...d.stars, [String(opp.id)]: stars };
        xp += 10 * (stars - prevBest);
      }
      if (won && prevBest === 0 && getOpponent(opp.id + 1)) unlocked = opp.id + 1;
      quote = won ? opp.loses : draw ? LINES.draw[0] : opp.wins;
      const beaten = Object.values(data.stars).filter((v) => v > 0).length;
      if (beaten >= 3) ach.push('campaign-3');
      if (stars === 3) ach.push('perfect');
      if (won && opp.id === OPPONENTS[OPPONENTS.length - 1].id) ach.push('rebel-king');
    }
  }
  // Nach „Zug zurücknehmen“ und neuem Ende nur den Unterschied vergeben – kein Sammeln durch Wiederholen
  const gain = Math.max(0, xp - s.xpAwarded);
  data.xp = d.xp + gain;
  const { data: withAch, fresh } = unlock(data, ach);
  return {
    data: withAch,
    reward: { kind, won, draw, stars, starFlags, prevBest, xpGame: Math.max(xp, s.xpAwarded), xpBefore: d.xp, xpAfter: withAch.xp, achievements: fresh, unlocked, quote, streak },
  };
}

// ---------- Zustand und Anbindung an die Partie ----------

export interface Bubble {
  id: number;
  text: string;
}

interface ProgressState {
  data: ProgressData;
  /** Belohnung der zuletzt beendeten Partie (für das Ergebnisfenster) */
  reward: { gameId: number; plies: number; value: Reward } | null;
  /** Neu freigeschaltete Erfolge, die gerade eingeblendet werden */
  toasts: Array<{ key: number; id: string }>;
  /** Sprechblase des Gegners */
  bubble: Bubble | null;
  dropToast(key: number): void;
  reset(): void;
}

let storage: StorageLike | null = null;
let toastKey = 0;
let bubbleId = 0;

export const useProgress = create<ProgressState>((set) => ({
  data: EMPTY_PROGRESS,
  reward: null,
  toasts: [],
  bubble: null,
  dropToast: (key) => set((s) => ({ toasts: s.toasts.filter((t) => t.key !== key) })),
  reset: () => {
    storage?.removeItem(PROGRESS_KEY);
    set({ data: EMPTY_PROGRESS, reward: null });
  },
}));

function save(data: ProgressData, fresh: string[] = []) {
  try {
    storage?.setItem(PROGRESS_KEY, JSON.stringify(data));
  } catch {
    /* Speicher voll oder gesperrt – Fortschritt gilt dann nur für diese Sitzung */
  }
  useProgress.setState((s) => ({ data, toasts: [...s.toasts, ...fresh.map((id) => ({ key: ++toastKey, id }))] }));
}

/** Sprechblase des Gegners (nur im Feldzug) */
export function speak(text: string) {
  useProgress.setState({ bubble: { id: ++bubbleId, text } });
}

const pickLine = (lines: Bi[]) => say(lines[Math.floor(Math.random() * lines.length)]);

/** Partie aus dem Feldzug starten */
export function startCampaign(api: GameStoreApi, id: number) {
  const opp = getOpponent(id) ?? OPPONENTS[0];
  api.getState().startGame({ mode: 'ai', humanColor: 'w', aiLevel: opp.level, timeControlId: 'none', training: false, context: { kind: 'campaign', opponent: opp.id } });
}

/** Rätsel starten: die Seite am Zug ist der Spieler, die KI verteidigt */
export function startPuzzle(api: GameStoreApi, puzzle: Puzzle) {
  const humanColor: Color = puzzle.fen.split(' ')[1] === 'b' ? 'b' : 'w';
  api
    .getState()
    .startGame({ mode: 'ai', humanColor, aiLevel: 5, timeControlId: 'none', training: false, context: { kind: 'puzzle', id: puzzle.id, mateIn: puzzle.mateIn } }, puzzle.fen);
}

/**
 * Verbindet den Fortschritt mit der Partie: liest den Spielstand, vergibt Erfahrung, Sterne und Erfolge,
 * erkennt ein gescheitertes Rätsel und lässt den Gegner im Feldzug sprechen.
 */
export function bindProgress(api: GameStoreApi, store: StorageLike | null) {
  storage = store;
  let initial = EMPTY_PROGRESS;
  try {
    initial = decodeProgress(store?.getItem(PROGRESS_KEY) ?? null);
  } catch {
    initial = EMPTY_PROGRESS;
  }
  useProgress.setState({ data: initial });

  let track = { gameId: -1, undo: false, hint: false, xp: 0 };
  let lastSpoke = 0;
  const talk = (text: string, force = false) => {
    const now = Date.now();
    if (!force && now - lastSpoke < 3500) return;
    lastSpoke = now;
    speak(text);
  };

  return api.subscribe((s, prev) => {
    const ctx = s.settings.context;
    const campaign = ctx?.kind === 'campaign' ? getOpponent(ctx.opponent) : undefined;
    if (s.gameId !== track.gameId) {
      track = { gameId: s.gameId, undo: false, hint: false, xp: 0 };
      useProgress.setState({ reward: null, bubble: null });
      if (campaign && s.history.length === 0) setTimeout(() => api.getState().gameId === s.gameId && talk(pickLine(campaign.greet), true), 700);
      return;
    }
    if (s.history.length < prev.history.length) track.undo = true;
    if (s.hint && !prev.hint) track.hint = true;

    // Kriegerkampf beginnt
    if (s.battle && !prev.battle) {
      const d = useProgress.getState().data;
      const { data, fresh } = unlock({ ...d, duels: d.duels + 1 }, ['first-duel']);
      save(data, fresh);
      if (campaign) talk(pickLine(LINES.duel));
    }

    // Neuer Zug
    if (s.history.length === prev.history.length + 1) {
      const record = s.history[s.history.length - 1];
      const humanMove = s.settings.mode === 'local' || record.color === s.settings.humanColor;
      if (humanMove) {
        const ids = moveAchievements(record);
        if (ids.length) {
          const { data, fresh } = unlock(useProgress.getState().data, ids);
          if (fresh.length) save(data, fresh);
        }
      }
      if (campaign && !s.result && !s.battle) {
        if (record.isCheck) talk(pickLine(humanMove ? LINES.playerChecks : LINES.aiChecks));
        else if (record.isCapture && Math.random() < 0.7) talk(pickLine(humanMove ? LINES.playerCaptures : LINES.aiCaptures));
      }
      // Rätsel: nach der erlaubten Zahl eigener Züge ohne Matt ist es nicht gelöst
      if (ctx?.kind === 'puzzle' && humanMove && !s.result) {
        const own = s.history.filter((m) => m.color === s.settings.humanColor).length;
        if (own >= ctx.mateIn) setTimeout(() => {
          const cur = api.getState();
          if (cur.gameId === s.gameId && !cur.result) cur.resign();
        }, 0);
      }
    }

    // Partie beendet: Belohnung
    if (s.result && !prev.result) {
      const { data, reward } = applyResult(useProgress.getState().data, {
        settings: s.settings,
        result: s.result,
        history: s.history,
        undoUsed: track.undo,
        hintUsed: track.hint,
        xpAwarded: track.xp,
      });
      track.xp = reward.xpGame;
      useProgress.setState({ reward: { gameId: s.gameId, plies: s.history.length, value: reward }, bubble: null });
      save(data, reward.achievements);
    }
  });
}
