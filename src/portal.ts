import type { GameStoreApi } from './game/store';

/**
 * Anbindung an das Spieleportal CrazyGames (nur im Portal-Build, `npm run build:crazygames`).
 * Das SDK kommt per Skript von sdk.crazygames.com; Basis-Start verlangt nur das Signal „Gameplay start“.
 * Außerhalb des Portals ist alles hier eine leere Operation.
 */
interface CrazyGamesSdk {
  init(): Promise<void>;
  game: { gameplayStart(): void; gameplayStop(): void; loadingStart(): void; loadingStop(): void };
}

export const isPortal: boolean = typeof __PORTAL__ !== 'undefined' && __PORTAL__;

const sdk = (): CrazyGamesSdk | null => (window as unknown as { CrazyGames?: { SDK?: CrazyGamesSdk } }).CrazyGames?.SDK ?? null;

let ready = false;

/** SDK starten (ohne SDK oder bei einem Fehler läuft das Spiel normal weiter) */
export async function initPortal(): Promise<void> {
  if (!isPortal) return;
  const s = sdk();
  if (!s) return;
  try {
    await s.init();
    ready = true;
    s.game.loadingStart();
  } catch (err) {
    console.warn('CrazyGames-SDK nicht verfügbar:', err);
  }
}

export function portalLoadingDone(): void {
  if (!ready) return;
  try {
    sdk()?.game.loadingStop();
  } catch {
    /* ignorieren */
  }
}

/** Meldet dem Portal, ob gerade gespielt wird (Partie läuft, nicht pausiert, kein Menü, kein Ergebnis) */
export function bindPortalToGame(store: GameStoreApi): () => void {
  if (!isPortal) return () => undefined;
  let playing = false;
  const update = () => {
    const s = store.getState();
    const now = s.screen === 'game' && s.active && !s.result && !s.paused;
    if (now === playing || !ready) return;
    playing = now;
    try {
      const g = sdk()?.game;
      if (now) g?.gameplayStart();
      else g?.gameplayStop();
    } catch {
      /* ignorieren */
    }
  };
  update();
  return store.subscribe(update);
}
