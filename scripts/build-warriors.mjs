// Bereitet die Mixamo-Krieger für die Kampfszenen auf (Figuren und Animationen von mixamo.com, von Emilio
// heruntergeladen). Aufruf:
//   node scripts/build-warriors.mjs <weiß.fbx> <schwarz.fbx> <ordner-mit-animationen> <public/models> <src/scene>
//
// - Figuren: FBX → glTF (FBX2glTF), Texturen auf 1024 px verkleinert (JPEG/WebP), Gitter komprimiert (meshopt)
// - Animationen: alle in eine Datei (warrior_moves.glb), nur Drehungen + Hüfthöhe; die waagrechte Hüftbewegung
//   wird als „Fortbewegung“ herausgelöst (die Szene verschiebt dafür den ganzen Krieger)
// - Jede Animation bekommt eine Rolle (Angriff, Abwehr, Treffer, Tod …) und – für Angriffe – den Treffermoment,
//   gemessen an der schnellsten Bewegung von Hand bzw. Fuß. Ergebnis: src/scene/warriorMoves.json
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, resample, textureCompress } from '@gltf-transform/functions';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import * as THREE from 'three';

const [whiteFbx, blackFbx, animDir, outDir, srcDir] = process.argv.slice(2);
if (!whiteFbx || !blackFbx || !animDir || !outDir || !srcDir) {
  console.error('Aufruf: node scripts/build-warriors.mjs <weiß.fbx> <schwarz.fbx> <animationen> <public/models> <src/scene>');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exe = join(root, 'node_modules', 'fbx2gltf', 'bin', process.platform === 'win32' ? 'Windows_NT' : process.platform === 'darwin' ? 'Darwin' : 'Linux', process.platform === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF');
const tmp = join(root, 'assets-src', 'mixamo', '_glb');
mkdirSync(tmp, { recursive: true });

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

/** FBX → GLB (zwischengespeichert, solange die FBX nicht neuer ist) */
function convert(fbx) {
  const name = basename(fbx, extname(fbx)).replace(/[^\w()-]+/g, '_');
  const out = join(tmp, name + '.glb');
  if (existsSync(out) && statSync(out).mtimeMs > statSync(fbx).mtimeMs) return out;
  execFileSync(exe, ['--binary', '--input', fbx, '--output', join(tmp, name)], { stdio: 'pipe' });
  return out;
}

// ---------- Rollen ----------

/** Rolle aus dem Mixamo-Namen ableiten */
function roleOf(name) {
  const n = name.toLowerCase();
  if (/death|dying|die/.test(n)) return 'death';
  if (/impact|hit react|reaction|hit$|hurt/.test(n)) return 'impact';
  if (/block idle/.test(n)) return 'idle';
  if (/block/.test(n)) return /hit|impact/.test(n) ? 'blockHit' : 'block';
  if (/kick/.test(n)) return 'kick';
  if (/power ?up|taunt|casting|cast|roar|battlecry|shout/.test(n)) return 'taunt';
  if (/victory|cheer|celebrat/.test(n)) return 'victory';
  if (/jump attack|heavy|power attack|great|spin|360/.test(n)) return 'heavy';
  if (/slash|attack|strike|stab|swing|punch/.test(n)) return 'attack';
  if (/run|sprint/.test(n)) return 'run';
  if (/idle/.test(n)) return 'idle';
  return null; // Gehen, Drehen, Schleichen … brauchen wir nicht
}

// ---------- Vorwärtskinematik für Treffer und Fortbewegung ----------

function sampler(s) {
  const input = s.getInput().getArray();
  const output = s.getOutput();
  const size = output.getElementSize();
  return (t) => {
    let i = 0;
    while (i < input.length - 1 && input[i + 1] < t) i++;
    const j = Math.min(i + 1, input.length - 1);
    const k = j === i ? 0 : Math.min(1, Math.max(0, (t - input[i]) / (input[j] - input[i])));
    const a = output.getElement(i, []);
    const b = output.getElement(j, []);
    if (size === 4) return new THREE.Quaternion(...a).slerp(new THREE.Quaternion(...b), k);
    return new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), k);
  };
}

function rig(doc, anim) {
  const parent = new Map();
  for (const n of doc.getRoot().listNodes()) for (const c of n.listChildren()) parent.set(c, n);
  const tracks = new Map();
  let duration = 0;
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode();
    if (!tracks.has(node)) tracks.set(node, {});
    tracks.get(node)[ch.getTargetPath()] = sampler(ch.getSampler());
    const inp = ch.getSampler().getInput().getArray();
    duration = Math.max(duration, inp[inp.length - 1]);
  }
  const world = (node, t) => {
    const tr = tracks.get(node) ?? {};
    const p = tr.translation ? tr.translation(t) : new THREE.Vector3(...node.getTranslation());
    const q = tr.rotation ? tr.rotation(t) : new THREE.Quaternion(...node.getRotation());
    const s = tr.scale ? tr.scale(t) : new THREE.Vector3(...node.getScale());
    const m = new THREE.Matrix4().compose(p, q, s);
    const par = parent.get(node);
    return par ? world(par, t).multiply(m) : m;
  };
  return { duration, world };
}

const byName = (doc, suffix) => doc.getRoot().listNodes().find((n) => n.getName().replace(/^mixamorig\d*[:_]?/i, '') === suffix);

/** Zeitpunkt der schnellsten Bewegung eines Knochens */
function fastest(r, node, from = 0.08) {
  let best = { t: r.duration * 0.5, speed: 0 };
  let prev = null;
  const dt = 1 / 60;
  for (let t = 0; t <= r.duration + 1e-6; t += dt) {
    const p = new THREE.Vector3().setFromMatrixPosition(r.world(node, t));
    if (prev && t > r.duration * from) {
      const speed = p.distanceTo(prev) / dt;
      if (speed > best.speed) best = { t, speed };
    }
    prev = p;
  }
  return best;
}

// ---------- Animationen ----------

const animFiles = readdirSync(animDir).filter((f) => /\.fbx$/i.test(f)).sort();
if (!animFiles.length) throw new Error(`Keine FBX-Animationen in ${animDir}`);
const out = new Document();
out.createBuffer();
const outScene = out.createScene('Skelett');
let skeletonCopied = false;
const nodeMap = new Map(); // Name → Knoten im Ausgabedokument
const library = {};
let hipsName = '';

for (const file of animFiles) {
  const glb = convert(join(animDir, file));
  const doc = await io.read(glb);
  const anims = doc.getRoot().listAnimations();
  if (!anims.length) continue;
  const anim = anims[0];
  const clipName = basename(file, extname(file)).toLowerCase().replace(/\s+/g, ' ').trim();
  const role = roleOf(clipName);
  if (!role) {
    console.log(`  übersprungen: ${clipName}`);
    continue;
  }
  const hips = byName(doc, 'Hips');
  if (!hips) throw new Error(`${file}: kein Hüftknochen`);
  hipsName = hips.getName();

  // Skelett einmal übernehmen (nur Knoten, keine Gitter)
  if (!skeletonCopied) {
    const copy = (src, parent) => {
      const n = out.createNode(src.getName()).setTranslation(src.getTranslation()).setRotation(src.getRotation()).setScale(src.getScale());
      nodeMap.set(src.getName(), n);
      if (parent) parent.addChild(n);
      else outScene.addChild(n);
      for (const c of src.listChildren()) if (!c.getMesh()) copy(c, n);
    };
    for (const n of doc.getRoot().getDefaultScene().listChildren()) if (!n.getMesh()) copy(n, null);
    skeletonCopied = true;
  }

  const r = rig(doc, anim);
  const meta = { name: clipName, role, duration: +r.duration.toFixed(3) };

  // Treffermoment: Hand (Waffe) bzw. Fuß beim Tritt; beim Tod der Aufprall (Hüfte am tiefsten, Tempo raus)
  if (role === 'attack' || role === 'heavy') meta.impact = +fastest(r, byName(doc, 'RightHand')).t.toFixed(3);
  if (role === 'kick') {
    const l = fastest(r, byName(doc, 'LeftFoot'));
    const rr = fastest(r, byName(doc, 'RightFoot'));
    meta.impact = +(l.speed > rr.speed ? l.t : rr.t).toFixed(3);
  }
  if (role === 'death') {
    let low = { t: r.duration, y: Infinity };
    for (let t = 0; t <= r.duration; t += 1 / 60) {
      const y = new THREE.Vector3().setFromMatrixPosition(r.world(hips, t)).y;
      if (y < low.y - 0.005) low = { t, y };
    }
    meta.impact = +low.t.toFixed(3);
  }

  // Fortbewegung: Hüfte in Weltkoordinaten (Modell schaut nach +z), Bodenanteil herauslösen
  const start = new THREE.Vector3().setFromMatrixPosition(r.world(hips, 0));
  const samples = [];
  for (let i = 0; i <= 10; i++) {
    const t = (r.duration * i) / 10;
    const p = new THREE.Vector3().setFromMatrixPosition(r.world(hips, t)).sub(start);
    samples.push([+(i / 10).toFixed(2), +p.z.toFixed(3), +p.x.toFixed(3)]);
  }
  const travel = samples[samples.length - 1];
  if (Math.hypot(travel[1], travel[2]) > 0.05 && role !== 'run' && role !== 'idle') meta.root = samples;

  // Kanäle kopieren: nur Drehungen und die Hüfte (deren waagrechter Anteil auf den Startwert festgelegt)
  const outAnim = out.createAnimation(clipName);
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode();
    const path = ch.getTargetPath();
    const target = nodeMap.get(node.getName());
    if (!target) continue;
    const isHips = node === hips;
    if (path === 'scale' || (path === 'translation' && !isHips)) continue;
    const s = ch.getSampler();
    const input = out.createAccessor().setType('SCALAR').setArray(new Float32Array(s.getInput().getArray()));
    let values = new Float32Array(s.getOutput().getArray());
    if (isHips && path === 'translation') {
      // Hüfte: waagrechte Bewegung entfernen (im Elternraum), Höhe behalten
      const x0 = values[0];
      const z0 = values[2];
      values = values.slice();
      for (let i = 0; i < values.length; i += 3) {
        values[i] = x0;
        values[i + 2] = z0;
      }
    }
    const output = out.createAccessor().setType(path === 'rotation' ? 'VEC4' : 'VEC3').setArray(values);
    const sampler = out.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(s.getInterpolation());
    outAnim.addSampler(sampler).addChannel(out.createAnimationChannel().setTargetNode(target).setTargetPath(path).setSampler(sampler));
  }
  // Lange Angriffe (Kombos, Ausfallschritte) sind die schweren – gut für den Todesstoß
  if (role === 'attack' && meta.duration >= 2) meta.role = 'heavy';
  (library[meta.role] ??= []).push(meta);
  console.log(`  ${meta.role.padEnd(8)} ${clipName} (${meta.duration}s${meta.impact !== undefined ? `, Treffer ${meta.impact}s` : ''}${meta.root ? `, bewegt ${meta.root.at(-1)[1]}m` : ''})`);
}
for (const acc of out.getRoot().listAccessors()) acc.setBuffer(out.getRoot().listBuffers()[0]);
await out.transform(resample(), prune(), dedup(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const movesFile = join(outDir, 'warrior_moves.glb');
await io.write(movesFile, out);
console.log(`warrior_moves.glb: ${out.getRoot().listAnimations().length} Animationen, ${Math.round(statSync(movesFile).size / 1024)} KB`);

// ---------- Figuren ----------

/** Weiße Seite: dunkle Rüstung zu hellem, leicht warmem Silber aufhellen */
async function brighten(doc) {
  for (const m of doc.getRoot().listMaterials()) {
    const tex = m.getBaseColorTexture();
    if (!tex) continue;
    const img = await sharp(Buffer.from(tex.getImage()))
      .modulate({ brightness: 2.3, saturation: 0.55 })
      .linear([1.12, 1.08, 1.0], [18, 14, 6])
      .png()
      .toBuffer();
    tex.setImage(new Uint8Array(img)).setMimeType('image/png');
  }
}

async function character(fbx, file, light = false) {
  const doc = await io.read(convert(fbx));
  const r = doc.getRoot();
  if (light) await brighten(doc);
  for (const a of r.listAnimations()) {
    for (const ch of a.listChannels()) ch.dispose();
    for (const s of a.listSamplers()) s.dispose();
    a.dispose();
  }
  for (const m of r.listMaterials()) {
    // Mixamo liefert oft Glanz/Spiegelung als Zusatz – für das Spiel genügt eine matte PBR-Oberfläche
    m.setMetallicFactor(Math.min(m.getMetallicFactor(), 0.6));
    m.setRoughnessFactor(Math.max(m.getRoughnessFactor(), 0.45));
  }
  await doc.transform(
    prune(),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const target = join(outDir, file);
  await io.write(target, doc);
  const nodes = r.listNodes().map((n) => n.getName());
  if (!nodes.includes(hipsName)) throw new Error(`${file}: Skelett passt nicht zu den Animationen (${hipsName} fehlt)`);
  console.log(`${file}: ${r.listMeshes().length} Gitter, ${r.listTextures().length} Texturen, ${Math.round(statSync(target).size / 1024)} KB`);
}
await character(whiteFbx, 'warrior_white.glb', whiteFbx === blackFbx);
await character(blackFbx, 'warrior_black.glb');

writeFileSync(join(srcDir, 'warriorMoves.json'), JSON.stringify(library, null, 1) + '\n');
console.log(`warriorMoves.json: ${Object.entries(library).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
