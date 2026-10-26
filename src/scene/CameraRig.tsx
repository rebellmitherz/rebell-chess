import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../game/instance';
import { sceneHandles } from './interaction';

const { ACTION } = CameraControlsImpl;
const FOV = 40;
const FOV_HALF_TAN = Math.tan(((FOV / 2) * Math.PI) / 180);

/** Punkte, die immer sichtbar sein müssen: Spielfeld-Ecken und die Köpfe der hinteren Figuren. */
const FIT_POINTS = [
  new THREE.Vector3(-4.05, 0, 4.05),
  new THREE.Vector3(4.05, 0, 4.05),
  new THREE.Vector3(-4.05, 0, -4.05),
  new THREE.Vector3(4.05, 0, -4.05),
  new THREE.Vector3(-3.5, 1.45, -3.5),
  new THREE.Vector3(3.5, 1.45, -3.5),
  new THREE.Vector3(0, 1.45, -3.5),
];

interface Framing {
  polar: number;
  distance: number;
  /** Bildversatz (Weltmaß), damit das Brett mittig im freien Bereich liegt */
  offsetX: number;
  offsetY: number;
}

/**
 * Wie ein Spieler am Brett: flacher Blick (Figuren von der Seite erkennbar), so nah wie möglich.
 * Sucht den kleinsten Abstand, bei dem Spielfeld und hintere Figuren in den freien Bereich (ohne HUD) passen.
 */
function framing(width: number, height: number, sidebar: number, topInset: number, bottomInset: number): Framing {
  const usableW = Math.max(240, width - sidebar);
  const usableH = Math.max(200, height - topInset - bottomInset);
  const portrait = usableW / usableH < 0.9;
  const polar = portrait ? 0.88 : 0.98;
  const aspect = width / height;
  // freier Bereich in NDC (-1..1)
  const rect = {
    x0: -1,
    x1: 1 - (2 * sidebar) / width,
    y0: -1 + (2 * bottomInset) / height,
    y1: 1 - (2 * topInset) / height,
  };
  const margin = 0.94;
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 200);
  const v = new THREE.Vector3();
  const bounds = (d: number) => {
    cam.position.set(0, Math.cos(polar) * d, Math.sin(polar) * d);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of FIT_POINTS) {
      v.copy(p).project(cam);
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
    }
    return { minX, maxX, minY, maxY };
  };
  const fits = (d: number) => {
    const b = bounds(d);
    return b.maxX - b.minX <= (rect.x1 - rect.x0) * margin && b.maxY - b.minY <= (rect.y1 - rect.y0) * margin;
  };
  let lo = 5;
  let hi = 60;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  const distance = hi;
  const b = bounds(distance);
  const halfH = distance * FOV_HALF_TAN;
  const halfW = halfH * aspect;
  return {
    polar,
    distance,
    // 1 NDC-Einheit entspricht der halben Bildbreite bzw. -höhe im Zielabstand
    offsetX: ((b.minX + b.maxX) / 2 - (rect.x0 + rect.x1) / 2) * halfW,
    offsetY: ((rect.y0 + rect.y1) / 2 - (b.minY + b.maxY) / 2) * halfH,
  };
}

export function CameraRig({ sidebar, topInset, bottomInset }: { sidebar: number; topInset: number; bottomInset: number }) {
  const controls = useRef<CameraControlsImpl>(null!);
  const viewSide = useGame((s) => s.viewSide);
  const screen = useGame((s) => s.screen);
  const resetToken = useGame((s) => s.gameId);
  const size = useThree((s) => s.size);
  const f = framing(size.width, size.height, sidebar, topInset, bottomInset);

  // Ausrichtung auf die Seite, die unten sitzt (kürzester Drehweg)
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const base = viewSide === 'w' ? 0 : Math.PI;
    const current = c.azimuthAngle;
    const target = base + Math.round((current - base) / (Math.PI * 2)) * Math.PI * 2;
    void c.moveTo(0, 0, 0, true);
    void c.rotateTo(target, f.polar, true);
    void c.dollyTo(f.distance, true);
  }, [viewSide, f.polar, f.distance, screen, resetToken]);

  // Brett in die Mitte des freien Bereichs schieben (Seitenleiste / Leisten oben und unten)
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    // camera-controls: positiver x-Versatz schiebt das Bild nach links, positiver y-Versatz nach oben
    void c.setFocalOffset(f.offsetX, f.offsetY, 0, true);
  }, [f.offsetX, f.offsetY]);

  useFrame((_, dt) => {
    if (screen === 'menu' && controls.current) controls.current.azimuthAngle += dt * 0.06;
  });

  useEffect(() => {
    sceneHandles.controls = controls.current;
    // Nur im Dev-Modus: Kamera für Prüfungen in der Browser-Konsole erreichbar
    if (import.meta.env.DEV) (window as unknown as { __camera?: CameraControlsImpl }).__camera = controls.current;
    return () => {
      sceneHandles.controls = null;
    };
  }, []);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={4.5}
      maxDistance={44}
      minPolarAngle={0.05}
      maxPolarAngle={1.25}
      smoothTime={0.35}
      draggingSmoothTime={0.12}
      dollySpeed={0.5}
      mouseButtons={{ left: ACTION.ROTATE, middle: ACTION.DOLLY, right: ACTION.NONE, wheel: ACTION.DOLLY }}
      touches={{ one: ACTION.TOUCH_ROTATE, two: ACTION.TOUCH_DOLLY, three: ACTION.NONE }}
      enabled={screen === 'game'}
    />
  );
}
