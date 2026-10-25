// Gibt Aufbau eines glTF-Modells aus: Knoten, Meshes, Dreiecke, Maße. Aufruf: node scripts/inspect-model.mjs <datei.gltf>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';

const file = process.argv[2];
if (!file) {
  console.error('Aufruf: node scripts/inspect-model.mjs <datei.gltf>');
  process.exit(1);
}

await MeshoptDecoder.ready;
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(file);
const root = doc.getRoot();
console.log('Szenen:', root.listScenes().length, '| Knoten:', root.listNodes().length, '| Meshes:', root.listMeshes().length);
console.log('Materialien:', root.listMaterials().map((m) => m.getName()).join(', '));

for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  let tris = 0;
  const attrs = new Set();
  for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices();
    tris += (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
    prim.listSemantics().forEach((s) => attrs.add(s));
  }
  const b = getBounds(node);
  const size = b.max.map((v, i) => +(v - b.min[i]).toFixed(4));
  const center = b.max.map((v, i) => +((v + b.min[i]) / 2).toFixed(4));
  const mat = mesh.listPrimitives()[0]?.getMaterial()?.getName();
  console.log(
    `${node.getName().padEnd(28)} mesh=${mesh.getName().padEnd(22)} tris=${String(tris).padStart(6)} mat=${mat} size=${size} center=${center} attrs=${[...attrs].join('/')}`,
  );
}
