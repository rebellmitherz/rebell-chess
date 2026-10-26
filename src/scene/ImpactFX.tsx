import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Color } from '../core/types';
import { Burst } from './Effects';
import { markActive } from './interaction';

/** Einschlag eines Schlagzugs: Ort, Schlagrichtung, Farbe der getroffenen Figur */
export interface Impact {
  id: number;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  victim: Color;
  /** performance.now() beim Einschlag */
  at: number;
  /** Stärke von Blitz und Beben (1 = Schlagzug) */
  power: number;
  /** Druckwelle auf dem Brett */
  ring: boolean;
  /** Funkenregen */
  burst: boolean;
}

let nextId = 1;
let lastImpact: Impact | null = null;
const listeners = new Set<(impact: Impact) => void>();

type ImpactInput = Omit<Impact, 'id' | 'at' | 'power' | 'ring' | 'burst'> & Partial<Pick<Impact, 'power' | 'ring' | 'burst'>>;

export function emitImpact(impact: ImpactInput) {
  const full: Impact = { power: 1, ring: true, burst: true, ...impact, id: nextId++, at: performance.now() };
  lastImpact = full;
  markActive(1800);
  listeners.forEach((l) => l(full));
}

/** Druckwelle: goldener Ring breitet sich über das Brett aus */
function Shockwave({ impact }: { impact: Impact }) {
  const mesh = useRef<THREE.Mesh>(null!);
  const material = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(() => {
    const t = (performance.now() - impact.at) / 1000;
    const k = Math.min(1, t / 0.55);
    const s = 0.3 + (1 - Math.pow(1 - k, 3)) * 2.2;
    mesh.current.scale.set(s, s, s);
    material.current.opacity = 0.85 * (1 - k);
  });
  return (
    <mesh ref={mesh} position={[impact.x, 0.025, impact.z]} rotation-x={-Math.PI / 2} renderOrder={7}>
      <ringGeometry args={[0.42, 0.5, 64]} />
      <meshBasicMaterial
        ref={material}
        color={impact.victim === 'w' ? '#ffd27a' : '#dfe6ff'}
        transparent
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/** Ein einziges, immer vorhandenes Licht für Einschlagblitze (kein Shader-Neuaufbau durch neue Lichter) */
function FlashLight() {
  const light = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    const imp = lastImpact;
    const t = imp ? (performance.now() - imp.at) / 1000 : 99;
    if (!imp || t > 0.5) {
      light.current.intensity = 0;
      return;
    }
    light.current.position.set(imp.x, 0.9, imp.z);
    light.current.intensity = 22 * imp.power * Math.exp(-t * 9);
  });
  return <pointLight ref={light} intensity={0} distance={7} decay={2} color="#ffe2a0" />;
}

/** Kurzes Beben der Szene beim Einschlag (Kamera bleibt ruhig, damit nichts unlesbar wird) */
export function ShakeGroup({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const group = useRef<THREE.Group>(null!);
  useFrame(() => {
    const imp = lastImpact;
    const t = imp ? (performance.now() - imp.at) / 1000 : 99;
    if (!enabled || t > 0.35) {
      group.current.position.set(0, 0, 0);
      return;
    }
    const a = 0.055 * imp!.power * Math.exp(-t * 11);
    group.current.position.set(
      Math.sin(t * 95) * a + imp!.dirX * a * 0.6,
      Math.abs(Math.sin(t * 70)) * a * 0.4,
      Math.cos(t * 83) * a + imp!.dirZ * a * 0.6,
    );
  });
  return <group ref={group}>{children}</group>;
}

/** Alle laufenden Einschlag-Effekte */
export function ImpactFX() {
  const [impacts, setImpacts] = useState<Impact[]>([]);
  useEffect(() => {
    const onImpact = (impact: Impact) => {
      setImpacts((all) => [...all, impact]);
      setTimeout(() => setImpacts((all) => all.filter((i) => i.id !== impact.id)), 1300);
    };
    listeners.add(onImpact);
    return () => {
      listeners.delete(onImpact);
    };
  }, []);
  return (
    <>
      <FlashLight />
      {impacts.map((imp) => (
        <group key={imp.id}>
          {imp.ring && <Shockwave impact={imp} />}
          {imp.burst && (
            <group position={[imp.x, 0.35, imp.z]}>
              <Burst color={imp.victim === 'w' ? '#ffd27a' : '#e4ebff'} count={80} />
            </group>
          )}
        </group>
      ))}
    </>
  );
}
