// Bereitet die CC0-Krieger aus „KayKit Adventurers“ (Kay Lousberg) für die Kampf-Szenen auf:
// nur benötigte Ausrüstung und Animationen, komprimiert. Aufruf:
//   node scripts/build-warriors.mjs <assets-src/kaykit-adventurers> <public/models>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, resample } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const [srcDir, outDir] = process.argv.slice(2);
if (!srcDir || !outDir) {
  console.error('Aufruf: node scripts/build-warriors.mjs <quellordner> <zielordner>');
  process.exit(1);
}

const WARRIORS = [
  {
    file: 'Knight.glb',
    out: 'warrior_white.glb',
    // Ritter: Einhandschwert + Rundschild
    drop: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '2H_Sword'],
    anims: ['Idle', 'Running_A', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Stab', 'Block', 'Block_Hit', 'Hit_A', 'Death_A', 'Cheer'],
  },
  {
    file: 'Barbarian.glb',
    out: 'warrior_black.glb',
    // Barbar: Zweihandaxt
    drop: ['1H_Axe_Offhand', '1H_Axe', 'Mug', 'Barbarian_Round_Shield'],
    anims: ['2H_Melee_Idle', 'Running_A', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin', 'Block', 'Block_Hit', 'Hit_A', 'Death_A', 'Cheer'],
  },
];

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

for (const w of WARRIORS) {
  const doc = await io.read(join(srcDir, w.file));
  const root = doc.getRoot();
  for (const node of root.listNodes()) if (w.drop.includes(node.getName())) node.dispose();
  // Kanäle und Abtaster einzeln entfernen – sonst halten sie ihre Daten fest und prune() räumt nichts ab
  const dropAnim = (anim) => {
    for (const ch of anim.listChannels()) ch.dispose();
    for (const s of anim.listSamplers()) s.dispose();
    anim.dispose();
  };
  for (const anim of root.listAnimations()) if (!w.anims.includes(anim.getName())) dropAnim(anim);
  // Skelett-Animationen leben von Drehungen: Skalierungs- und (außer an der Hüfte) Positionsspuren sind konstant,
  // kosten aber je eine Datenbeschreibung – weg damit (spart ca. 3/4 der Datei)
  for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) {
      const path = ch.getTargetPath();
      const name = ch.getTargetNode()?.getName() ?? '';
      if (path === 'scale' || (path === 'translation' && !/hips|root/i.test(name))) {
        ch.getSampler()?.dispose();
        ch.dispose();
      }
    }
  }
  const kept = root.listAnimations().map((a) => a.getName());
  const missing = w.anims.filter((a) => !kept.includes(a));
  if (missing.length) throw new Error(`${w.file}: Animation fehlt: ${missing.join(', ')}`);
  await doc.transform(prune(), dedup(), resample(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }), prune());
  console.log(`  Accessoren: ${root.listAccessors().length}, Puffer: ${root.listBuffers().length}`);
  const out = join(outDir, w.out);
  await io.write(out, doc);
  console.log(`${w.out}: ${kept.length} Animationen, ${Math.round(statSync(out).size / 1024)} KB`);
}
