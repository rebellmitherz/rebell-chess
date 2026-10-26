import type { CameraControlsImpl } from '@react-three/drei';
import { create } from 'zustand';
import type { Square } from '../core/types';

/**
 * Gemeinsamer Zustand für das Ziehen von Figuren in der 3D-Szene.
 * Die Zeigerposition ändert sich bei jedem Bildschirm-Event – sie liegt deshalb in einem
 * veränderlichen Objekt (kein React-Neuzeichnen), nur „welche Figur“ und „über welchem Feld“
 * sind reaktiv.
 */
export const pointerDrag = {
  pointerId: -1,
  pieceId: null as string | null,
  from: null as Square | null,
  startX: 0,
  startY: 0,
  /** Schwelle überschritten – es wird wirklich gezogen */
  active: false,
  x: 0,
  z: 0,
  /** Klicks direkt nach einem Ziehen ignorieren (sonst würde das Loslassen als Klick gelten) */
  suppressClickUntil: 0,
};

export const DRAG_THRESHOLD_PX = 6;

interface DragUi {
  draggingId: string | null;
  over: Square | null;
  set(partial: Partial<Pick<DragUi, 'draggingId' | 'over'>>): void;
}

export const useDragUi = create<DragUi>((set) => ({
  draggingId: null,
  over: null,
  set: (partial) => set(partial),
}));

/** Zeitpunkte (performance.now), bis zu denen volle Bildrate bzw. Schatten-Neuberechnung nötig sind. */
export const activity = {
  until: 0,
  shadowsUntil: 0,
};

export function markActive(ms: number) {
  activity.until = Math.max(activity.until, performance.now() + ms);
}

/** Zugriff auf die Kamerasteuerung, um sie während des Ziehens abzuschalten. */
export const sceneHandles = {
  controls: null as CameraControlsImpl | null,
};

/** Ziehen vorbereiten: Kamera sofort abschalten, damit sie die Geste nicht übernimmt. */
export function beginDrag(pieceId: string, from: Square, pointerId: number, clientX: number, clientY: number, x: number, z: number) {
  if (sceneHandles.controls) sceneHandles.controls.enabled = false;
  Object.assign(pointerDrag, { pointerId, pieceId, from, startX: clientX, startY: clientY, active: false, x, z });
}

export function clickSuppressed(): boolean {
  return performance.now() < pointerDrag.suppressClickUntil;
}
