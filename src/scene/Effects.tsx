import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

let spriteTexture: THREE.Texture | null = null;

/** Weiches, rundes Partikel-Sprite (zur Laufzeit gezeichnet). */
function getSprite(): THREE.Texture {
  if (spriteTexture) return spriteTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  spriteTexture = new THREE.CanvasTexture(c);
  return spriteTexture;
}

/** Feiner Goldstaub rund um das Brett – bewusst außerhalb der Spielfläche, damit nichts verdeckt wird. */
export function GoldDust({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null!);
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 6.2 + Math.random() * 9;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = -0.4 + Math.random() * 5.5;
      pos[i * 3 + 2] = Math.sin(a) * r;
      phase[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    return g;
  }, [count]);
  const base = useMemo(() => (geometry.attributes.position.array as Float32Array).slice(), [geometry]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const phase = geometry.attributes.phase.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, base[i * 3 + 1] + Math.sin(t * 0.35 + phase[i]) * 0.25);
    }
    pos.needsUpdate = true;
    points.current.rotation.y = t * 0.012;
  });

  if (count === 0) return null;
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        map={getSprite()}
        color="#f3cf7d"
        size={0.07}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

/** Kurzer Funkenregen (Schlagzug, Umwandlung). Lebt ca. eine Sekunde. */
export function Burst({ color, count = 36 }: { color: string; count?: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  const velocities = useMemo(() => {
    const v = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.6 + Math.random() * 1.4;
      v[i * 3] = Math.cos(a) * s;
      v[i * 3 + 1] = 1.6 + Math.random() * 2.2;
      v[i * 3 + 2] = Math.sin(a) * s;
    }
    return v;
  }, [count]);
  const material = useRef<THREE.PointsMaterial>(null!);
  const age = useRef(0);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, dt) => {
    age.current += dt;
    const t = age.current;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      pos.setXYZ(
        i,
        velocities[i * 3] * t * 0.45,
        0.25 + velocities[i * 3 + 1] * t - 2.6 * t * t,
        velocities[i * 3 + 2] * t * 0.45,
      );
    }
    pos.needsUpdate = true;
    material.current.opacity = Math.max(0, 1 - t / 0.95);
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={material}
        map={getSprite()}
        color={color}
        size={0.09}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
