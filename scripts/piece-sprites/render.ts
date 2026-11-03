// Nur Entwicklung: rendert die zwölf Marmorfiguren (Stil „Echt“) als freigestellte Einzelbilder für die 2D-Ansicht.
// Aufgerufen von scripts/build-sprites.mjs; Ergebnis landet in window.__sprites (Daten-URLs, PNG).
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import type { Color, PieceSymbol } from '../../src/core/types';
import { loadModelPieces } from '../../src/scene/pieceModels';
import { assetUrl, ENV_FILE, loadRealAssets } from '../../src/scene/realAssets';
import { addRim, PIECE_RIM } from '../../src/scene/rim';

const SIZE = Number(new URLSearchParams(location.search).get('size') ?? 512);
const TYPES: PieceSymbol[] = ['k', 'q', 'r', 'b', 'n', 'p'];
/** Springer im Profil, Kopf nach links (wie in Schachdiagrammen) */
const KNIGHT_YAW: Record<Color, number> = { w: Math.PI - 0.35, b: Math.PI - 0.35 };
/** Blick leicht von oben, wie bei einem Brett vor einem */
const ELEVATION = 0.1;
const FOV = 18;
/** Brettbild: Ausschnitt ±4,15 Einheiten (Spielfeld ±4 plus ein schmaler Rand des Rahmens) */
const BOARD_HALF = 4.15;
const BOARD_PX = 1536;

async function main() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);

  const [model, real, hdr] = await Promise.all([
    loadModelPieces(),
    loadRealAssets(),
    new RGBELoader().loadAsync(assetUrl(ENV_FILE)),
  ]);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(hdr).texture;

  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.95;
  const key = new THREE.DirectionalLight('#fff3dd', 2.1);
  key.position.set(-5, 9, 9);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#a9c4ff', 0.6);
  fill.position.set(6, 4, -8);
  scene.add(fill);
  scene.add(new THREE.AmbientLight('#ffffff', 0.25));
  for (const c of ['w', 'b'] as const) addRim(real.pieces[c], PIECE_RIM[c]);

  // Gemeinsamer Bildausschnitt für alle Figuren (nach dem König): Größenverhältnisse bleiben wie am Brett
  const kingBox = (model.geometries.k.boundingBox ??= new THREE.Box3().setFromBufferAttribute(model.geometries.k.getAttribute('position') as THREE.BufferAttribute));
  const height = kingBox.max.y - kingBox.min.y;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100);
  // Fuß knapp über dem unteren Bildrand, Krone knapp unter dem oberen
  const span = height * 1.04;
  const distance = span / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const center = new THREE.Vector3(0, kingBox.min.y + height * 0.5, 0);
  camera.position.set(0, center.y + Math.sin(ELEVATION) * distance, Math.cos(ELEVATION) * distance);
  camera.lookAt(center);

  // Brett von genau oben (Draufsicht ohne Perspektive), gleiches Licht und Material wie in der 3D-Szene
  renderer.setSize(BOARD_PX, BOARD_PX);
  renderer.setClearColor(0x2a2420, 1);
  const top = new THREE.OrthographicCamera(-BOARD_HALF, BOARD_HALF, BOARD_HALF, -BOARD_HALF, 0.1, 40);
  top.position.set(0, 12, 0);
  top.up.set(0, 0, -1);
  top.lookAt(0, 0, 0);
  const boardMesh = new THREE.Mesh(real.board.geometry, real.board.material);
  scene.add(boardMesh);
  renderer.render(scene, top);
  const boardImage = renderer.domElement.toDataURL('image/png');
  scene.remove(boardMesh);
  renderer.setSize(SIZE, SIZE);
  renderer.setClearColor(0x000000, 0);

  const out: Record<string, string> = {};
  for (const color of ['w', 'b'] as const) {
    for (const type of TYPES) {
      const mesh = new THREE.Mesh(model.geometries[type], real.pieces[color]);
      if (type === 'n') mesh.rotation.y = KNIGHT_YAW[color];
      scene.add(mesh);
      renderer.render(scene, camera);
      out[`${color}${type}`] = renderer.domElement.toDataURL('image/png');
      scene.remove(mesh);
    }
  }
  (window as unknown as { __board: string }).__board = boardImage;
  (window as unknown as { __sprites: Record<string, string> }).__sprites = out;
}

main().catch((err) => {
  (window as unknown as { __spriteError: string }).__spriteError = String(err?.stack ?? err);
});
