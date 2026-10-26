import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MoveLibrary } from '../../src/scene/battleScript';
import moves from '../../src/scene/warriorMoves.json';

const FILES = ['public/models/warrior_white.glb', 'public/models/warrior_black.glb', 'public/models/warrior_moves.glb'];
const library = moves as MoveLibrary;
// Die Mixamo-Dateien liegen nicht in Git (Lizenz) – ohne `npm run assets:warriors` werden die Dateitests übersprungen
const built = FILES.every((f) => existsSync(f));

describe('Bewegungsbibliothek (src/scene/warriorMoves.json)', () => {
  it('hat für jede Rolle, die das Drehbuch braucht, mindestens eine Bewegung', () => {
    for (const role of ['idle', 'run', 'attack', 'heavy', 'block', 'impact', 'death', 'taunt', 'victory', 'kick'] as const) {
      expect(library[role]?.length, role).toBeGreaterThan(0);
    }
    expect(library.attack!.length + library.heavy!.length).toBeGreaterThanOrEqual(6);
  });

  it('Angriffe haben einen Treffermoment innerhalb der Bewegung', () => {
    for (const clip of [...library.attack!, ...library.heavy!, ...library.kick!]) {
      expect(clip.impact, clip.name).toBeGreaterThan(0.1);
      expect(clip.impact!, clip.name).toBeLessThan(clip.duration);
    }
  });
});

describe.skipIf(!built)('Krieger (public/models/warrior_*.glb)', () => {
  it('enthalten jede Bewegung der Bibliothek, beide Figuren mit Schwert und Schild', async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const anims = (await io.read(FILES[2])).getRoot().listAnimations().map((a) => a.getName());
    for (const clip of Object.values(library).flat()) expect(anims).toContain(clip!.name);
    for (const file of FILES.slice(0, 2)) {
      const root = (await io.read(file)).getRoot();
      const meshes = root.listMeshes().map((m) => m.getName()).join(' ');
      expect(meshes).toMatch(/Sword/);
      expect(meshes).toMatch(/Shield/);
      expect(root.listNodes().some((n) => n.getName() === 'mixamorig:Hips')).toBe(true);
    }
  });

  it('bleiben klein genug für schnelles Laden', () => {
    for (const file of FILES) expect(statSync(file).size).toBeLessThan(1_200_000);
  });
});
