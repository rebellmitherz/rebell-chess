// Service Worker: macht Rebell Chess 3D nach dem ersten Besuch offline spielbar.
// - Startseite: erst Netz (Updates kommen sofort an), ohne Netz aus dem Speicher
// - Dateien mit Hash im Namen (assets/…): einmal laden, dann aus dem Speicher (ändern sich nie)
// - Engine, Figuren, Sounds, Symbole: aus dem Speicher, im Hintergrund auffrischen
const CACHE = 'rebellchess-v20';
const CORE = [
  './',
  './manifest.webmanifest',
  './favicon.svg',
  './engine/stockfish-19-lite-single.js',
  './engine/stockfish-19-lite-single.wasm',
  './models/pieces.glb',
  './models/pieces_ao.jpg',
  './models/board.glb',
  './models/warrior_white.glb',
  './models/warrior_black.glb',
  './models/warrior_moves.glb',
  './env/lebombo_1k.hdr',
  ...['pieces_white', 'pieces_black', 'board', 'table'].flatMap((p) =>
    ['diff', 'nor', 'arm'].map((k) => `./textures/${p}_${k}.jpg`),
  ),
  './icons/icon-192.png',
  ...['move-body', 'move-click', 'capture-body', 'capture-clink', 'battle-clash', 'battle-block', 'battle-hit', 'battle-fall', 'battle-step'].flatMap((p) =>
    [0, 1, 2, 3, 4].map((i) => `./sounds/${p}-${i}.mp3`),
  ),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
      // Dateien der aktuellen Version aus der Startseite übernehmen (Skripte, Styles, Modul-Vorladen)
      const html = await (await fetch('./', { cache: 'no-cache' })).text();
      const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await cache.addAll(assets);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// Die Seite meldet, was sie geladen hat (Schriften, Sounds, nachgeladene Teile) – alles für offline merken
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'cache-urls') return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        event.data.urls.map((url) => cache.match(url, { ignoreVary: true }).then((hit) => hit || cache.add(url).catch(() => undefined))),
      ),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Am Browser-Zwischenspeicher vorbei (GitHub Pages erlaubt sonst 10 Minuten alte Startseiten)
    event.respondWith(
      fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(async () => (await caches.match('./', { ignoreVary: true })) || Response.error()),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request, { ignoreVary: true });
      const immutable = url.pathname.includes('/assets/');
      if (hit && immutable) return hit;
      const network = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => undefined);
      if (hit) {
        event.waitUntil(network); // im Hintergrund auffrischen
        return hit;
      }
      return (await network) || Response.error();
    })(),
  );
});
