import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Leuchtende Spur hinter der Klinge: merkt sich die letzten Positionen von Griff und Spitze und spannt dazwischen
 * ein Band auf. Je schneller die Klinge, desto heller – ruhige Bewegungen hinterlassen fast nichts.
 */
const SAMPLES = 18;

export interface Blade {
  bone: THREE.Object3D;
  /** Griff und Spitze im Raum des Handknochens */
  base: THREE.Vector3;
  tip: THREE.Vector3;
}

/**
 * Sucht die Klinge: den Teil der Figur, der ganz an der rechten Hand hängt, und darin den Punkt,
 * der am weitesten von der Hand entfernt ist (Ruhepose). Null, wenn die Figur keine Waffe trägt.
 */
export function findBlade(model: THREE.Object3D): Blade | null {
  let hand: THREE.Bone | null = null;
  model.traverse((o) => {
    if (!hand && o instanceof THREE.Bone && /righthand$/i.test(o.name.replace(/[^a-z]/gi, ''))) hand = o;
  });
  if (!hand) return null;
  const bone: THREE.Bone = hand;
  let best = new THREE.Vector3();
  let bestDist = 0;
  const v = new THREE.Vector3();
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const index = o.skeleton.bones.indexOf(bone);
    if (index < 0) return;
    const inverse = o.skeleton.boneInverses[index];
    const pos = o.geometry.getAttribute('position');
    const si = o.geometry.getAttribute('skinIndex');
    const sw = o.geometry.getAttribute('skinWeight');
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === index) w += sw.getComponent(i, k);
      if (w < 0.95) continue;
      // Ruhepose: Punkt im Raum der Figur → Raum des Handknochens
      v.fromBufferAttribute(pos, i).applyMatrix4(o.bindMatrix).applyMatrix4(inverse);
      const d = v.length();
      if (d > bestDist) {
        bestDist = d;
        best = v.clone();
      }
    }
  });
  // Nur echte Klingen (deutlich länger als eine Hand)
  if (bestDist < 0.35) return null;
  return { bone, base: best.clone().multiplyScalar(0.22), tip: best };
}

export function WeaponTrail({ blade, color, active }: { blade: Blade; color: string; active: () => boolean }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SAMPLES * 2 * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SAMPLES * 2 * 3), 3));
    const index: number[] = [];
    for (let i = 0; i < SAMPLES - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(index);
    return g;
  }, []);
  const history = useMemo(() => Array.from({ length: SAMPLES }, () => ({ base: new THREE.Vector3(), tip: new THREE.Vector3(), speed: 0 })), []);
  const tint = useMemo(() => new THREE.Color(color), [color]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, dt) => {
    const m = blade.bone.matrixWorld;
    const last = history[history.length - 1];
    const oldest = history.shift()!;
    oldest.base.copy(blade.base).applyMatrix4(m);
    oldest.tip.copy(blade.tip).applyMatrix4(m);
    // Tempo der Spitze in Feldern pro Sekunde
    // Nur beim Zuschlagen leuchten, nicht beim Stürzen oder Abwehren
    oldest.speed = dt > 0 && active() ? oldest.tip.distanceTo(last.tip) / dt : 0;
    history.push(oldest);
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = geometry.getAttribute('color') as THREE.BufferAttribute;
    history.forEach((h, i) => {
      pos.setXYZ(i * 2, h.base.x, h.base.y, h.base.z);
      pos.setXYZ(i * 2 + 1, h.tip.x, h.tip.y, h.tip.z);
      const age = i / (SAMPLES - 1);
      const bright = Math.min(1, Math.max(0, (h.speed - 2.2) / 5)) * age * age;
      col.setXYZ(i * 2, tint.r * bright * 0.25, tint.g * bright * 0.25, tint.b * bright * 0.25);
      col.setXYZ(i * 2 + 1, tint.r * bright, tint.g * bright, tint.b * bright);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={8} raycast={() => null}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}
