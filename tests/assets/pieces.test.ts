import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const GLB = 'public/models/pieces.glb';

describe('Figurenmodell (public/models/pieces.glb)', () => {
  it('enthält alle sechs Figurtypen, auf dem Feld zentriert und in sinnvoller Größe', async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const doc = await io.read(GLB);
    const nodes = Object.fromEntries(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
    const heights: Record<string, number> = {};
    for (const type of ['p', 'n', 'b', 'r', 'q', 'k']) {
      const node = nodes[type];
      expect(node, `Figur ${type}`).toBeDefined();
      const b = getBounds(node);
      heights[type] = b.max[1] - b.min[1];
      expect(b.min[1]).toBeCloseTo(0, 2); // steht auf dem Brett
      expect(Math.max(-b.min[0], b.max[0], -b.min[2], b.max[2])).toBeLessThan(0.45); // passt aufs Feld
      const prim = node.getMesh()!.listPrimitives()[0];
      expect(prim.getAttribute('TEXCOORD_0')).toBeTruthy(); // für die Verdeckungskarte
    }
    // Staunton-Reihenfolge der Höhen
    expect(heights.p).toBeLessThan(heights.r);
    expect(heights.r).toBeLessThan(heights.n);
    expect(heights.n).toBeLessThan(heights.b);
    expect(heights.b).toBeLessThan(heights.q);
    expect(heights.q).toBeLessThan(heights.k);
  });

  it('bleibt klein genug für schnelles Laden', () => {
    expect(statSync(GLB).size).toBeLessThan(400_000);
    expect(existsSync('public/models/pieces_ao.jpg')).toBe(true);
    expect(statSync('public/models/pieces_ao.jpg').size).toBeLessThan(150_000);
  });
});
