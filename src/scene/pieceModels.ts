import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { PieceSymbol } from '../core/types';
import { enableFastRaycast } from './raycast';

/**
 * Hochwertige Figuren aus dem CC0-Schachset „Chess Set“ (Riley Queen, Poly Haven), aufbereitet von
 * `scripts/build-pieces.mjs` zu `public/models/pieces.glb` (meshopt-komprimiert, ca. 175 KB).
 * Die Materialien (Gold/Onyx) kommen aus dem Spiel, vom Modell wird nur die Form und die Verdeckungskarte genutzt.
 */

export type PieceGeometries = Record<PieceSymbol, THREE.BufferGeometry>;

export interface ModelPieces {
  geometries: PieceGeometries;
  /** Fußring je Figur (Radius knapp außerhalb des Sockels) */
  accents: PieceGeometries;
  /** Verdeckungskarte (Rotkanal) für die UVs des Modells */
  ao: THREE.Texture;
}

const TYPES: PieceSymbol[] = ['p', 'n', 'b', 'r', 'q', 'k'];

/** Quantisierte Attribute (Int16 normalisiert) in Float32 umwandeln und die Knotenmatrix einrechnen. */
function bakeGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const src = mesh.geometry;
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv'] as const) {
    const attr = src.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    if (!attr) continue;
    const out = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++) {
      out[i * attr.itemSize] = attr.getX(i);
      if (attr.itemSize > 1) out[i * attr.itemSize + 1] = attr.getY(i);
      if (attr.itemSize > 2) out[i * attr.itemSize + 2] = attr.getZ(i);
    }
    geo.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
  }
  if (src.index) geo.setIndex(src.index.clone());
  mesh.updateWorldMatrix(true, false);
  geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/** Ring am Fuß der Figur: Radius = größter Abstand der untersten Punkte zur Achse. */
function footRing(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  let radius = 0;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < 0.02) radius = Math.max(radius, Math.hypot(pos.getX(i), pos.getZ(i)));
  }
  const ring = new THREE.TorusGeometry(radius + 0.006, 0.011, 6, 64);
  ring.rotateX(Math.PI / 2);
  ring.translate(0, 0.011, 0);
  return ring;
}

let pending: Promise<ModelPieces> | null = null;

export function modelUrl(file: string): string {
  return new URL(`models/${file}`, document.baseURI).href;
}

export function loadModelPieces(): Promise<ModelPieces> {
  if (!pending) {
    pending = (async () => {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const [gltf, ao] = await Promise.all([
        loader.loadAsync(modelUrl('pieces.glb')),
        new THREE.TextureLoader().loadAsync(modelUrl('pieces_ao.jpg')),
      ]);
      ao.flipY = false; // glTF-UV-Konvention
      ao.colorSpace = THREE.NoColorSpace;
      ao.anisotropy = 4;
      const geometries = {} as PieceGeometries;
      const accents = {} as PieceGeometries;
      for (const type of TYPES) {
        const mesh = gltf.scene.getObjectByName(type);
        if (!(mesh instanceof THREE.Mesh)) throw new Error(`Figur ${type} fehlt im Modell`);
        geometries[type] = bakeGeometry(mesh);
        enableFastRaycast(geometries[type]);
        accents[type] = footRing(geometries[type]);
      }
      return { geometries, accents, ao };
    })();
    pending.catch(() => {
      pending = null; // beim nächsten Versuch neu laden
    });
  }
  return pending;
}

/** Liefert die Modell-Figuren, sobald sie geladen sind (vorher und bei Fehlern: null). */
export function useModelPieces(enabled: boolean): ModelPieces | null {
  const [model, setModel] = useState<ModelPieces | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadModelPieces().then(
      (m) => alive && setModel(m),
      (err) => console.warn('Figurenmodell konnte nicht geladen werden – nutze eigene Figuren.', err),
    );
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? model : null;
}
