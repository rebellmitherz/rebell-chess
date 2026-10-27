import { createStore, type StoreApi } from 'zustand/vanilla';
import { ChessGame, parsePgn, parseUci, START_FEN } from '../core/chessGame';
import {
  createClock,
  flaggedColor,
  pauseClock,
  pressClock,
  restoreClock,
  resumeClock,
  stopClock,
  timeLeft,
  type ClockState,
} from '../core/clock';
import { classifyMove, explainMove, formatEval, type MoveClassification } from '../core/explain';
import { canStillCheckmate } from '../core/material';
import { trackPieces, type TrackedPiece } from '../core/pieceTracking';
import {
  opposite,
  type Color,
  type GameResult,
  type GameStatus,
  type MoveOption,
  type MoveRecord,
  type PieceSymbol,
  type ResultReason,
  type Square,
} from '../core/types';
import { getDifficulty } from '../engine/difficulty';
import { scoreToCp } from '../engine/uci';
import { FRESH_BATTLE_HISTORY, nextHistory, shouldFight, type BattleHistory } from './battleRules';
import { resolveDrop } from './drop';
import type { EngineService } from './engineService';
import {
  decodeSave,
  encodeSave,
  loadPreferences,
  SAVE_KEY,
  savePreferences,
  type SavedGame,
  type StorageLike,
} from './persistence';
import { DEFAULT_PREFERENCES, DEFAULT_SETTINGS, getTimeControl, type GameSettings, type Preferences } from './settings';
import { tr } from '../i18n';

export type Screen = 'menu' | 'game';
export type SfxKind = 'move' | 'capture' | 'strike' | 'castle' | 'check' | 'promote' | 'illegal' | 'select' | 'mate' | 'win' | 'loss' | 'draw' | 'ui';

export interface HintState {
  ply: number;
  status: 'loading' | 'ready' | 'error';
  from?: Square;
  to?: Square;
  title?: string;
  points?: string[];
  evalText?: string;
}

export interface FeedbackState {
  /** Index des bewerteten Zuges in der Zugliste */
  ply: number;
  status: 'loading' | 'ready' | 'error';
  moveTitle: string;
  points: string[];
  classification?: MoveClassification;
  better?: { san: string; title: string; points: string[] };
  evalText?: string;
}

export interface AnalysisState {
  /** analysierte Stellung */
  fen: string;
  status: 'loading' | 'ready' | 'error';
  /** Bewertung aus Sicht von Weiß in Centipawns */
  cp?: number;
  /** Matt in n Zügen aus Sicht von Weiß (positiv = Weiß setzt matt) */
  mate?: number;
  /** bester Zug in SAN */
  best?: string;
  depth?: number;
}

/** Laufender Kriegerkampf nach einem Schlagzug – die Szene spielt ihn ab und meldet das Ende (endBattle). */
export interface BattleState {
  id: number;
  /** Halbzug (Länge der Zugliste), der den Kampf ausgelöst hat */
  ply: number;
  from: Square;
  to: Square;
  /** Feld der geschlagenen Figur (bei en passant nicht das Zielfeld) */
  victimSquare: Square;
  attacker: { color: Color; type: PieceSymbol };
  victim: { color: Color; type: PieceSymbol };
}

export interface GameData {
  screen: Screen;
  /** Es wurde eine Partie gestartet (für „Zurück zur Partie“) */
  active: boolean;
  gameId: number;
  settings: GameSettings;
  prefs: Preferences;
  startFen: string;
  fen: string;
  history: MoveRecord[];
  status: GameStatus;
  /** Endergebnis (aus der Stellung oder durch Zeit/Aufgabe/Einigung) */
  result: GameResult | null;
  pieces: TrackedPiece[];
  captured: TrackedPiece[];
  selected: Square | null;
  targets: MoveOption[];
  pendingPromotion: { from: Square; to: Square } | null;
  clock: ClockState;
  clockSnapshots: Array<Record<Color, number>>;
  paused: boolean;
  engineThinking: boolean;
  engineError: string | null;
  hint: HintState | null;
  feedback: FeedbackState | null;
  drawOffer: { by: Color } | null;
  /** Analyse-Ansicht: Anzahl gezeigter Halbzüge (null = aktuelle Stellung) */
  viewPly: number | null;
  /** Figuren und Schach der Analyse-Stellung (nur wenn viewPly gesetzt) */
  view: { pieces: TrackedPiece[]; checkSquare: Square | null } | null;
  /** Engine-Bewertung der gezeigten Stellung (nur im Training oder nach Partieende) */
  analysis: AnalysisState | null;
  hasSave: boolean;
  /** Welche Farbe unten steht (Kamera) */
  viewSide: Color;
  sfx: { id: number; kind: SfxKind } | null;
  toast: { id: number; text: string } | null;
  /** Kriegerkampf läuft: Uhr steht, Eingaben und KI warten */
  battle: BattleState | null;
}

export interface GameActions {
  startGame(settings: GameSettings, startFen?: string): void;
  continueSaved(): boolean;
  importPgn(pgn: string): boolean;
  exportPgn(): string;
  openMenu(): void;
  closeMenu(): void;
  selectSquare(square: Square): void;
  /** Gezogene Figur von `from` über Feld `over` losgelassen (Drag & Drop) */
  dropPiece(from: Square, over: Square | null): void;
  tryMove(from: Square, to: Square, promotion?: PieceSymbol): boolean;
  choosePromotion(piece: PieceSymbol | null): void;
  undo(): void;
  restart(): void;
  resign(): void;
  offerDraw(): void;
  answerDraw(accept: boolean): void;
  setPaused(paused: boolean): void;
  tick(): void;
  requestHint(): void;
  clearHint(): void;
  dismissFeedback(): void;
  setPrefs(prefs: Partial<Preferences>): void;
  flipView(): void;
  saveNow(): void;
  showToast(text: string): void;
  /** Stellung nach `ply` Halbzügen zeigen (null = zurück zur Partie) */
  viewMove(ply: number | null): void;
  stepView(delta: number): void;
  /** Kriegerkampf beendet oder übersprungen */
  endBattle(): void;
}

export type GameStore = GameData & GameActions;
export type GameStoreApi = StoreApi<GameStore>;

export interface StoreDeps {
  engine: EngineService | null;
  storage: StorageLike | null;
  now: () => number;
  random: () => number;
  /** Zwei Spieler: Verzögerung, bevor sich das Brett zum nächsten Spieler dreht */
  boardTurnDelayMs: number;
  /** Mindestdenkzeit der KI, damit Züge nicht schlagartig erscheinen */
  aiDelayMs: number;
  defaultPrefs: Preferences;
  /** Eine Szene spielt Kriegerkämpfe ab (ohne Szene, z. B. in Tests, gibt es keine) */
  battleScenes: boolean;
  /** Sicherheitsgrenze: so lange wartet die Partie höchstens auf das Ende eines Kampfes */
  battleTimeoutMs: number;
}

const POSITIONAL: ResultReason[] = ['checkmate', 'stalemate', 'insufficient-material', 'threefold-repetition', 'fifty-move-rule'];
const isPositional = (r: GameResult) => POSITIONAL.includes(r.reason);

/** Darf der Mensch gerade eine Figur auswählen oder ziehen? */
export function canHumanInteract(s: GameData): boolean {
  const humanToMove = s.settings.mode === 'local' || s.status.turn === s.settings.humanColor;
  return (
    s.viewPly === null &&
    !s.battle &&
    s.screen === 'game' &&
    s.active &&
    !s.result &&
    !s.paused &&
    !s.pendingPromotion &&
    !s.drawOffer &&
    !s.engineThinking &&
    humanToMove
  );
}

/** Anzahl der gezeigten Halbzüge (Analyse-Ansicht oder aktuelle Stellung) */
export function displayPly(s: Pick<GameData, 'viewPly' | 'history'>): number {
  return s.viewPly ?? s.history.length;
}

/** FEN der gezeigten Stellung */
export function displayFen(s: Pick<GameData, 'viewPly' | 'history' | 'startFen'>): string {
  const ply = displayPly(s);
  return ply === 0 ? s.startFen : s.history[ply - 1].fenAfter;
}

/** Bewertung nur im Training oder nach Partieende – sonst wäre sie gegen die KI eine Hilfe */
export function analysisAllowed(s: Pick<GameData, 'active' | 'settings' | 'result'>): boolean {
  return s.active && (s.settings.training || s.result !== null);
}

const HINT_DEPTH = 14;
const EVAL_DEPTH = 13;
const FEEDBACK_DEPTH = 12;

/** Bewertung aus Sicht von Weiß als Text */
function evalText(cpForMover: number, mover: Color): string {
  const cp = mover === 'w' ? cpForMover : -cpForMover;
  if (Math.abs(cp) >= 90_000) return cp > 0 ? tr('Weiß setzt matt') : tr('Schwarz setzt matt');
  return tr('{eval} (aus Sicht von Weiß)', { eval: formatEval(cp, undefined) });
}

function sanOf(fen: string, uci: string): string {
  return new ChessGame(fen).moveUci(uci)?.san ?? uci;
}

/**
 * Bewertet die gezeigte Stellung mit der Analyse-Engine, sobald sie sich ändert (nur wenn erlaubt).
 * Antworten für eine inzwischen andere Stellung werden verworfen.
 */
function attachAnalysis(api: GameStoreApi, engine: EngineService) {
  let lastKey = '';
  api.subscribe((s) => {
    const allowed = analysisAllowed(s) && s.screen === 'game';
    const fen = displayFen(s);
    const key = allowed ? fen : '';
    if (key === lastKey) return;
    lastKey = key;
    if (!allowed) {
      if (s.analysis) api.setState({ analysis: null });
      return;
    }
    const position = new ChessGame(fen);
    const result = position.status().result;
    if (result) {
      // Endstellung: kein Zug mehr – Ergebnis direkt anzeigen
      api.setState({
        analysis: result.reason === 'checkmate'
          ? { fen, status: 'ready', mate: result.winner === 'w' ? 1 : -1, depth: 0 }
          : { fen, status: 'ready', cp: 0, depth: 0 },
      });
      return;
    }
    api.setState({ analysis: { fen, status: 'loading' } });
    const sign = position.turn === 'w' ? 1 : -1;
    engine.analyse(fen, EVAL_DEPTH).then(
      (res) => {
        if (api.getState().analysis?.fen !== fen) return;
        api.setState({
          analysis: {
            fen,
            status: 'ready',
            cp: res.scoreCp !== undefined ? res.scoreCp * sign : undefined,
            mate: res.mate !== undefined ? res.mate * sign : undefined,
            best: res.bestMove ? sanOf(fen, res.bestMove) : undefined,
            depth: res.depth,
          },
        });
      },
      () => {
        if (api.getState().analysis?.fen === fen) api.setState({ analysis: { fen, status: 'error' } });
      },
    );
  });
}

export function createGameStore(partialDeps: Partial<StoreDeps> = {}): GameStoreApi {
  const api = createGameStoreCore(partialDeps);
  if (partialDeps.engine) attachAnalysis(api, partialDeps.engine);
  return api;
}

function createGameStoreCore(partialDeps: Partial<StoreDeps>): GameStoreApi {
  const deps: StoreDeps = {
    engine: null,
    storage: null,
    now: () => Date.now(),
    random: Math.random,
    aiDelayMs: 450,
    boardTurnDelayMs: 750,
    defaultPrefs: DEFAULT_PREFERENCES,
    battleScenes: false,
    battleTimeoutMs: 15_000,
    ...partialDeps,
  };

  let game = new ChessGame();
  let sfxId = 0;
  let toastId = 0;
  let aiToken: { gameId: number; ply: number } | null = null;
  let pausedByMenu = false;
  let drawPending = false;
  let battleId = 0;
  let battleHistory: BattleHistory = FRESH_BATTLE_HISTORY;
  /** Kampf-Zustand neben dem Store: Uhr angehalten, Brett soll danach drehen, Schlussklang aufgeschoben */
  let battleHeldClock = false;
  let turnAfterBattle = false;
  let finishSfxAfterBattle: SfxKind | null = null;
  let battleWaiters: Array<() => void> = [];

  return createStore<GameStore>()((set, get) => {
    const sfx = (kind: SfxKind) => ({ sfx: { id: ++sfxId, kind } });
    const toast = (text: string) => ({ toast: { id: ++toastId, text } });

    const derive = () => {
      const history = game.history();
      const tracked = trackPieces(game.startFen, history);
      return {
        startFen: game.startFen,
        fen: game.fen,
        history,
        status: game.status(),
        pieces: tracked.pieces,
        captured: tracked.captured,
      };
    };

    const canInteract = canHumanInteract;

    const persist = () => {
      const s = get();
      if (!deps.storage || !s.active) return;
      const now = deps.now();
      const save: SavedGame = {
        version: 1,
        savedAt: new Date(now).toISOString(),
        settings: s.settings,
        startFen: game.startFen,
        moves: game.uciMoves(),
        clock: {
          remaining: { w: timeLeft(s.clock, 'w', now), b: timeLeft(s.clock, 'b', now) },
          started: s.clock.running !== null,
        },
        clockSnapshots: s.clockSnapshots,
        result: s.result && !isPositional(s.result) ? s.result : null,
      };
      try {
        deps.storage.setItem(SAVE_KEY, encodeSave(save));
        if (!s.hasSave) set({ hasSave: true });
      } catch {
        /* Speicher nicht verfügbar */
      }
    };

    const cancelAi = () => {
      if (aiToken) {
        aiToken = null;
        deps.engine?.cancelPlay();
      }
      if (get().engineThinking) set({ engineThinking: false });
    };

    const finish = (result: GameResult, extra: Partial<GameData> = {}) => {
      cancelAi();
      const s = get();
      let kind: SfxKind;
      // Schachmatt hat sein eigenes Finale (Aufbau, Wums, Glocke) – danach kommt das Ergebnisfenster
      if (result.reason === 'checkmate') kind = 'mate';
      else if (result.winner === null) kind = 'draw';
      else if (s.settings.mode === 'ai') kind = result.winner === s.settings.humanColor ? 'win' : 'loss';
      else kind = 'win';
      // Während eines Kampfes erst danach jubeln (der Ergebnis-Dialog wartet ebenfalls)
      if (s.battle) finishSfxAfterBattle = kind;
      set({
        result,
        clock: stopClock(s.clock, deps.now()),
        selected: null,
        targets: [],
        pendingPromotion: null,
        drawOffer: null,
        paused: false,
        ...(s.battle ? {} : sfx(kind)),
        ...extra,
      });
      persist();
    };

    const releaseBattleWaiters = () => {
      const waiters = battleWaiters;
      battleWaiters = [];
      waiters.forEach((w) => w());
    };
    const battleOver = () => (get().battle ? new Promise<void>((r) => battleWaiters.push(r)) : Promise.resolve());

    /** Kampf ohne Nachwirkungen verwerfen (neue Partie, Rückgängig) – Uhr und Ansicht setzt der Aufrufer */
    const dropBattle = () => {
      battleHeldClock = false;
      turnAfterBattle = false;
      finishSfxAfterBattle = null;
      if (get().battle) set({ battle: null });
      releaseBattleWaiters();
    };

    const aiShouldMove = (s: GameData) =>
      s.screen === 'game' &&
      s.active &&
      s.settings.mode === 'ai' &&
      !s.result &&
      !s.paused &&
      !s.pendingPromotion &&
      s.status.turn !== s.settings.humanColor;

    const scheduleAi = () => {
      const s = get();
      if (!aiShouldMove(s) || s.engineThinking) return;
      const token = { gameId: s.gameId, ply: game.ply };
      aiToken = token;
      set({ engineThinking: true });

      const level = getDifficulty(s.settings.aiLevel);
      const fen = game.fen;
      const started = deps.now();
      const legal = game.allLegalMoves();
      const pickRandom = () => legal[Math.floor(deps.random() * legal.length)]?.uci ?? null;
      const engine = deps.engine;
      const useRandom = !engine || deps.random() < level.randomMoveChance;

      const job: Promise<{ uci: string | null; error?: string }> = useRandom
        ? Promise.resolve({ uci: pickRandom(), error: engine ? undefined : 'Keine Engine geladen' })
        : engine.playMove(fen, level).then(
            (uci) => ({ uci }),
            (err: unknown) => ({ uci: pickRandom(), error: err instanceof Error ? err.message : String(err) }),
          );

      void job.then(async ({ uci, error }) => {
        const wait = deps.aiDelayMs - (deps.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        // Läuft noch ein Kampf, zieht die KI erst danach (und lässt der Kamera Zeit zurückzufahren)
        if (get().battle) {
          await battleOver();
          if (deps.aiDelayMs > 0) await new Promise((r) => setTimeout(r, deps.aiDelayMs));
        }
        if (aiToken !== token) return;
        aiToken = null;
        const cur = get();
        if (cur.gameId !== token.gameId || game.ply !== token.ply || cur.result) {
          set({ engineThinking: false });
          return;
        }
        const record = (uci && game.moveUci(uci)) || game.moveUci(pickRandom() ?? '');
        set({
          engineThinking: false,
          ...(error
            ? { engineError: error, ...toast(tr('Die Schach-KI ist nicht erreichbar – es wurde ein Ersatzzug gespielt.')) }
            : {}),
        });
        if (record) afterMove(record, false);
      });
    };

    const startFeedback = (ply: number, record: MoveRecord) => {
      const explanation = explainMove(record.fenBefore, record);
      const gameId = get().gameId;
      set({
        feedback: {
          ply,
          status: deps.engine ? 'loading' : 'error',
          moveTitle: explanation?.title ?? record.san,
          points: explanation?.points ?? [],
        },
      });
      const engine = deps.engine;
      if (!engine) return;
      const stillCurrent = () => get().gameId === gameId && game.ply > ply && get().feedback?.ply === ply;

      (async () => {
        const best = await engine.analyse(record.fenBefore, FEEDBACK_DEPTH);
        const bestCp = scoreToCp(best.scoreCp, best.mate);
        let playedCp = bestCp;
        if (best.bestMove !== record.uci) {
          if (record.isCheckmate) playedCp = 100_000;
          else {
            const after = await engine.analyse(record.fenAfter, FEEDBACK_DEPTH - 1);
            playedCp = after.bestMove === null ? 0 : -scoreToCp(after.scoreCp, after.mate);
          }
        }
        if (!stillCurrent()) return;
        const classification = classifyMove(bestCp, playedCp);
        let better: FeedbackState['better'];
        if (best.bestMove && best.bestMove !== record.uci && ['inaccuracy', 'mistake', 'blunder'].includes(classification.quality)) {
          const ex = explainMove(record.fenBefore, parseUci(best.bestMove)!, { suggested: true });
          better = { san: sanOf(record.fenBefore, best.bestMove), title: ex?.title ?? best.bestMove, points: ex?.points ?? [] };
        }
        const fb = get().feedback!;
        set({ feedback: { ...fb, status: 'ready', classification, better, evalText: evalText(playedCp, record.color) } });
      })().catch(() => {
        if (stillCurrent()) set({ feedback: { ...get().feedback!, status: 'error' } });
      });
    };

    const afterMove = (record: MoveRecord, byHuman: boolean) => {
      const s = get();
      const now = deps.now();
      const snapshot = { w: timeLeft(s.clock, 'w', now), b: timeLeft(s.clock, 'b', now) };
      let clock = pressClock(s.clock, record.color, now, s.paused);
      const d = derive();
      const mode = s.prefs.battleMode;
      const wantsFight =
        deps.battleScenes &&
        s.screen === 'game' &&
        record.isCapture &&
        (mode === 'always' || (mode === 'warriors' && shouldFight(record, d.history.length, battleHistory)));
      // Nur Schläge zählen für den Verlauf (Wichtiges bekommt einen Kampf, der Rest bleibt schnell)
      if (deps.battleScenes && mode === 'warriors' && record.isCapture) battleHistory = nextHistory(battleHistory, wantsFight, d.history.length);
      const battle: BattleState | null =
        wantsFight
          ? {
              id: ++battleId,
              ply: d.history.length,
              from: record.from,
              to: record.to,
              victimSquare: record.isEnPassant ? ((record.to[0] + record.from[1]) as Square) : record.to,
              attacker: { color: record.color, type: record.piece },
              victim: { color: opposite(record.color), type: record.captured ?? 'p' },
            }
          : null;
      if (battle) {
        // Die Uhr steht, solange gekämpft wird – der Kampf kostet keinem Spieler Bedenkzeit
        battleHeldClock = clock.since !== null;
        clock = pauseClock(clock, now);
        turnAfterBattle = false;
        finishSfxAfterBattle = null;
        const id = battle.id;
        setTimeout(() => {
          if (get().battle?.id === id) get().endBattle();
        }, deps.battleTimeoutMs);
      }
      // Zwei Spieler: Brett erst drehen, wenn die Figur gelandet ist – so sieht man den Zug noch
      // (nach einem Kampf erst, wenn er vorbei ist)
      if (battle && s.settings.mode === 'local' && s.prefs.turnBoard && !d.status.result) turnAfterBattle = true;
      else if (s.settings.mode === 'local' && s.prefs.turnBoard && !d.status.result) {
        const gameId = s.gameId;
        const ply = game.ply;
        setTimeout(() => {
          const cur = get();
          if (cur.gameId === gameId && game.ply === ply && cur.prefs.turnBoard) set({ viewSide: cur.status.turn });
        }, deps.boardTurnDelayMs);
      }
      const viewSide = s.viewSide;
      const kind: SfxKind = record.promotion
        ? 'promote'
        : record.isKingsideCastle || record.isQueensideCastle
          ? 'castle'
          : record.isCheck
            ? 'check'
            : record.isCapture
              ? 'capture'
              : 'move';
      set({
        ...d,
        clock,
        clockSnapshots: [...s.clockSnapshots, snapshot],
        selected: null,
        targets: [],
        pendingPromotion: null,
        hint: null,
        drawOffer: null,
        viewSide,
        battle,
        // Beim Kampf kommen die Klänge aus der Szene (Schach und Umwandlung bleiben hörbar)
        ...(battle && kind === 'capture' ? {} : sfx(kind)),
      });
      if (d.status.result) finish(d.status.result);
      else persist();
      if (byHuman && s.settings.training) startFeedback(game.ply - 1, record);
      scheduleAi();
    };

    const humanMove = (from: Square, to: Square, promotion?: PieceSymbol): boolean => {
      const record = game.move({ from, to, promotion });
      if (!record) {
        set({ selected: null, targets: [], ...sfx('illegal') });
        return false;
      }
      afterMove(record, true);
      return true;
    };

    const loadGame = (
      settings: GameSettings,
      startFen: string,
      moves: string[],
      restore?: { remaining: Record<Color, number>; snapshots: Array<Record<Color, number>>; result: GameResult | null; paused: boolean },
    ) => {
      cancelAi();
      dropBattle();
      battleHistory = FRESH_BATTLE_HISTORY;
      drawPending = false;
      pausedByMenu = false;
      game = ChessGame.fromUciMoves(startFen, moves);
      const now = deps.now();
      const tc = getTimeControl(settings.timeControlId);
      let clock = createClock(tc.initialMs, tc.incrementMs);
      const started = game.ply > 0;
      const paused = restore?.paused ?? false;
      clock = restoreClock(clock, restore?.remaining ?? clock.remaining, game.turn, started, now, paused);
      const d = derive();
      const result = d.status.result ?? restore?.result ?? null;
      if (result) clock = stopClock(clock, now);
      deps.engine?.newGame();
      deps.engine?.warmUp({ player: settings.mode === 'ai', analysis: settings.training });
      const prefs = get().prefs;
      set({
        screen: 'game',
        active: true,
        gameId: get().gameId + 1,
        settings,
        ...d,
        result,
        clock,
        clockSnapshots: restore?.snapshots.length === game.ply ? restore.snapshots : [],
        selected: null,
        targets: [],
        pendingPromotion: null,
        paused: paused && !result,
        engineThinking: false,
        engineError: null,
        hint: null,
        feedback: null,
        drawOffer: null,
        viewPly: null,
        view: null,
        analysis: null,
        viewSide: settings.mode === 'ai' ? settings.humanColor : prefs.turnBoard ? d.status.turn : 'w',
        ...sfx('ui'),
      });
      persist();
      scheduleAi();
    };

    const initialPrefs = loadPreferences(deps.storage, deps.defaultPrefs);
    const initialDerived = derive();
    let initialHasSave = false;
    try {
      initialHasSave = decodeSave(deps.storage?.getItem(SAVE_KEY) ?? null) !== null;
    } catch {
      initialHasSave = false;
    }

    return {
      screen: 'menu',
      active: false,
      gameId: 0,
      settings: DEFAULT_SETTINGS,
      prefs: initialPrefs,
      ...initialDerived,
      result: null,
      selected: null,
      targets: [],
      pendingPromotion: null,
      clock: createClock(0, 0),
      clockSnapshots: [],
      paused: false,
      engineThinking: false,
      engineError: null,
      hint: null,
      feedback: null,
      drawOffer: null,
      viewPly: null,
      view: null,
      analysis: null,
      hasSave: initialHasSave,
      viewSide: 'w',
      sfx: null,
      toast: null,
      battle: null,

      startGame(settings, startFen = START_FEN) {
        loadGame(settings, startFen, []);
      },

      continueSaved() {
        let save: SavedGame | null = null;
        try {
          save = decodeSave(deps.storage?.getItem(SAVE_KEY) ?? null);
        } catch {
          save = null;
        }
        if (!save) {
          set({ hasSave: false, ...toast(tr('Kein gültiger Spielstand gefunden.')) });
          return false;
        }
        const clockOn = getTimeControl(save.settings.timeControlId).initialMs > 0;
        loadGame(save.settings, save.startFen, save.moves, {
          remaining: save.clock.remaining,
          snapshots: save.clockSnapshots,
          result: save.result,
          paused: clockOn && save.moves.length > 0 && !save.result,
        });
        return true;
      },

      importPgn(pgn) {
        const parsed = parsePgn(pgn);
        if (!parsed) {
          set(toast(tr('Die PGN konnte nicht gelesen werden.')));
          return false;
        }
        loadGame({ ...get().settings, mode: 'local', timeControlId: 'none' }, parsed.startFen, parsed.moves);
        set(toast(tr('Partie mit {n} Halbzügen geladen.', { n: parsed.moves.length })));
        return true;
      },

      exportPgn() {
        const s = get();
        const level = getDifficulty(s.settings.aiLevel);
        const names: Record<Color, string> =
          s.settings.mode === 'ai'
            ? s.settings.humanColor === 'w'
              ? { w: 'Spieler', b: `Rebell-KI (${level.name})` }
              : { w: `Rebell-KI (${level.name})`, b: 'Spieler' }
            : { w: 'Weiß', b: 'Schwarz' };
        const d = new Date(deps.now());
        const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        const result = s.result ? (s.result.winner === 'w' ? '1-0' : s.result.winner === 'b' ? '0-1' : '1/2-1/2') : '*';
        const tc = getTimeControl(s.settings.timeControlId);
        return game.pgn({
          Event: 'Rebell Chess 3D',
          Site: 'Rebell Chess 3D',
          Date: date,
          White: names.w,
          Black: names.b,
          Result: result,
          ...(tc.initialMs > 0 ? { TimeControl: `${tc.initialMs / 1000}+${tc.incrementMs / 1000}` } : {}),
        });
      },

      openMenu() {
        get().endBattle();
        const s = get();
        if (s.active && !s.result && !s.paused && s.clock.running && s.clock.since !== null) {
          set({ paused: true, clock: pauseClock(s.clock, deps.now()) });
          pausedByMenu = true;
        }
        set({ screen: 'menu', selected: null, targets: [], ...sfx('ui') });
      },

      closeMenu() {
        if (!get().active) return;
        set({ screen: 'game', ...sfx('ui') });
        if (pausedByMenu) {
          pausedByMenu = false;
          get().setPaused(false);
        } else scheduleAi();
      },

      selectSquare(square) {
        const s = get();
        if (!canInteract(s)) return;
        if (s.selected && s.targets.some((t) => t.to === square)) {
          get().tryMove(s.selected, square);
          return;
        }
        const piece = game.pieceAt(square);
        if (piece && piece.color === s.status.turn) {
          if (s.selected === square) {
            set({ selected: null, targets: [] });
            return;
          }
          const targets = game.legalMovesFrom(square);
          set({ selected: square, targets, ...sfx(targets.length ? 'select' : 'illegal') });
          return;
        }
        if (s.selected) set({ selected: null, targets: [], ...sfx('illegal') });
      },

      dropPiece(from, over) {
        const s = get();
        if (!canInteract(s)) return;
        const targets = s.selected === from ? s.targets : game.legalMovesFrom(from);
        const action = resolveDrop(from, over, targets);
        if (action.kind === 'move') get().tryMove(from, action.to);
        else if (action.kind === 'keep') {
          if (s.selected !== from) set({ selected: from, targets });
        } else set({ selected: null, targets: [], ...sfx('illegal') });
      },

      tryMove(from, to, promotion) {
        const s = get();
        if (!canInteract(s)) return false;
        if (!promotion && game.isPromotionMove(from, to)) {
          set({ pendingPromotion: { from, to }, selected: from, targets: [] });
          return true;
        }
        return humanMove(from, to, promotion);
      },

      choosePromotion(piece) {
        const pending = get().pendingPromotion;
        if (!pending) return;
        set({ pendingPromotion: null });
        if (!piece) {
          set({ selected: null, targets: [] });
          return;
        }
        humanMove(pending.from, pending.to, piece);
      },

      undo() {
        const s = get();
        if (!s.active || s.screen !== 'game') return;
        if (s.pendingPromotion) {
          set({ pendingPromotion: null, selected: null, targets: [] });
          return;
        }
        const history = game.history();
        if (history.length === 0) {
          if (s.result) {
            set({ result: null, ...sfx('move') });
            persist();
            scheduleAi();
          }
          return;
        }
        let plies = 1;
        if (s.settings.mode === 'ai' && history[history.length - 1].color !== s.settings.humanColor) {
          if (history.length < 2) {
            set(toast(tr('Es gibt noch keinen eigenen Zug zum Zurücknehmen.')));
            return;
          }
          plies = 2;
        }
        cancelAi();
        dropBattle();
        const now = deps.now();
        const snaps = [...s.clockSnapshots];
        let snapshot: Record<Color, number> = { w: timeLeft(s.clock, 'w', now), b: timeLeft(s.clock, 'b', now) };
        for (let i = 0; i < plies; i++) {
          game.undo();
          snapshot = snaps.pop() ?? snapshot;
        }
        const d = derive();
        const clock = restoreClock(s.clock, snapshot, d.status.turn, game.ply > 0, now, s.paused);
        set({
          ...d,
          clock,
          clockSnapshots: snaps,
          result: d.status.result,
          selected: null,
          targets: [],
          hint: null,
          feedback: null,
          drawOffer: null,
          viewPly: null,
          view: null,
          engineThinking: false,
          viewSide: s.settings.mode === 'local' && s.prefs.turnBoard ? d.status.turn : s.viewSide,
          ...sfx('move'),
        });
        persist();
        scheduleAi();
      },

      restart() {
        loadGame(get().settings, START_FEN, []);
      },

      resign() {
        const s = get();
        if (!s.active || s.result) return;
        const loser = s.settings.mode === 'ai' ? s.settings.humanColor : s.status.turn;
        finish({ winner: opposite(loser), reason: 'resignation' });
      },

      offerDraw() {
        const s = get();
        if (!s.active || s.result || s.screen !== 'game' || s.drawOffer || s.pendingPromotion) return;
        if (s.settings.mode === 'local') {
          set({ drawOffer: { by: s.status.turn }, ...sfx('ui') });
          return;
        }
        if (!canInteract(s) || drawPending) return;
        const engine = deps.engine;
        if (!engine) {
          set(toast(tr('Die Schach-KI ist nicht verfügbar.')));
          return;
        }
        drawPending = true;
        set(toast(tr('Rebell-KI prüft dein Remisangebot …')));
        const ply = game.ply;
        const gameId = s.gameId;
        engine.analyse(game.fen, 12).then(
          (res) => {
            drawPending = false;
            const cur = get();
            if (cur.gameId !== gameId || game.ply !== ply || cur.result) return;
            // Der Mensch ist am Zug – aus Sicht der KI ist die Bewertung umgekehrt.
            const aiCp = -scoreToCp(res.scoreCp, res.mate);
            const accept = aiCp <= -80 || (Math.abs(aiCp) <= 25 && game.ply >= 40);
            if (accept) finish({ winner: null, reason: 'agreement' }, toast(tr('Rebell-KI nimmt das Remis an.')));
            else set(toast(tr('Rebell-KI lehnt das Remis ab und spielt weiter.')));
          },
          () => {
            drawPending = false;
            set(toast(tr('Das Remisangebot konnte nicht geprüft werden.')));
          },
        );
      },

      answerDraw(accept) {
        const s = get();
        if (!s.drawOffer) return;
        if (accept) finish({ winner: null, reason: 'agreement' });
        else set({ drawOffer: null, ...toast(tr('Remis abgelehnt – die Partie geht weiter.')) });
      },

      setPaused(paused) {
        const s = get();
        if (!s.active || s.result || paused === s.paused) return;
        const now = deps.now();
        set({
          paused,
          // Während eines Kampfes läuft die Uhr erst nach dessen Ende weiter
          clock: paused ? pauseClock(s.clock, now) : s.battle ? s.clock : resumeClock(s.clock, now),
          selected: null,
          targets: [],
          ...sfx('ui'),
        });
        persist();
        if (!paused) scheduleAi();
      },

      tick() {
        const s = get();
        if (!s.active || s.result || !s.clock.enabled) return;
        const flagged = flaggedColor(s.clock, deps.now());
        if (!flagged) return;
        const winner = opposite(flagged);
        set({ clock: { ...s.clock, remaining: { ...s.clock.remaining, [flagged]: 0 } } });
        finish(
          canStillCheckmate(game.pieces(), winner)
            ? { winner, reason: 'timeout' }
            : { winner: null, reason: 'timeout-insufficient-material' },
        );
      },

      requestHint() {
        const s = get();
        if (!canInteract(s)) return;
        const ply = game.ply;
        const engine = deps.engine;
        if (!engine) {
          set({ hint: { ply, status: 'error' } });
          return;
        }
        const gameId = s.gameId;
        const fen = game.fen;
        const mover = s.status.turn;
        set({ hint: { ply, status: 'loading' }, selected: null, targets: [], ...sfx('ui') });
        engine.analyse(fen, HINT_DEPTH).then(
          (res) => {
            const cur = get();
            if (cur.gameId !== gameId || game.ply !== ply || cur.hint?.ply !== ply) return;
            const input = res.bestMove ? parseUci(res.bestMove) : null;
            if (!input) {
              set({ hint: null });
              return;
            }
            const ex = explainMove(fen, input, { suggested: true });
            set({
              hint: {
                ply,
                status: 'ready',
                from: input.from,
                to: input.to,
                title: ex?.title,
                points: ex?.points,
                evalText: evalText(scoreToCp(res.scoreCp, res.mate), mover),
              },
            });
          },
          () => {
            if (get().hint?.ply === ply) set({ hint: { ply, status: 'error' } });
          },
        );
      },

      clearHint() {
        set({ hint: null });
      },

      dismissFeedback() {
        set({ feedback: null });
      },

      setPrefs(partial) {
        const s = get();
        const prefs = { ...s.prefs, ...partial };
        savePreferences(deps.storage, prefs);
        const viewSide = partial.turnBoard && s.settings.mode === 'local' && s.active ? s.status.turn : s.viewSide;
        set({ prefs, viewSide });
      },

      flipView() {
        set({ viewSide: opposite(get().viewSide), ...sfx('ui') });
      },

      saveNow() {
        if (!deps.storage) {
          set(toast(tr('Speichern ist in diesem Browser nicht möglich (privater Modus?).')));
          return;
        }
        persist();
        set(toast(tr('Partie gespeichert.')));
      },

      showToast(text) {
        set(toast(text));
      },

      viewMove(ply) {
        get().endBattle();
        const s = get();
        if (!s.active) return;
        const total = s.history.length;
        if (ply === null || ply >= total) {
          if (s.viewPly !== null) set({ viewPly: null, view: null, ...sfx('select') });
          return;
        }
        const target = Math.max(0, ply);
        if (target === s.viewPly) return;
        const history = s.history.slice(0, target);
        const fen = target === 0 ? s.startFen : history[target - 1].fenAfter;
        set({
          viewPly: target,
          view: { pieces: trackPieces(s.startFen, history).pieces, checkSquare: new ChessGame(fen).status().checkSquare },
          selected: null,
          targets: [],
          hint: null,
          ...sfx('move'),
        });
      },

      stepView(delta) {
        const s = get();
        get().viewMove(displayPly(s) + delta);
      },

      endBattle() {
        const s = get();
        if (!s.battle) return;
        const now = deps.now();
        const clock = battleHeldClock && !s.paused && !s.result ? resumeClock(s.clock, now) : s.clock;
        const turn = turnAfterBattle && s.settings.mode === 'local' && s.prefs.turnBoard && !s.result;
        const late = finishSfxAfterBattle;
        battleHeldClock = false;
        turnAfterBattle = false;
        finishSfxAfterBattle = null;
        set({ battle: null, clock, viewSide: turn ? s.status.turn : s.viewSide, ...(late ? sfx(late) : {}) });
        releaseBattleWaiters();
      },
    };
  });
}
