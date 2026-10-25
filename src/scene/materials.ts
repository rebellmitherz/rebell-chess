import * as THREE from 'three';
import type { Color } from '../core/types';

/**
 * Gemeinsame PBR-Materialien. Alle Figuren und Felder teilen sich diese Instanzen,
 * damit der Grafikchip nur wenige Shader kompilieren muss.
 * Texturen werden zur Laufzeit erzeugt (Canvas) – keine externen Dateien, keine Fremdlizenzen.
 */

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, srgb = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Gebürstetes Metall: feine horizontale Riefen (Rauheitskarte) */
function brushedTexture() {
  return canvasTexture(512, (ctx, size) => {
    ctx.fillStyle = '#7a7a7a';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2600; i++) {
      const y = Math.random() * size;
      const v = 100 + Math.random() * 60;
      ctx.strokeStyle = `rgba(${v},${v},${v},${0.18 + Math.random() * 0.25})`;
      ctx.lineWidth = Math.random() * 1.4 + 0.3;
      ctx.beginPath();
      const x = Math.random() * size;
      ctx.moveTo(x - 220, y);
      ctx.lineTo(x + 220, y + (Math.random() - 0.5) * 2);
      ctx.stroke();
    }
  });
}

/** Dunkler Stein mit feinen Adern (Farb- und Rauheitsvariation) */
function marbleTexture(base: string, vein: string) {
  return canvasTexture(
    512,
    (ctx, size) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = vein;
        ctx.globalAlpha = 0.05 + Math.random() * 0.12;
        ctx.lineWidth = 0.6 + Math.random() * 2.2;
        ctx.beginPath();
        let x = Math.random() * size;
        let y = Math.random() * size;
        ctx.moveTo(x, y);
        for (let k = 0; k < 9; k++) {
          x += (Math.random() - 0.3) * 90;
          y += (Math.random() - 0.5) * 70;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    true,
  );
}

let cached: ReturnType<typeof build> | null = null;

function build() {
  const brushed = brushedTexture();
  const darkStone = marbleTexture('#16171b', '#8b8f99');
  const lightStone = marbleTexture('#c9ccd2', '#ffffff');

  const gold = new THREE.MeshPhysicalMaterial({
    color: '#f5c96a',
    metalness: 1,
    roughness: 0.24,
    clearcoat: 0.35,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.45,
  });
  const onyx = new THREE.MeshPhysicalMaterial({
    color: '#08090b',
    metalness: 0.2,
    roughness: 0.22,
    clearcoat: 0.85,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.5,
  });
  const silver = new THREE.MeshPhysicalMaterial({
    color: '#e3e6eb',
    metalness: 1,
    roughness: 0.22,
    envMapIntensity: 1.2,
  });
  const gunmetal = new THREE.MeshPhysicalMaterial({
    color: '#2b2c33',
    metalness: 1,
    roughness: 0.3,
    envMapIntensity: 1.1,
  });

  return {
    piece: { w: gold, b: onyx } as Record<Color, THREE.MeshPhysicalMaterial>,
    accent: { w: gunmetal, b: silver } as Record<Color, THREE.MeshPhysicalMaterial>,
    lightSquare: new THREE.MeshPhysicalMaterial({
      color: '#d4d7dd',
      map: lightStone,
      metalness: 0.55,
      roughness: 0.34,
      roughnessMap: brushed,
      clearcoat: 0.25,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.9,
    }),
    darkSquare: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map: darkStone,
      metalness: 0.15,
      roughness: 0.24,
      clearcoat: 0.7,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.35,
    }),
    frame: new THREE.MeshPhysicalMaterial({
      color: '#0b0b0e',
      metalness: 0.35,
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    }),
    trim: new THREE.MeshPhysicalMaterial({
      color: '#e2b85c',
      metalness: 1,
      roughness: 0.26,
      envMapIntensity: 1.2,
    }),
    plinth: new THREE.MeshStandardMaterial({ color: '#121318', metalness: 0.8, roughness: 0.38 }),
    floor: new THREE.MeshStandardMaterial({ color: '#0a0b0e', metalness: 0.1, roughness: 0.85 }),
  };
}

export function getMaterials() {
  if (!cached) cached = build();
  return cached;
}
