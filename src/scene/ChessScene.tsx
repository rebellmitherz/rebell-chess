import { Environment, Lightformer, SoftShadows } from '@react-three/drei';
import { assetUrl, ENV_FILE } from './realAssets';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGame } from '../game/instance';
import type { GraphicsQuality } from '../game/settings';
import { BattleStage } from './Battle';
import { Board } from './Board';
import { CameraRig, FOV } from './CameraRig';
import { DragController } from './DragController';
import { GoldDust } from './Effects';
import { Highlights } from './Highlights';
import { PALETTES } from './materials';
import { ImpactFX, ShakeGroup } from './ImpactFX';
import { AdaptiveResolution, FrameDriver, ShadowUpdater } from './Performance';
import { Pieces } from './Pieces';
import { PostEffects } from './PostEffects';
import { loadModelPieces } from './pieceModels';
import { loadRealAssets } from './realAssets';

const QUALITY: Record<
  GraphicsQuality,
  { dpr: [number, number]; shadowMap: number; soft: boolean; dust: number; idleFps: number; post: boolean }
> = {
  high: { dpr: [1, 2], shadowMap: 2048, soft: true, dust: 160, idleFps: 30, post: true },
  medium: { dpr: [0.85, 1.5], shadowMap: 1024, soft: false, dust: 80, idleFps: 24, post: false },
  low: { dpr: [0.75, 1], shadowMap: 0, soft: false, dust: 0, idleFps: 15, post: false },
};

/** Studio-Umgebung aus Leuchtflächen: sorgt für die Reflexionen auf Gold und Onyx – ohne HDR-Download. */
function StudioEnvironment({ intensity }: { intensity: number }) {
  return (
    <Environment resolution={256} frames={1} background={false} environmentIntensity={intensity}>
      {/* Warmer Grundton statt Schwarz: Metall spiegelt sonst große schwarze Flächen */}
      <color attach="background" args={['#2a2520']} />
      <Lightformer form="rect" intensity={2.6} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[16, 16, 1]} />
      <Lightformer form="rect" intensity={3.4} color="#ffd794" position={[-9, 3, 1]} rotation-y={Math.PI / 2} scale={[16, 3, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#c9dcff" position={[9, 3, -1]} rotation-y={-Math.PI / 2} scale={[16, 3, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#fff1d6" position={[0, 3, 9]} rotation-y={Math.PI} scale={[16, 3, 1]} />
      <Lightformer form="rect" intensity={2.0} position={[0, 3, -9]} scale={[16, 3, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffe2b0" position={[-7, 1, -7]} rotation-y={Math.PI / 4} scale={[6, 2, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#d9e6ff" position={[7, 1, 7]} rotation-y={(-3 * Math.PI) / 4} scale={[6, 2, 1]} />
      <Lightformer form="ring" intensity={2.5} color="#ffe6b5" position={[4, 6, -6]} scale={3} target={[0, 0, 0]} />
      {/* Bodenaufheller: Flächen, die zum Spieler zeigen, spiegeln steil nach unten – ohne ihn wirken sie schwarz */}
      <Lightformer form="rect" intensity={0.75} color="#ffe2b0" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[40, 40, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffe0a8" position={[0, -2.5, 10]} rotation-y={Math.PI} scale={[22, 5, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#e8eeff" position={[0, -2.5, -10]} scale={[22, 5, 1]} />
    </Environment>
  );
}

/**
 * Haupt- und Gegenlicht (samt Raumlicht) drehen mit dem Spieler: Schwarz sieht seine Figuren genauso beleuchtet
 * wie Weiß (Hauptlicht von vorn-links). Sonst läge Schwarz im Gegenlicht und seine Figuren wären kaum zu erkennen.
 */
function LightRig({ shadows, shadowMap, k }: { shadows: boolean; shadowMap: number; k: number }) {
  const group = useRef<THREE.Group>(null!);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const target = useGame((s) => (s.viewSide === 'w' ? 0 : Math.PI));
  const angle = useRef(target);
  useFrame((_, dt) => {
    if (angle.current === target) return;
    const next = THREE.MathUtils.damp(angle.current, target, 5, Math.min(dt, 0.1));
    angle.current = Math.abs(next - target) < 0.002 ? target : next;
    group.current.rotation.y = angle.current;
    scene.environmentRotation.y = angle.current;
    scene.backgroundRotation.y = angle.current;
    if (shadows) gl.shadowMap.needsUpdate = true;
  });
  return (
    <group ref={group}>
      <directionalLight
        castShadow={shadows}
        position={[-5, 13, 7]}
        intensity={2.1 * k}
        color="#fff3dd"
        shadow-mapSize={[shadowMap || 512, shadowMap || 512]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={2}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      />
      <directionalLight position={[6, 4, -8]} intensity={0.6 * k} color="#a9c4ff" />
    </group>
  );
}

/** Meldet, dass das Raumlicht geladen ist (steht in derselben Suspense-Grenze wie die Umgebung) */
function Loaded({ onLoaded }: { onLoaded: () => void }) {
  useEffect(onLoaded, [onLoaded]);
  return null;
}

/**
 * Sanfter Start: erst alles laden (Figuren, Texturen, Raumlicht), dann alle Shader in einem Rutsch übersetzen –
 * im Hintergrund (KHR_parallel_shader_compile), ohne den Hauptthread zu blockieren. Bis dahin zeichnet die Szene
 * nichts; das Menü bleibt bedienbar. Früher kamen mehrere Übersetzungswellen nacheinander (je nachgeladenem Teil),
 * jede legte das Spiel für Sekunden lahm.
 */
function Warmup({ envReady, style, post, onReady }: { envReady: boolean; style: string; post: boolean; onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const done = useRef(false);
  useEffect(() => {
    if (!envReady || done.current) return;
    let alive = true;
    const finish = () => {
      if (!alive || done.current) return;
      done.current = true;
      onReady();
    };
    // Sicherheitsnetz: nach 12 s auf jeden Fall zeichnen
    const fallback = setTimeout(finish, 12_000);
    const assets: Promise<unknown>[] = style === 'rebell' ? [] : [loadModelPieces()];
    if (style === 'real') assets.push(loadRealAssets());
    Promise.allSettled(assets)
      // React baut die geladenen Teile erst im nächsten Durchlauf in die Szene ein
      .then(() => new Promise((r) => setTimeout(r, 120)))
      .then(() => {
        // Mit Bildeffekten zeichnet die Szene in einen Zwischenpuffer – andere Shader-Varianten (ohne Tonwert-
        // anpassung, linearer Farbraum). Beide Varianten übersetzen, sonst kommt die zweite Welle beim ersten Bild.
        const jobs = [gl.compileAsync(scene, camera)];
        if (post) {
          const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
          const previous = gl.getRenderTarget();
          gl.setRenderTarget(target);
          jobs.push(gl.compileAsync(scene, camera));
          gl.setRenderTarget(previous);
          void jobs[1].finally(() => target.dispose());
        }
        return Promise.all(jobs);
      })
      .catch(() => undefined)
      .then(finish);
    return () => {
      alive = false;
      clearTimeout(fallback);
    };
  }, [envReady, style, post, gl, scene, camera, onReady]);
  return null;
}

/** Nur im Dev-Modus: Renderer für Messungen in der Browser-Konsole erreichbar. */
function DevProbe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  // advance: einzelne Bilder von Hand rechnen (Prüfungen in Umgebungen, die requestAnimationFrame drosseln)
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    (window as unknown as { __r3f?: unknown }).__r3f = { gl, scene, advance };
  }, [gl, scene, advance]);
  return null;
}

export function ChessScene({ sidebar, topInset, bottomInset }: { sidebar: number; topInset: number; bottomInset: number }) {
  const graphics = useGame((s) => s.prefs.graphics);
  const battle = useGame((s) => s.prefs.battleMode !== 'off');
  const realStyle = useGame((s) => s.prefs.pieceStyle === 'real');
  const theme = useGame((s) => (s.prefs.pieceStyle === 'rebell' ? 'rebell' : 'classic'));
  const background = realStyle ? '#2a2420' : PALETTES[theme].background;
  // Farbige Stile (Smaragd, Rot) sind helle Flächen statt Gold und Onyx: weniger Licht, sonst wäscht alles aus
  const k = realStyle ? 1 : 0.42;
  const q = QUALITY[graphics];
  const shadows = q.shadowMap > 0;
  const style = useGame((s) => s.prefs.pieceStyle);
  // Bereit = Shader übersetzt; Raumlicht (nur Stil „Echt“ lädt eine Datei) muss dafür geladen sein
  const [ready, setReady] = useState(false);
  const [envReady, setEnvReady] = useState(!realStyle);
  const onEnv = useRef(() => setEnvReady(true)).current;
  const onReady = useRef(() => setReady(true)).current;

  return (
    <Canvas
      key={graphics}
      className={`scene-canvas${ready ? ' ready' : ''}`}
      shadows={shadows ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={q.dpr}
      frameloop={ready ? 'demand' : 'never'}
      camera={{ fov: FOV, position: [0, 16, 16], near: 0.1, far: 160 }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <color attach="background" args={[background]} />
      {!realStyle && <fog attach="fog" args={[background, 22, 55]} />}
      {q.soft && <SoftShadows size={22} samples={12} focus={0.7} />}
      <ambientLight intensity={0.22 * k} />
      <hemisphereLight args={['#fff4dc', '#08090c', 0.35 * k]} />
      <LightRig shadows={shadows} shadowMap={q.shadowMap} k={k} />
      <spotLight position={[0, 13, 0]} angle={0.55} penumbra={0.9} intensity={1.4 * k} decay={0} color="#ffe2ad" />
      <Suspense fallback={null}>
        {realStyle ? (
          // Echtes Raumlicht (Wohnraum mit Fenstern), unscharf im Hintergrund
          <>
            <Environment
              files={assetUrl(ENV_FILE)}
              background
              backgroundBlurriness={0.55}
              backgroundIntensity={0.55}
              environmentIntensity={0.95}
            />
            <Loaded onLoaded={onEnv} />
          </>
        ) : (
          <StudioEnvironment intensity={k} />
        )}
      </Suspense>
      <CameraRig sidebar={sidebar} topInset={topInset} bottomInset={bottomInset} />
      <DragController />
      <ShakeGroup enabled={battle}>
        <Board />
        <Pieces />
        <Highlights />
        <BattleStage />
        <ImpactFX />
      </ShakeGroup>
      {q.dust > 0 && !realStyle && <GoldDust count={q.dust} />}
      {q.post && <PostEffects />}
      <FrameDriver idleFps={q.idleFps} />
      {shadows && <ShadowUpdater />}
      <AdaptiveResolution min={q.dpr[0]} max={q.dpr[1]} />
      {!ready && <Warmup envReady={envReady || !realStyle} style={style} post={q.post} onReady={onReady} />}
      {import.meta.env.DEV && <DevProbe />}
    </Canvas>
  );
}
