import type { SearchLimits, SearchResult } from '../types';
import { bookMove } from './book';
import { Searcher } from './search';

/** Auftrag an den Rechen-Worker */
export type EngineRequest =
  | { type: 'new-game' }
  | {
      type: 'search';
      id: number;
      fen: string;
      limits: SearchLimits;
      /** Partie bis `fen`, damit die KI Wiederholungen erkennt */
      line?: { startFen: string; moves: string[] };
      /** Abweichung vom besten Zug in Centipawns (schwache Stufen); braucht `limits.depth` */
      margin?: number;
      /** Eröffnungsbuch erlaubt */
      book?: boolean;
    };

export interface EngineResponse {
  id: number;
  result: SearchResult;
}

/** Bearbeitet einen Auftrag; läuft im Worker, in Tests direkt. */
export function createEngineHost(random: () => number = Math.random) {
  const searcher = new Searcher();
  return (request: EngineRequest): EngineResponse | null => {
    if (request.type === 'new-game') {
      searcher.clear();
      return null;
    }
    const { id, fen, limits, line, margin, book } = request;
    const fromBook = book ? bookMove(fen, random) : null;
    if (fromBook) return { id, result: { bestMove: fromBook, depth: 0, pv: [fromBook] } };
    const result = margin ? searcher.searchWeak(fen, limits.depth ?? 1, margin, random, line) : searcher.search(fen, limits, line);
    return { id, result };
  };
}
