import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Color } from '../core/types';
import { modelUrl } from './pieceModels';

/**
 * Die Krieger der Kampfszenen: „Knight“ (Weiß) und „Barbarian“ (Schwarz) aus „KayKit Adventurers“ von Kay Lousberg (CC0),
 * aufbereitet von `scripts/build-warriors.mjs` (nur benötigte Ausrüstung und Animationen, je ca. 300 KB).
 */
export interface WarriorModel {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
}

export type Warriors = Record<Color, WarriorModel>;

let pending: Promise<Warriors> | null = null;
let loaded: Warriors | null = null;

/** Bereits geladene Krieger (sonst null) – zum Beispiel, um bei einem Schlagzug ohne Krieger auf „Kurz“ auszuweichen */
export function warriorsReady(): Warriors | null {
  return loaded;
}

async function loadOne(loader: GLTFLoader, file: string): Promise<WarriorModel> {
  const gltf = await loader.loadAsync(modelUrl(file));
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = true;
    // Gelenkte Figuren verändern ihre Form – ihre Hüllkugel aus der Ruhepose wäre falsch
    o.frustumCulled = false;
    const m = o.material as THREE.MeshStandardMaterial;
    // Spielzeug-Look etwas zurücknehmen: matter, nicht spiegelnd
    m.roughness = Math.max(m.roughness, 0.72);
    m.metalness = Math.min(m.metalness, 0.15);
    m.envMapIntensity = 0.9;
  });
  return { scene: gltf.scene, clips: gltf.animations };
}

export function loadWarriors(): Promise<Warriors> {
  if (!pending) {
    pending = (async () => {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const [w, b] = await Promise.all([loadOne(loader, 'warrior_white.glb'), loadOne(loader, 'warrior_black.glb')]);
      loaded = { w, b };
      return loaded;
    })();
    pending.catch(() => {
      pending = null; // beim nächsten Versuch neu laden
    });
  }
  return pending;
}

/** Lädt die Krieger im Hintergrund, sobald sie gebraucht werden könnten. */
export function useWarriors(enabled: boolean): Warriors | null {
  const [warriors, setWarriors] = useState<Warriors | null>(() => loaded);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadWarriors().then(
      (w) => alive && setWarriors(w),
      (err) => console.warn('Krieger konnten nicht geladen werden – Schlagzüge laufen kurz ab.', err),
    );
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? warriors : null;
}
