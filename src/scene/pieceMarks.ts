import * as THREE from 'three';
import type { Color, PieceSymbol } from '../core/types';

/**
 * Symbol-Plättchen für den Gegenüber-Modus: Ein flaches Scheibchen mit dem Figurensymbol liegt oben auf jeder Figur.
 * Das Symbol steht für den Besitzer richtig herum; der Gegenüber erkennt es auch kopfstehend sofort
 * (anders als eine verzerrte, kopfstehende 3D-Figur).
 */
const GLYPH: Record<PieceSymbol, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
// Variantenwähler „Text“ (U+FE0E): sonst zeichnen manche Systeme den Bauern als bunten Emoji
const TEXT_STYLE = '︎';
const FONT = '"Segoe UI Symbol","Noto Sans Symbols 2","Noto Sans Symbols","Apple Symbols","DejaVu Sans",serif';

/** Plättchen: weiße Figuren bekommen ein dunkles Plättchen mit hellem Symbol, schwarze umgekehrt */
const LOOK: Record<Color, { disc: string; glyph: string; ring: string }> = {
  w: { disc: '#241b10', glyph: '#f4e9d0', ring: '#e2b95c' },
  b: { disc: '#e9edf3', glyph: '#1b1f27', ring: '#6b7280' },
};

const SIZE = 128;
const textures = new Map<string, THREE.CanvasTexture>();
const materials = new Map<string, THREE.MeshBasicMaterial>();

function makeTexture(color: Color, type: PieceSymbol): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const look = LOOK[color];
  const c = SIZE / 2;
  ctx.beginPath();
  ctx.arc(c, c, c - 3, 0, Math.PI * 2);
  ctx.fillStyle = look.disc;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = look.ring;
  ctx.stroke();
  ctx.fillStyle = look.glyph;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(SIZE * 0.78)}px ${FONT}`;
  ctx.fillText(GLYPH[type] + TEXT_STYLE, c, c + SIZE * 0.04);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Ein Material je Farbe und Figurenart (wird von allen Figuren geteilt) */
export function getMarkMaterial(color: Color, type: PieceSymbol): THREE.MeshBasicMaterial {
  const key = color + type;
  let material = materials.get(key);
  if (!material) {
    let texture = textures.get(key);
    if (!texture) {
      texture = makeTexture(color, type);
      textures.set(key, texture);
    }
    material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.4, toneMapped: false });
    materials.set(key, material);
  }
  return material;
}

/** Durchmesser des Plättchens (Brettfeld = 1) */
export const MARK_SIZE = 0.52;
