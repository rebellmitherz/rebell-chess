import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Color } from '../core/types';
import type { MoveLibrary } from './battleScript';
import moves from './warriorMoves.json';
import { modelUrl } from './pieceModels';
import { findBlade, type Blade } from './WeaponTrail';

/**
 * Die Krieger der Kampfszenen: zwei Mixamo-Figuren (Weiß und Schwarz) mit gemeinsamem Skelett und eine
 * Bewegungsbibliothek (warrior_moves.glb) – aufbereitet von `scripts/build-warriors.mjs`.
 */
export interface Warriors {
  models: Record<Color, THREE.Group>;
  clips: Map<string, THREE.AnimationClip>;
  /** Klinge für die Schwertspur (null = Figur ohne Waffe) */
  blades: Record<Color, Blade | null>;
}

/** Rollen, Dauer, Treffermomente und Fortbewegung jeder Bewegung (beide Seiten nutzen dieselbe Bibliothek) */
export const MOVE_LIBRARY = moves as MoveLibrary;

let pending: Promise<Warriors> | null = null;
let loaded: Warriors | null = null;

/** Bereits geladene Krieger (sonst null) – zum Beispiel, um bei einem Schlagzug ohne Krieger auf „Kurz“ auszuweichen */
export function warriorsReady(): Warriors | null {
  return loaded;
}

function prepare(scene: THREE.Group): THREE.Group {
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = true;
    // Gelenkte Figuren verändern ihre Form – ihre Hüllkugel aus der Ruhepose wäre falsch
    o.frustumCulled = false;
    const m = o.material as THREE.MeshStandardMaterial;
    m.envMapIntensity = 1;
  });
  return scene;
}

export function loadWarriors(): Promise<Warriors> {
  if (!pending) {
    pending = (async () => {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const [w, b, m] = await Promise.all([
        loader.loadAsync(modelUrl('warrior_white.glb')),
        loader.loadAsync(modelUrl('warrior_black.glb')),
        loader.loadAsync(modelUrl('warrior_moves.glb')),
      ]);
      const models = { w: prepare(w.scene), b: prepare(b.scene) };
      loaded = {
        models,
        clips: new Map(m.animations.map((c) => [c.name, c])),
        blades: { w: findBlade(models.w), b: findBlade(models.b) },
      };
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
