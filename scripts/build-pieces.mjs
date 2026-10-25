// Bereitet das CC0-Schachset von Poly Haven („Chess Set“ von Riley Queen) für das Spiel auf:
// je Figurtyp eine Geometrie, Sockelmitte im Ursprung, Feldmaß 1, Springer schaut nach +x,
// quantisiert und meshopt-komprimiert. Aufruf:
//   node scripts/build-pieces.mjs <chess_set_1k.gltf> <ausgabe.glb>
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, quantize, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Aufruf: node scripts/build-pieces.mjs <chess_set_1k.gltf> <ausgabe.glb>');
  process.exit(1);
}

/** Feld im Modell: 0,0579 m. Faktor 15 statt 17,3 → Figuren ca. 13 % kleiner als maßstabsgetreu (bessere Übersicht). */
const SCALE = 15;
const SOURCES = {
  p: 'piece_pawn_white_01',
  n: 'piece_knight_white_01',
  b: 'piece_bishop_white_01',
  r: 'piece_rook_white_01',
  q: 'piece_queen_white',
  k: 'piece_king_white',
};

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const src = await io.read(input);
const out = new Document();
out.createBuffer();
const scene = out.createScene('pieces');

for (const [type, nodeName] of Object.entries(SOURCES)) {
  const node = src.getRoot().listNodes().find((n) => n.getName() === nodeName);
  if (!node) throw new Error(`Knoten ${nodeName} fehlt im Modell`);
  const prim = node.getMesh().listPrimitives()[0];
  const m = node.getWorldMatrix();
  const pos = prim.getAttribute('POSITION');
  const nor = prim.getAttribute('NORMAL');
  const uv = prim.getAttribute('TEXCOORD_0');
  const count = pos.getCount();

  const world = new Float32Array(count * 3);
  const p = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    pos.getElement(i, p);
    world[i * 3] = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    world[i * 3 + 1] = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    world[i * 3 + 2] = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
  }
  // Sockelmitte aus den untersten Punkten, Boden auf y = 0
  let minY = Infinity;
  for (let i = 0; i < count; i++) minY = Math.min(minY, world[i * 3 + 1]);
  let cx = 0;
  let cz = 0;
  let n = 0;
  for (let i = 0; i < count; i++) {
    if (world[i * 3 + 1] < minY + 0.004) {
      cx += world[i * 3];
      cz += world[i * 3 + 2];
      n++;
    }
  }
  cx /= n;
  cz /= n;
  // Springer: Blick von +z nach +x drehen (θ = +90° um y), damit er zur Ausrichtung im Spiel passt
  const rotate = type === 'n';
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    let x = (world[i * 3] - cx) * SCALE;
    const y = (world[i * 3 + 1] - minY) * SCALE;
    let z = (world[i * 3 + 2] - cz) * SCALE;
    nor.getElement(i, p);
    let nx = p[0];
    let nz = p[2];
    if (rotate) {
      [x, z] = [z, -x];
      [nx, nz] = [nz, -nx];
    }
    positions.set([x, y, z], i * 3);
    normals.set([nx, p[1], nz], i * 3);
    uv.getElement(i, p);
    uvs.set([p[0], p[1]], i * 2);
  }

  const primitive = out
    .createPrimitive()
    .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(positions))
    .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(normals))
    .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(uvs))
    .setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint32Array(prim.getIndices().getArray())));
  const mesh = out.createMesh(type).addPrimitive(primitive);
  scene.addChild(out.createNode(type).setMesh(mesh));
  let maxY = 0;
  for (let i = 0; i < count; i++) maxY = Math.max(maxY, positions[i * 3 + 1]);
  console.log(`${type}: ${prim.getIndices().getCount() / 3} Dreiecke, Höhe ${maxY.toFixed(3)} Felder`);
}

await out.transform(weld(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(output, out);
console.log(`geschrieben: ${output}`);
