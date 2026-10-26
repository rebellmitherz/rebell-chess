import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Color } from '../core/types';
import { modelUrl } from './pieceModels';
import { enableFastRaycast } from './raycast';

/**
 * Stil „Echt“: das CC0-Schachset „Chess Set“ (Riley Queen, Poly Haven) mit seinen echten Marmor- und Holztexturen,
 * dazu die Tischplatte „Wood Table 001“ und das Raumlicht „Lebombo“ (beide Poly Haven, CC0).
 * Texturen und Brett erzeugt `scripts/build-real-textures.py` bzw. `scripts/build-pieces.mjs`.
 */
export interface RealAssets {
  pieces: Record<Color, THREE.MeshPhysicalMaterial>;
  board: { geometry: THREE.BufferGeometry; material: THREE.MeshPhysicalMaterial };
  table: THREE.MeshStandardMaterial;
}

export const ENV_FILE = 'env/lebombo_1k.hdr';

export function assetUrl(file: string): string {
  return new URL(file, document.baseURI).href;
}

let pending: Promise<RealAssets> | null = null;

function texture(loader: THREE.TextureLoader, file: string, color: boolean, gltfUv: boolean): Promise<THREE.Texture> {
  return loader.loadAsync(assetUrl(`textures/${file}`)).then((t) => {
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.flipY = !gltfUv;
    t.anisotropy = 8;
    return t;
  });
}

/** Material aus Farbe/Normalen/ARM (AO = rot, Rauheit = grün, Metall = blau) */
function pbr(map: THREE.Texture, normal: THREE.Texture, arm: THREE.Texture, extra: THREE.MeshPhysicalMaterialParameters) {
  return new THREE.MeshPhysicalMaterial({
    map,
    normalMap: normal,
    aoMap: arm,
    roughnessMap: arm,
    metalnessMap: arm,
    roughness: 1,
    metalness: 1,
    ...extra,
  });
}

/** Rauheit aus der Textur ersetzen: gleichmäßig seidenmatt statt Hochglanz */
function satin(m: THREE.MeshPhysicalMaterial): THREE.MeshPhysicalMaterial {
  // helle Felder etwas wärmer und dunkler, damit weiße Figuren sich abheben
  m.color.set('#d6d0c6');
  m.roughnessMap = null;
  m.roughness = 0.62;
  m.metalnessMap = null;
  m.metalness = 0;
  return m;
}

export function loadRealAssets(): Promise<RealAssets> {
  if (!pending) {
    pending = (async () => {
      const tl = new THREE.TextureLoader();
      const gl = new GLTFLoader();
      gl.setMeshoptDecoder(MeshoptDecoder);
      // w… = weiße Figuren, b… = schwarze Figuren, o… = Brett (board), t… = Tisch
      const [wd, wn, wa, bd, bn, ba, od, on, oa, td, tn, ta, gltf] = await Promise.all([
        texture(tl, 'pieces_white_diff.jpg', true, true),
        texture(tl, 'pieces_white_nor.jpg', false, true),
        texture(tl, 'pieces_white_arm.jpg', false, true),
        texture(tl, 'pieces_black_diff.jpg', true, true),
        texture(tl, 'pieces_black_nor.jpg', false, true),
        texture(tl, 'pieces_black_arm.jpg', false, true),
        texture(tl, 'board_diff.jpg', true, true),
        texture(tl, 'board_nor.jpg', false, true),
        texture(tl, 'board_arm.jpg', false, true),
        texture(tl, 'table_diff.jpg', true, false),
        texture(tl, 'table_nor.jpg', false, false),
        texture(tl, 'table_arm.jpg', false, false),
        gl.loadAsync(modelUrl('board.glb')),
      ]);
      for (const t of [td, tn, ta]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(2.2, 2.2);
      }
      let mesh: THREE.Mesh | null = null;
      gltf.scene.traverse((o) => {
        if (!mesh && o instanceof THREE.Mesh) mesh = o;
      });
      if (!mesh) throw new Error('Brett fehlt in board.glb');
      mesh = mesh as THREE.Mesh;
      const geometry = mesh.geometry.clone();
      // Quantisierte Attribute in Float umrechnen und Knotenmatrix einrechnen
      for (const name of ['position', 'normal', 'uv']) {
        const a = geometry.getAttribute(name);
        const out = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) {
          out[i * a.itemSize] = a.getX(i);
          if (a.itemSize > 1) out[i * a.itemSize + 1] = a.getY(i);
          if (a.itemSize > 2) out[i * a.itemSize + 2] = a.getZ(i);
        }
        geometry.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
      }
      mesh.updateWorldMatrix(true, false);
      geometry.applyMatrix4(mesh.matrixWorld);
      geometry.computeBoundingBox();
      enableFastRaycast(geometry);
      return {
        // polierter Marmor: leichte Klarlackschicht, aber matt genug, dass von oben nichts blendet
        pieces: {
          // Weiß etwas abgedunkelt (warmes Elfenbein statt Reinweiß) und matter, damit es nicht blendet
          w: pbr(wd, wn, wa, { color: '#cdc5b8', clearcoat: 0.06, clearcoatRoughness: 0.5, envMapIntensity: 0.7 }),
          b: pbr(bd, bn, ba, { clearcoat: 0.25, clearcoatRoughness: 0.3, envMapIntensity: 1 }),
        },
        // Brett seidenmatt: von oben spiegeln sich sonst Fenster und Decke des Raumlichts
        board: { geometry, material: satin(pbr(od, on, oa, { envMapIntensity: 0.55 })) },
        table: new THREE.MeshStandardMaterial({
          map: td,
          normalMap: tn,
          aoMap: ta,
          roughnessMap: ta,
          metalnessMap: ta,
          roughness: 1,
          metalness: 1,
          envMapIntensity: 0.8,
        }),
      };
    })();
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}

/** Liefert die echten Materialien, sobald geladen (vorher/bei Fehlern: null). */
export function useRealAssets(enabled: boolean): RealAssets | null {
  const [assets, setAssets] = useState<RealAssets | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadRealAssets().then(
      (a) => alive && setAssets(a),
      (err) => console.warn('Echte Texturen nicht verfügbar – nutze Edel-Stil.', err),
    );
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? assets : null;
}
