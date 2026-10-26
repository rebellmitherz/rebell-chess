import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WARRIOR_CLIPS } from '../../src/scene/battleScript';

const FILES = { w: 'public/models/warrior_white.glb', b: 'public/models/warrior_black.glb' } as const;

describe('Krieger (public/models/warrior_*.glb)', () => {
  it('enthalten jede Animation, die das Drehbuch abspielt, und nur eine Waffe', async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    for (const color of ['w', 'b'] as const) {
      const doc = await io.read(FILES[color]);
      const root = doc.getRoot();
      const names = root.listAnimations().map((a) => a.getName());
      for (const clip of Object.values(WARRIOR_CLIPS[color])) expect(names, `${color}: ${clip.name}`).toContain(clip.name);
      expect(root.listSkins().length).toBeGreaterThan(0); // ein Skin je Körperteil, alle am selben Skelett
      const nodes = root.listNodes().map((n) => n.getName());
      if (color === 'w') {
        expect(nodes).toContain('1H_Sword');
        expect(nodes).toContain('Round_Shield');
        expect(nodes).not.toContain('2H_Sword');
      } else {
        expect(nodes).toContain('2H_Axe');
        expect(nodes).not.toContain('Mug');
      }
    }
  });

  it('bleiben klein genug für schnelles Laden', () => {
    for (const file of Object.values(FILES)) {
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeLessThan(450_000);
    }
  });
});
