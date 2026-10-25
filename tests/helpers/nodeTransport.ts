import { createRequire } from 'node:module';
import type { EngineTransport } from '../../src/engine/StockfishEngine';

const require = createRequire(import.meta.url);

/** Echte Stockfish-19-Lite-WASM in Node.js – gleiche Engine wie im Browser. */
export function createNodeTransport(): EngineTransport {
  const initEngine = require('stockfish') as (
    type: string,
    onMessage: (line: string) => void,
  ) => { processCommand(cmd: string): void; terminate?: () => void };
  const listeners: Array<(line: string) => void> = [];
  const engine = initEngine('lite-single', (out: string) => {
    for (const line of String(out).split('\n')) if (line) listeners.forEach((l) => l(line));
  });
  return {
    // "quit" würde in Node den ganzen Testprozess beenden
    send: (cmd) => {
      if (cmd !== 'quit') engine.processCommand(cmd);
    },
    onLine: (l) => listeners.push(l),
    terminate: () => {
      try {
        engine.terminate?.();
      } catch {
        /* egal */
      }
    },
  };
}
