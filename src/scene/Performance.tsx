import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { gameStore } from '../game/instance';
import { activity, markActive, pointerDrag, useDragUi } from './interaction';

/**
 * Bildrate nach Bedarf (Canvas läuft mit frameloop="demand"):
 * - Bei Interaktion, Zug-Animationen und Kamerafahrten volle Bildrate.
 * - In Ruhe (Spieler denkt nach) nur `idleFps` für Goldstaub und pulsierende Hinweise – spart Akku und Wärme.
 * Kamerafahrten fordern ihre Bilder selbst an (drei CameraControls).
 */
export function FrameDriver({ idleFps }: { idleFps: number }) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    let raf = 0;
    let lastIdle = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now < activity.until || pointerDrag.pieceId !== null) {
        invalidate();
        return;
      }
      if (idleFps > 0 && now - lastIdle >= 1000 / idleFps - 2) {
        lastIdle = now;
        invalidate();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [invalidate, idleFps]);

  useEffect(() => {
    markActive(2000); // Aufbau, Einblenden der Figuren
    const unsubGame = gameStore.subscribe(() => markActive(1500));
    const unsubDrag = useDragUi.subscribe(() => markActive(600));
    const onPointer = () => markActive(250);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
    return () => {
      unsubGame();
      unsubDrag();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  return null;
}

/**
 * Schatten nur neu berechnen, wenn sich Figuren bewegen. Die Schattenkarte ist sonst statisch –
 * das spart pro Bild einen kompletten zweiten Durchlauf aller Figuren.
 */
export function ShadowUpdater() {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    activity.shadowsUntil = performance.now() + 2500;
    const unsub = gameStore.subscribe((s, prev) => {
      if (s.pieces !== prev.pieces || s.selected !== prev.selected || s.pendingPromotion !== prev.pendingPromotion) {
        activity.shadowsUntil = performance.now() + 1200;
      }
    });
    return () => {
      unsub();
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  useFrame(() => {
    if (pointerDrag.active || performance.now() < activity.shadowsUntil) gl.shadowMap.needsUpdate = true;
  });

  return null;
}

/**
 * Passt die Pixeldichte an, wenn das Gerät bei Bewegung nicht mitkommt (gemessen nur in aktiven Phasen,
 * weil die Ruhe-Bildrate absichtlich niedrig ist). Erhöht sie wieder, wenn genug Reserve da ist.
 */
export function AdaptiveResolution({ min, max: qualityMax }: { min: number; max: number }) {
  const setDpr = useThree((s) => s.setDpr);
  // Nie feiner als der Bildschirm selbst – darüber wäre es nur teures Supersampling
  const max = Math.min(qualityMax, window.devicePixelRatio || 1);
  const state = useRef({ samples: [] as number[], current: max, changes: 0 });

  useFrame((_, delta) => {
    const now = performance.now();
    if (now >= activity.until && pointerDrag.pieceId === null) {
      state.current.samples.length = 0;
      return;
    }
    const s = state.current;
    s.samples.push(delta * 1000);
    if (s.samples.length < 90) return;
    const sorted = [...s.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    s.samples.length = 0;
    if (median > 24 && s.current > min) {
      s.current = Math.max(min, +(s.current - 0.25).toFixed(2));
      s.changes++;
      setDpr(s.current);
    } else if (median < 17.5 && s.current < max && s.changes < 4) {
      s.current = Math.min(max, +(s.current + 0.25).toFixed(2));
      s.changes++;
      setDpr(s.current);
    }
  });

  return null;
}
