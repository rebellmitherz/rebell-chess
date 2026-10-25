import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useGame } from '../game/instance';
import { sceneHandles } from './interaction';

const { ACTION } = CameraControlsImpl;
const FOV_HALF_TAN = Math.tan(((40 / 2) * Math.PI) / 180);

/** Abstand und Neigung so wählen, dass das ganze Brett in den freien Bereich (ohne HUD-Leisten) passt. */
function framing(width: number, height: number, sidebar: number, topInset: number, bottomInset: number) {
  const usableWidth = Math.max(240, width - sidebar);
  const usableHeight = Math.max(200, height - topInset - bottomInset);
  const portrait = usableWidth / usableHeight < 0.9;
  // Neigung (0 = senkrecht von oben)
  const polar = portrait ? 0.42 : 0.72;
  const halfExtent = portrait ? 5.25 : 5.5;
  // Durch die Neigung erscheint das Brett in der Tiefe kürzer – vertikal reicht etwas weniger Abstand.
  const fitVertical = (halfExtent / (FOV_HALF_TAN * (usableHeight / height))) * (portrait ? 1 : 0.92);
  // Die vordere Brettkante ist näher an der Kamera und erscheint breiter – daher Zuschlag.
  const fitHorizontal = (halfExtent * 1.2) / (FOV_HALF_TAN * (usableWidth / height));
  const distance = Math.max(fitVertical, fitHorizontal);
  return { polar, distance: Math.min(Math.max(distance, 11), 40), portrait };
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
    const worldPerPx = (2 * f.distance * FOV_HALF_TAN) / size.height;
    const offsetX = (sidebar / 2) * worldPerPx;
    const offsetY = ((bottomInset - topInset) / 2) * worldPerPx;
    // camera-controls: positiver y-Versatz schiebt das Bild nach oben
    void c.setFocalOffset(offsetX, offsetY, 0, true);
  }, [sidebar, topInset, bottomInset, f.distance, size.height]);

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
      minDistance={7}
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
