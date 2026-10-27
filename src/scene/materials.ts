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

/** Farbwelten der gebauten Stile: „Edel“ = Smaragd und Gold, „Rebell“ = Blutrot und Elfenbein */
export type Theme = 'classic' | 'rebell';

interface Palette {
  /** Figuren: helle Seite (Weiß) und dunkle Seite (Schwarz) */
  pieceLight: { color: string; metalness: number; roughness: number; clearcoat: number; env: number };
  pieceDark: { color: string; metalness: number; roughness: number; clearcoat: number; env: number };
  /** Zierring am Fuß: für Weiß, für Schwarz */
  accentLight: string;
  accentDark: string;
  lightSquare: { color: string; stone: string; vein: string };
  darkSquare: { stone: string; vein: string };
  frame: string;
  trim: string;
  plinth: string;
  floor: string;
  /** Szenenhintergrund */
  background: string;
}

export const PALETTES: Record<Theme, Palette> = {
  classic: {
    pieceLight: { color: '#e8b440', metalness: 1, roughness: 0.34, clearcoat: 0.2, env: 0.8 },
    pieceDark: { color: '#0a0c0b', metalness: 0.2, roughness: 0.24, clearcoat: 0.85, env: 0.45 },
    accentLight: '#2a2c2b',
    accentDark: '#e9bd5a',
    lightSquare: { color: '#f4f6f0', stone: '#e8efe6', vein: '#ffffff' },
    darkSquare: { stone: '#0b7a4a', vein: '#3fe0a0' },
    frame: '#052e1d',
    trim: '#e9bd5a',
    plinth: '#07281b',
    floor: '#04301f',
    background: '#04140d',
  },
  rebell: {
    pieceLight: { color: '#c9b595', metalness: 0.1, roughness: 0.4, clearcoat: 0.2, env: 0.4 },
    pieceDark: { color: '#0c0a0a', metalness: 0.2, roughness: 0.24, clearcoat: 0.85, env: 0.45 },
    accentLight: '#2c2a2a',
    accentDark: '#e3b25a',
    lightSquare: { color: '#f6f1ea', stone: '#ede4da', vein: '#ffffff' },
    darkSquare: { stone: '#a8142a', vein: '#ff6a70' },
    frame: '#2d0509',
    trim: '#e3b25a',
    plinth: '#220509',
    floor: '#3a0710',
    background: '#150408',
  },
};

const cache: Partial<Record<Theme, ReturnType<typeof build>>> = {};

function build(theme: Theme) {
  const p = PALETTES[theme];
  const brushed = brushedTexture();
  const darkStone = marbleTexture(p.darkSquare.stone, p.darkSquare.vein);
  const lightStone = marbleTexture(p.lightSquare.stone, p.lightSquare.vein);

  const gold = new THREE.MeshPhysicalMaterial({
    color: p.pieceLight.color,
    metalness: p.pieceLight.metalness,
    roughness: p.pieceLight.roughness,
    clearcoat: p.pieceLight.clearcoat,
    clearcoatRoughness: 0.12,
    envMapIntensity: p.pieceLight.env,
  });
  const onyx = new THREE.MeshPhysicalMaterial({
    color: p.pieceDark.color,
    metalness: p.pieceDark.metalness,
    roughness: p.pieceDark.roughness,
    clearcoat: p.pieceDark.clearcoat,
    clearcoatRoughness: 0.06,
    envMapIntensity: p.pieceDark.env,
  });
  const silver = new THREE.MeshPhysicalMaterial({
    color: p.accentDark,
    metalness: 1,
    roughness: 0.22,
    envMapIntensity: 1.2,
  });
  const gunmetal = new THREE.MeshPhysicalMaterial({
    color: p.accentLight,
    metalness: 1,
    roughness: 0.3,
    envMapIntensity: 1.1,
  });

  return {
    piece: { w: gold, b: onyx } as Record<Color, THREE.MeshPhysicalMaterial>,
    accent: { w: gunmetal, b: silver } as Record<Color, THREE.MeshPhysicalMaterial>,
    lightSquare: new THREE.MeshPhysicalMaterial({
      color: p.lightSquare.color,
      map: lightStone,
      // Matt statt Spiegel: von oben spiegelt sich sonst die Studiodecke und wäscht die Farben aus
      metalness: 0.05,
      roughness: 0.55,
      roughnessMap: brushed,
      clearcoat: 0.04,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.3,
    }),
    darkSquare: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map: darkStone,
      metalness: 0.05,
      roughness: 0.4,
      clearcoat: 0.12,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.2,
    }),
    frame: new THREE.MeshPhysicalMaterial({
      color: p.frame,
      metalness: 0.2,
      roughness: 0.4,
      clearcoat: 0.3,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.5,
    }),
    trim: new THREE.MeshPhysicalMaterial({
      color: p.trim,
      metalness: 1,
      roughness: 0.38,
      envMapIntensity: 0.55,
    }),
    plinth: new THREE.MeshStandardMaterial({ color: p.plinth, metalness: 0.8, roughness: 0.38 }),
    floor: new THREE.MeshStandardMaterial({ color: p.floor, metalness: 0.1, roughness: 0.85 }),
  };
}

export function getMaterials(theme: Theme = 'classic') {
  return (cache[theme] ??= build(theme));
}

const modelCache = new WeakMap<THREE.Texture, Partial<Record<Theme, Record<Color, THREE.MeshPhysicalMaterial>>>>();

/** Die Figuren der Modell-Stile: zusätzlich mit gebackener Verdeckung (Rillen, Krone, Mähne). */
export function getModelMaterials(ao: THREE.Texture, theme: Theme = 'classic'): Record<Color, THREE.MeshPhysicalMaterial> {
  const perTheme = modelCache.get(ao) ?? {};
  modelCache.set(ao, perTheme);
  let m = perTheme[theme];
  if (!m) {
    const base = getMaterials(theme).piece;
    const gold = base.w.clone();
    gold.aoMap = ao;
    gold.aoMapIntensity = 0.85;
    const onyx = base.b.clone();
    onyx.aoMap = ao;
    onyx.aoMapIntensity = 0.6;
    m = { w: gold, b: onyx };
    perTheme[theme] = m;
  }
  return m;
}
