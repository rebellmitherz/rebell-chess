import { useEffect, useState } from 'react';
import { isPortal } from '../portal';

/** Browser-Vollbild (blendet Adressleiste und Tabs aus – das Brett wird größer); im Portal übernimmt das dessen Knopf */
export function fullscreenAvailable(): boolean {
  return !isPortal && typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
}

export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
}

export function useFullscreen(): boolean {
  const [on, setOn] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const update = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  return on;
}
