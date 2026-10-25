import { useStore } from 'zustand';
import { createWorkerTransport } from '../engine/workerTransport';
import { createStockfishService } from './engineService';
import { browserStorage } from './persistence';
import { DEFAULT_PREFERENCES, detectDefaultGraphics } from './settings';
import { createGameStore, type GameStore } from './store';

/** Die eine Spielinstanz der App (Browser): echte Stockfish-Worker + localStorage. */
export const gameStore = createGameStore({
  engine: createStockfishService(() => createWorkerTransport()),
  storage: browserStorage(),
  defaultPrefs: { ...DEFAULT_PREFERENCES, graphics: detectDefaultGraphics() },
});

export function useGame<T>(selector: (s: GameStore) => T): T {
  return useStore(gameStore, selector);
}

// Im Dev-Modus für Fehlersuche in der Browser-Konsole erreichbar
if (import.meta.env.DEV) (window as unknown as { __rebellchess: typeof gameStore }).__rebellchess = gameStore;
