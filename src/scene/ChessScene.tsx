import { Environment, Lightformer, SoftShadows } from '@react-three/drei';
import { assetUrl, ENV_FILE } from './realAssets';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
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
  const k = realStyle ? 1 : 0.5;
  const q = QUALITY[graphics];
  const shadows = q.shadowMap > 0;

  return (
    <Canvas
      key={graphics}
      className="scene-canvas"
      shadows={shadows ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={q.dpr}
      frameloop="demand"
      camera={{ fov: FOV, position: [0, 16, 16], near: 0.1, far: 160 }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <color attach="background" args={[background]} />
      {!realStyle && <fog attach="fog" args={[background, 22, 55]} />}
      {q.soft && <SoftShadows size={22} samples={12} focus={0.7} />}
      <ambientLight intensity={0.22 * k} />
      <hemisphereLight args={['#fff4dc', '#08090c', 0.35 * k]} />
      <directionalLight
        castShadow={shadows}
        position={[-5, 13, 7]}
        intensity={2.1 * k}
        color="#fff3dd"
        shadow-mapSize={[q.shadowMap || 512, q.shadowMap || 512]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={2}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      />
      <spotLight position={[0, 13, 0]} angle={0.55} penumbra={0.9} intensity={1.4 * k} decay={0} color="#ffe2ad" />
      <directionalLight position={[6, 4, -8]} intensity={0.6 * k} color="#a9c4ff" />
      <Suspense fallback={null}>
        {realStyle ? (
          // Echtes Raumlicht (Wohnraum mit Fenstern), unscharf im Hintergrund
          <Environment
            files={assetUrl(ENV_FILE)}
            background
            backgroundBlurriness={0.55}
            backgroundIntensity={0.55}
            environmentIntensity={0.95}
          />
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
      {import.meta.env.DEV && <DevProbe />}
    </Canvas>
  );
}
