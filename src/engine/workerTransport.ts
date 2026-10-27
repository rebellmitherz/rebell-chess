import type { EngineTransport } from './StockfishEngine';
import { tr } from '../i18n';

export const ENGINE_FILE = 'engine/stockfish-19-lite-single.js';

/** URL der Engine relativ zur Seite – funktioniert auch, wenn der Build in einem Unterordner liegt. */
export function defaultEngineUrl(): string {
  return new URL(ENGINE_FILE, document.baseURI).href;
}

export function createWorkerTransport(url: string = defaultEngineUrl()): EngineTransport {
  const worker = new Worker(url);
  const lineListeners: Array<(line: string) => void> = [];
  const errorListeners: Array<(message: string) => void> = [];

  worker.onmessage = (event: MessageEvent) => {
    const data = typeof event.data === 'string' ? event.data : String(event.data ?? '');
    for (const line of data.split('\n')) {
      if (line) lineListeners.forEach((l) => l(line));
    }
  };
  worker.onerror = (event: ErrorEvent) => {
    event.preventDefault();
    const message = event.message || tr('Die Schach-KI konnte nicht geladen werden.');
    errorListeners.forEach((l) => l(message));
  };

  return {
    send: (command) => worker.postMessage(command),
    onLine: (listener) => lineListeners.push(listener),
    onError: (listener) => errorListeners.push(listener),
    terminate: () => worker.terminate(),
  };
}
