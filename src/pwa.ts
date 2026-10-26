/**
 * Offline-Fähigkeit und Installation als App (Service Worker nur im fertigen Build, nicht im Dev-Server).
 * Service Worker brauchen https oder localhost – im WLAN über http://192.168… bleibt es eine normale Webseite.
 */

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();

export function canInstall(): boolean {
  return deferred !== null;
}

export function onInstallAvailable(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const choice = await event.userChoice;
  listeners.forEach((l) => l());
  return choice.outcome === 'accepted';
}

export function registerPwa(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // eigener Knopf im Menü statt Browser-Leiste
    deferred = event as InstallPrompt;
    listeners.forEach((l) => l());
  });
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('sw.js', document.baseURI).href, { scope: './' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // alles bisher Geladene (Schriften, Sounds, Teile) für offline merken
        setTimeout(() => {
          const urls = performance
            .getEntriesByType('resource')
            .map((e) => e.name)
            .filter((u) => u.startsWith(location.origin));
          reg.active?.postMessage({ type: 'cache-urls', urls });
        }, 4000);
      })
      .catch((err) => console.warn('Offline-Modus nicht verfügbar:', err));
  });
}
