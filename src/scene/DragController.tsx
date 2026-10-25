import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { gameStore } from '../game/instance';
import { worldToSquare } from './boardMath';
import { DRAG_THRESHOLD_PX, pointerDrag, sceneHandles, useDragUi } from './interaction';

const LIMIT = 5.4;

/**
 * Verfolgt eine gezogene Figur über Fenster-Events (funktioniert auch, wenn der Zeiger die Figur verlässt)
 * und projiziert den Zeiger auf die Brettebene. Gestartet wird das Ziehen in `Pieces` (pointerdown).
 */
export function DragController() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const ndc = new THREE.Vector2();

    const project = (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(plane, hit);
    };

    const reset = () => {
      const c = sceneHandles.controls;
      if (c) c.enabled = gameStore.getState().screen === 'game';
      pointerDrag.pointerId = -1;
      pointerDrag.pieceId = null;
      pointerDrag.from = null;
      pointerDrag.active = false;
      useDragUi.getState().set({ draggingId: null, over: null });
    };

    const onMove = (e: PointerEvent) => {
      const d = pointerDrag;
      if (d.pieceId === null || e.pointerId !== d.pointerId) return;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
        const st = gameStore.getState();
        if (st.selected !== d.from) st.selectSquare(d.from!);
        if (gameStore.getState().selected !== d.from) {
          reset(); // Figur darf gerade nicht gezogen werden
          return;
        }
        d.active = true;
        useDragUi.getState().set({ draggingId: d.pieceId });
      }
      const p = project(e.clientX, e.clientY);
      if (!p) return;
      d.x = THREE.MathUtils.clamp(p.x, -LIMIT, LIMIT);
      d.z = THREE.MathUtils.clamp(p.z, -LIMIT, LIMIT);
      const over = worldToSquare(p.x, p.z);
      if (over !== useDragUi.getState().over) useDragUi.getState().set({ over });
    };

    const onUp = (e: PointerEvent) => {
      const d = pointerDrag;
      if (d.pieceId === null || e.pointerId !== d.pointerId) return;
      if (!d.active) {
        reset(); // einfacher Klick – die Auswahl übernimmt onClick der Figur
        return;
      }
      const p = project(e.clientX, e.clientY);
      const over = p ? worldToSquare(p.x, p.z) : null;
      const from = d.from!;
      d.suppressClickUntil = performance.now() + 250;
      reset();
      gameStore.getState().dropPiece(from, over);
    };

    const onCancel = (e: PointerEvent) => {
      if (pointerDrag.pieceId !== null && e.pointerId === pointerDrag.pointerId) {
        const from = pointerDrag.from;
        const wasActive = pointerDrag.active;
        reset();
        if (wasActive && from) gameStore.getState().dropPiece(from, null);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [camera, gl]);

  return null;
}
