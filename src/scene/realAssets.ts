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

interface Grade {
  /** Farbsättigung (1 = unverändert) */
  saturation?: number;
  /** Kontrast um die Mitte (1 = unverändert) */
  contrast?: number;
  /** Gamma > 1 macht Tiefen dunkler (satteres Schwarz), < 1 hellt auf */
  gamma?: number;
  /** Helligkeit je Kanal (Farbstich), 1 = unverändert */
  gain?: [number, number, number];
}

/** Farbkorrektur einer Farbtextur (einmal beim Laden): kräftigere Farben, tieferes Schwarz */
function grade(tex: THREE.Texture, g: Grade): THREE.Texture {
  const img = tex.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const { saturation = 1, contrast = 1, gamma = 1, gain = [1, 1, 1] } = g;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i] / 255;
    let gr = px[i + 1] / 255;
    let b = px[i + 2] / 255;
    const luma = 0.299 * r + 0.587 * gr + 0.114 * b;
    r = luma + (r - luma) * saturation;
    gr = luma + (gr - luma) * saturation;
    b = luma + (b - luma) * saturation;
    r = (Math.pow(Math.max(0, r), gamma) - 0.5) * contrast + 0.5;
    gr = (Math.pow(Math.max(0, gr), gamma) - 0.5) * contrast + 0.5;
    b = (Math.pow(Math.max(0, b), gamma) - 0.5) * contrast + 0.5;
    px[i] = Math.max(0, Math.min(255, r * gain[0] * 255));
    px[i + 1] = Math.max(0, Math.min(255, gr * gain[1] * 255));
    px[i + 2] = Math.max(0, Math.min(255, b * gain[2] * 255));
  }
  ctx.putImageData(data, 0, 0);
  const out = new THREE.CanvasTexture(canvas);
  out.colorSpace = tex.colorSpace;
  out.flipY = tex.flipY;
  out.wrapS = tex.wrapS;
  out.wrapT = tex.wrapT;
  out.repeat.copy(tex.repeat);
  out.anisotropy = tex.anisotropy;
  tex.dispose();
  return out;
}

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
      // Kräftigere Farben: tiefes Schwarz, leuchtendes Elfenbein, warmes sattes Holz
      const boardDiff = grade(od, { saturation: 1.35, contrast: 1.28, gamma: 1.25, gain: [1.04, 1.0, 0.94] });
      const blackDiff = grade(bd, { saturation: 1.2, contrast: 1.4, gamma: 2.1 });
      const whiteDiff = grade(wd, { saturation: 1.3, contrast: 1.12, gamma: 1.05, gain: [1.03, 1.0, 0.93] });
      const tableDiff = grade(td, { saturation: 1.7, contrast: 1.25, gamma: 1.1, gain: [1.1, 0.98, 0.82] });
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
          w: pbr(whiteDiff, wn, wa, { color: '#cdc5b8', clearcoat: 0.06, clearcoatRoughness: 0.5, envMapIntensity: 0.7 }),
          b: pbr(blackDiff, bn, ba, { clearcoat: 0.45, clearcoatRoughness: 0.18, envMapIntensity: 0.85 }),
        },
        // Brett seidenmatt: von oben spiegeln sich sonst Fenster und Decke des Raumlichts
        board: { geometry, material: satin(pbr(boardDiff, on, oa, { envMapIntensity: 0.55 })) },
        table: new THREE.MeshStandardMaterial({
          map: tableDiff,
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
