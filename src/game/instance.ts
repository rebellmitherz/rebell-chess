import { useStore } from 'zustand';
import { createEngineService, type EngineWorker } from './engineService';
import { browserStorage } from './persistence';
import { DEFAULT_PREFERENCES, detectDefaultGraphics } from './settings';
import { setLang } from '../i18n';
import { createGameStore, type GameStore } from './store';

/** Die eine Spielinstanz der App (Browser): eigene Schach-KI im Web Worker + localStorage. */
export const gameStore = createGameStore({
  engine: createEngineService(
    () => new Worker(new URL('../engine/rebell/worker.ts', import.meta.url), { type: 'module' }) as unknown as EngineWorker,
  ),
  storage: browserStorage(),
  defaultPrefs: { ...DEFAULT_PREFERENCES, graphics: detectDefaultGraphics() },
  // Die 3D-Szene spielt Kriegerkämpfe ab und meldet ihr Ende
  battleScenes: true,
});

// Sprache der Oberfläche: aus den Einstellungen, bei jeder Änderung nachführen
setLang(gameStore.getState().prefs.lang);
gameStore.subscribe((s, prev) => {
  if (s.prefs.lang !== prev.prefs.lang) setLang(s.prefs.lang);
});

export function useGame<T>(selector: (s: GameStore) => T): T {
  return useStore(gameStore, selector);
}

// Im Dev-Modus für Fehlersuche in der Browser-Konsole erreichbar
if (import.meta.env.DEV) (window as unknown as { __rebellchess: typeof gameStore }).__rebellchess = gameStore;
