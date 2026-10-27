import { parseBestMove, parseInfoLine, type UciInfo } from './uci';
import { tr } from '../i18n';

/** Verbindung zu einem Engine-Prozess (Web Worker im Browser, WASM-Modul in Node-Tests). */
export interface EngineTransport {
  send(command: string): void;
  onLine(listener: (line: string) => void): void;
  onError?(listener: (message: string) => void): void;
  terminate(): void;
}

export interface SearchLimits {
  depth?: number;
  movetime?: number;
  nodes?: number;
}

export interface SearchResult {
  bestMove: string | null;
  ponder?: string;
  depth: number;
  scoreCp?: number;
  mate?: number;
  pv: string[];
}

export type EngineOptions = Record<string, string | number | boolean>;

const INIT_TIMEOUT_MS = 20_000;
const SEARCH_GRACE_MS = 15_000;

/**
 * Promise-basierte UCI-Anbindung an Stockfish. Alle Befehle laufen nacheinander
 * über eine Warteschlange; `stop()` wirkt sofort und beendet die laufende Suche.
 */
export class StockfishEngine {
  private listeners = new Set<(line: string) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private initPromise: Promise<void> | null = null;
  private currentOptions = new Map<string, string>();
  private failed: string | null = null;
  private disposed = false;

  constructor(private readonly transport: EngineTransport) {
    transport.onLine((line) => {
      for (const l of [...this.listeners]) l(line);
    });
    transport.onError?.((message) => {
      this.failed = message;
      for (const l of [...this.listeners]) l(`__error__ ${message}`);
    });
  }

  private waitFor(predicate: (line: string) => boolean, timeoutMs: number, onLine?: (line: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.failed) {
        reject(new Error(this.failed));
        return;
      }
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error(tr('Zeitüberschreitung der Engine')));
      }, timeoutMs);
      const listener = (line: string) => {
        if (line.startsWith('__error__')) {
          clearTimeout(timer);
          this.listeners.delete(listener);
          reject(new Error(line.slice(10)));
          return;
        }
        onLine?.(line);
        if (predicate(line)) {
          clearTimeout(timer);
          this.listeners.delete(listener);
          resolve(line);
        }
      };
      this.listeners.add(listener);
    });
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(() => {
      if (this.disposed) throw new Error('Engine wurde beendet');
      return job();
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private send(command: string) {
    if (!this.disposed) this.transport.send(command);
  }

  private async isReady(): Promise<void> {
    const ready = this.waitFor((l) => l === 'readyok', INIT_TIMEOUT_MS);
    this.send('isready');
    await ready;
  }

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.enqueue(async () => {
        const uciok = this.waitFor((l) => l === 'uciok', INIT_TIMEOUT_MS);
        this.send('uci');
        await uciok;
        await this.isReady();
      });
    }
    return this.initPromise;
  }

  /** Setzt UCI-Optionen; nur geänderte Werte werden gesendet. */
  setOptions(options: EngineOptions): Promise<void> {
    return this.enqueue(async () => {
      let changed = false;
      for (const [name, raw] of Object.entries(options)) {
        const value = String(raw);
        if (this.currentOptions.get(name) === value) continue;
        this.currentOptions.set(name, value);
        this.send(`setoption name ${name} value ${value}`);
        changed = true;
      }
      if (changed) await this.isReady();
    });
  }

  newGame(): Promise<void> {
    return this.enqueue(async () => {
      this.send('ucinewgame');
      await this.isReady();
    });
  }

  /** Sucht den besten Zug in der Stellung `fen`. */
  search(fen: string, limits: SearchLimits): Promise<SearchResult> {
    return this.enqueue(async () => {
      let last: UciInfo = {};
      const parts = ['go'];
      if (limits.depth) parts.push('depth', String(limits.depth));
      if (limits.movetime) parts.push('movetime', String(limits.movetime));
      if (limits.nodes) parts.push('nodes', String(limits.nodes));
      if (parts.length === 1) parts.push('depth', '12');
      const timeout = (limits.movetime ?? 0) + SEARCH_GRACE_MS + (limits.depth ?? 0) * 2000;
      const done = this.waitFor(
        (l) => l.startsWith('bestmove'),
        timeout,
        (l) => {
          const info = parseInfoLine(l);
          if (info && info.depth !== undefined && (info.multipv ?? 1) === 1 && !info.bound && (info.scoreCp !== undefined || info.mate !== undefined)) {
            last = info;
          }
        },
      );
      this.send(`position fen ${fen}`);
      this.send(parts.join(' '));
      const line = await done;
      const best = parseBestMove(line)!;
      return {
        bestMove: best.bestMove,
        ponder: best.ponder,
        depth: last.depth ?? 0,
        scoreCp: last.scoreCp,
        mate: last.mate,
        pv: last.pv ?? [],
      };
    });
  }

  /** Bricht die laufende Suche ab (sie endet dann mit dem bisher besten Zug). */
  stop(): void {
    this.send('stop');
  }

  dispose(): void {
    if (this.disposed) return;
    this.send('quit');
    this.disposed = true;
    this.listeners.clear();
    this.transport.terminate();
  }
}
