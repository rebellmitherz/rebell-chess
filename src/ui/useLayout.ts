import { useEffect, useState } from 'react';

export interface Layout {
  width: number;
  height: number;
  /** Breites Querformat: Seitenleiste rechts */
  desktop: boolean;
  /** Breite der Seitenleiste in px (0 auf Smartphones) */
  sidebar: number;
  /** Von HUD-Leisten verdeckte Höhe oben/unten (Hochformat) */
  topInset: number;
  bottomInset: number;
}

function compute(): Layout {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const desktop = width >= 860 && width / height >= 1.1;
  const sidebar = desktop ? Math.round(Math.min(390, Math.max(310, width * 0.26))) : 0;
  return { width, height, desktop, sidebar, topInset: desktop ? 0 : 100, bottomInset: desktop ? 0 : 140 };
}

export function useLayout(): Layout {
  const [layout, setLayout] = useState(compute);
  useEffect(() => {
    const onResize = () => setLayout(compute());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return layout;
}

/** Löst in festem Takt ein Neuzeichnen aus (für laufende Uhren). */
export function useNow(intervalMs: number, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, active]);
  return active ? Date.now() : now;
}
