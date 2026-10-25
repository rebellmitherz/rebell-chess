import { Environment, Lightformer, SoftShadows } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { useGame } from '../game/instance';
import type { GraphicsQuality } from '../game/settings';
import { Board } from './Board';
import { CameraRig } from './CameraRig';
import { DragController } from './DragController';
import { GoldDust } from './Effects';
import { Highlights } from './Highlights';
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
function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1} background={false}>
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
  useEffect(() => {
    (window as unknown as { __r3f?: unknown }).__r3f = { gl, scene };
  }, [gl, scene]);
  return null;
}

export function ChessScene({ sidebar, topInset, bottomInset }: { sidebar: number; topInset: number; bottomInset: number }) {
  const graphics = useGame((s) => s.prefs.graphics);
  const q = QUALITY[graphics];
  const shadows = q.shadowMap > 0;

  return (
    <Canvas
      key={graphics}
      className="scene-canvas"
      shadows={shadows ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={q.dpr}
      frameloop="demand"
      camera={{ fov: 40, position: [0, 12, 12], near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <color attach="background" args={['#07080b']} />
      <fog attach="fog" args={['#07080b', 22, 55]} />
      {q.soft && <SoftShadows size={22} samples={12} focus={0.7} />}
      <ambientLight intensity={0.22} />
      <hemisphereLight args={['#fff4dc', '#08090c', 0.35]} />
      <directionalLight
        castShadow={shadows}
        position={[-5, 13, 7]}
        intensity={2.1}
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
      <spotLight position={[0, 13, 0]} angle={0.55} penumbra={0.9} intensity={1.4} decay={0} color="#ffe2ad" />
      <directionalLight position={[6, 4, -8]} intensity={0.6} color="#a9c4ff" />
      <Suspense fallback={null}>
        <StudioEnvironment />
      </Suspense>
      <CameraRig sidebar={sidebar} topInset={topInset} bottomInset={bottomInset} />
      <DragController />
      <Board />
      <Pieces />
      <Highlights />
      {q.dust > 0 && <GoldDust count={q.dust} />}
      {q.post && <PostEffects />}
      <FrameDriver idleFps={q.idleFps} />
      {shadows && <ShadowUpdater />}
      <AdaptiveResolution min={q.dpr[0]} max={q.dpr[1]} />
      {import.meta.env.DEV && <DevProbe />}
    </Canvas>
  );
}
