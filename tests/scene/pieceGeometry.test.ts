import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { PieceSymbol } from '../../src/core/types';
import { BISHOP_SLOT, getPieceGeometry, PIECE_HEIGHT } from '../../src/scene/pieceGeometry';

const TYPES: PieceSymbol[] = ['p', 'n', 'b', 'r', 'q', 'k'];

function hits(geometry: THREE.BufferGeometry, origin: THREE.Vector3, direction: THREE.Vector3) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const raycaster = new THREE.Raycaster(origin, direction.normalize());
  return raycaster.intersectObject(mesh).length;
}

describe('Figurengeometrie', () => {
  it.each(TYPES)('Figur %s ist gültig und hat die erwartete Höhe', (type) => {
    const g = getPieceGeometry(type);
    const pos = g.attributes.position.array as Float32Array;
    const normal = g.attributes.normal.array as Float32Array;
    expect(pos.length).toBeGreaterThan(1000);
    expect(pos.every(Number.isFinite)).toBe(true);
    expect(normal.every(Number.isFinite)).toBe(true);
    expect(g.attributes.uv.count).toBe(g.attributes.position.count);
    const box = g.boundingBox!;
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeGreaterThan(PIECE_HEIGHT[type] - 0.08);
    expect(box.max.y).toBeLessThan(PIECE_HEIGHT[type] + 0.08);
    // Figur bleibt auf ihrem Feld (Feldbreite 1)
    expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThan(0.4);
  });

  it('der Läufer hat eine durchgehende Kerbe in der Mitra', () => {
    const bishop = getPieceGeometry('b');
    const { centerX, centerY, angle } = BISHOP_SLOT;
    // Punkt im Schlitz (etwas rechts der Mitte), Strahl von vorn nach hinten
    const inSlot = new THREE.Vector3(centerX + 0.02 * Math.cos(angle), centerY + 0.02 * Math.sin(angle), 1);
    expect(hits(bishop, inSlot, new THREE.Vector3(0, 0, -1))).toBe(0);
    // Gleicher Punkt, aber senkrecht zur Kerbe nach unten verschoben: trifft massives Material
    const offset = new THREE.Vector3(Math.sin(angle), -Math.cos(angle), 0).multiplyScalar(0.05);
    expect(hits(bishop, inSlot.clone().add(offset), new THREE.Vector3(0, 0, -1))).toBeGreaterThan(0);
    // Die Spitze bleibt verbunden: auf der linken Seite oberhalb der Kerbe ist Material
    expect(hits(bishop, new THREE.Vector3(-0.04, 0.72, 1), new THREE.Vector3(0, 0, -1))).toBeGreaterThan(0);
  });

  it('der Springerkopf ist am Maul schmaler als am Hals', () => {
    const knight = getPieceGeometry('n');
    const pos = knight.attributes.position as THREE.BufferAttribute;
    let muzzle = 0;
    let neck = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = Math.abs(pos.getZ(i));
      if (y > 0.36 && y < 0.42 && x > 0.19) muzzle = Math.max(muzzle, z);
      if (y > 0.36 && y < 0.42 && x > -0.12 && x < 0.0) neck = Math.max(neck, z);
    }
    expect(muzzle).toBeGreaterThan(0.03);
    expect(muzzle).toBeLessThan(neck * 0.85);
  });
});
