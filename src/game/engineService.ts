import type { DifficultyLevel } from '../engine/difficulty';
import type { EngineRequest, EngineResponse } from '../engine/rebell/protocol';
import type { SearchResult } from '../engine/types';
import { tr } from '../i18n';

/** Der Teil eines Web Workers, den der Dienst braucht (im Test durch eine Attrappe ersetzbar) */
export interface EngineWorker {
  postMessage(request: EngineRequest): void;
  onmessage: ((event: { data: EngineResponse }) => void) | null;
  onerror: ((event: { message?: string; preventDefault?: () => void }) => void) | null;
  terminate(): void;
}

/** Partie bis zur aktuellen Stellung */
export interface GameLine {
  startFen: string;
  moves: string[];
}

/** Was der Spielfluss von einer Engine braucht. Im Test durch eine Attrappe ersetzbar. */
export interface EngineService {
  /** Zug der KI auf der gegebenen Stufe (UCI) oder null, wenn kein Zug möglich ist */
  playMove(fen: string, level: DifficultyLevel, line?: GameLine): Promise<string | null>;
  /** Analyse mit voller Stärke (für Hinweise, Zugbewertung, Remisangebote) */
  analyse(fen: string, depth: number): Promise<SearchResult>;
  /** Neue Partie: Gelerntes vergessen */
  newGame(): void;
  /** Engine schon vorab starten, damit der erste Zug nicht wartet */
  warmUp(parts: { player: boolean; analysis: boolean }): void;
  /** Laufende KI-Suche abbrechen */
  cancelPlay(): void;
  dispose(): void;
}

/** Analyse rechnet höchstens so lange, auch auf langsamen Geräten */
const ANALYSIS_TIME_MS = 900;
const SEARCH_GRACE_MS = 15_000;

interface Pending {
  resolve: (result: SearchResult | null) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Ein Rechen-Worker mit Aufträgen und Antworten; abgebrochen wird durch Beenden des Workers. */
class EngineThread {
  private worker: EngineWorker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(private readonly createWorker: () => EngineWorker) {}

  private connect(): EngineWorker {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = ({ data }) => {
      const job = this.pending.get(data.id);
      if (!job) return;
      clearTimeout(job.timer);
      this.pending.delete(data.id);
      job.resolve(data.result);
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      this.fail(new Error(event.message || tr('Die Schach-KI konnte nicht geladen werden.')));
    };
    this.worker = worker;
    return worker;
  }

  warmUp() {
    this.connect();
  }

  newGame() {
    this.worker?.postMessage({ type: 'new-game' });
  }

  search(request: Omit<Extract<EngineRequest, { type: 'search' }>, 'id' | 'type'>): Promise<SearchResult | null> {
    return new Promise((resolve, reject) => {
      const worker = this.connect();
      const id = this.nextId++;
      const timeout = (request.limits.movetime ?? 0) + SEARCH_GRACE_MS;
      const timer = setTimeout(() => this.fail(new Error(tr('Zeitüberschreitung der Engine'))), timeout);
      this.pending.set(id, { resolve, reject, timer });
      worker.postMessage({ type: 'search', id, ...request });
    });
  }

  private close() {
    this.worker?.terminate();
    this.worker = null;
  }

  private settle(finish: (job: Pending) => void) {
    const jobs = [...this.pending.values()];
    this.pending.clear();
    for (const job of jobs) {
      clearTimeout(job.timer);
      finish(job);
    }
  }

  private fail(error: Error) {
    this.close();
    this.settle((job) => job.reject(error));
  }

  /** Bricht alles ab; die offenen Aufträge enden ohne Ergebnis */
  cancel() {
    if (this.pending.size === 0) return;
    this.close();
    this.settle((job) => job.resolve(null));
  }

  dispose() {
    this.close();
    this.settle((job) => job.resolve(null));
  }
}

/**
 * Zwei getrennte Rechen-Worker: einer spielt, einer analysiert.
 * So blockiert eine Trainingsanalyse nie den Zug der KI.
 */
export function createEngineService(createWorker: () => EngineWorker): EngineService {
  const player = new EngineThread(createWorker);
  const analyser = new EngineThread(createWorker);

  return {
    async playMove(fen, level, line) {
      const result = await player.search({ fen, limits: level.limits, line, margin: level.margin, book: level.book });
      return result?.bestMove ?? null;
    },
    async analyse(fen, depth) {
      const result = await analyser.search({ fen, limits: { depth, movetime: ANALYSIS_TIME_MS } });
      return result ?? { bestMove: null, depth: 0, pv: [] };
    },
    newGame() {
      player.newGame();
      analyser.newGame();
    },
    warmUp(parts) {
      if (parts.player) player.warmUp();
      if (parts.analysis) analyser.warmUp();
    },
    cancelPlay() {
      player.cancel();
    },
    dispose() {
      player.dispose();
      analyser.dispose();
    },
  };
}
