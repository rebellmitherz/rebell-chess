import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { playBattleSfx, playSfx } from '../audio/sound';
import type { Color } from '../core/types';
import { gameStore, useGame } from '../game/instance';
import type { BattleState } from '../game/store';
import {
  appearScale,
  attackerPosition,
  deathPan,
  planBattle,
  victimPosition,
  victimSink,
  WARRIOR_CLIPS,
  type Actor,
  type BattlePlan,
  type ClipRole,
  type FxCue,
} from './battleScript';
import { squareToWorld } from './boardMath';
import { Burst, getSprite } from './Effects';
import { emitImpact } from './ImpactFX';
import { activity, markActive, sceneHandles } from './interaction';
import { useWarriors, type WarriorModel, type Warriors } from './warriors';

/** Gemeinsam mit den Figuren: ab der Rückverwandlung darf die siegreiche Schachfigur wieder erscheinen */
export const battleRuntime = { reveal: false };

interface Rig {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<ClipRole, THREE.AnimationAction>;
  current: THREE.AnimationAction | null;
}

// Es kämpft immer genau ein Ritter gegen einen Barbaren – je Modell genügt eine Instanz
const rigs = new WeakMap<WarriorModel, Rig>();

function rigFor(model: WarriorModel, color: Color): Rig {
  let rig = rigs.get(model);
  if (!rig) {
    const mixer = new THREE.AnimationMixer(model.scene);
    const actions = {} as Record<ClipRole, THREE.AnimationAction>;
    for (const role of Object.keys(WARRIOR_CLIPS[color]) as ClipRole[]) {
      const name = WARRIOR_CLIPS[color][role].name;
      const clip = model.clips.find((c) => c.name === name);
      if (!clip) throw new Error(`Animation ${name} fehlt`);
      actions[role] = mixer.clipAction(clip);
    }
    rig = { root: model.scene, mixer, actions, current: null };
    rigs.set(model, rig);
  }
  return rig;
}

function play(rig: Rig, role: ClipRole, speed: number, loop: boolean, fade: number) {
  const next = rig.actions[role];
  next.reset();
  next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  next.clampWhenFinished = !loop;
  next.setEffectiveTimeScale(speed);
  next.setEffectiveWeight(1);
  next.play();
  const prev = rig.current;
  if (prev && prev !== next) {
    if (fade > 0) prev.crossFadeTo(next, fade, false);
    else prev.stop();
  }
  rig.current = next;
}

/** Leuchtender Kreis unter einem Krieger in der Farbe seiner Seite */
const AURA: Record<Color, string> = { w: '#ffd58a', b: '#a9c2ff' };
/** Funken beim Klingenschlag, Staub bei Treffer und Sturz */
const SPARK = '#ffcf6a';
const DUST = '#d9c9ab';

interface BurstFx {
  id: number;
  x: number;
  y: number;
  z: number;
  color: string;
  count: number;
}

let burstId = 0;
/** Langsame Kreisfahrt der Kamera während des Kampfes (rad/s) */
const ORBIT_SPEED = 0.07;

/** Kurze Zeitlupe um den Todesstoß */
function slowMotion(plan: BattlePlan, t: number): number {
  const i4 = plan.impacts[3];
  if (t < i4 - 0.1 || t > i4 + 0.3) return 1;
  return 0.38;
}

function Fight({ battle, warriors }: { battle: BattleState; warriors: Warriors }) {
  const plan = useMemo(() => planBattle(battle), [battle]);
  const rigA = rigFor(warriors[battle.attacker.color], battle.attacker.color);
  const rigV = rigFor(warriors[battle.victim.color], battle.victim.color);
  const groupA = useRef<THREE.Group>(null!);
  const groupV = useRef<THREE.Group>(null!);
  const auraA = useRef<THREE.Mesh>(null!);
  const auraV = useRef<THREE.Mesh>(null!);
  const state = useRef({ t: 0, cueA: 0, cueV: 0, fx: 0, done: false, panned: false });
  const [bursts, setBursts] = useState<BurstFx[]>([]);
  const cuesA = useMemo(() => plan.cues.filter((c) => c.actor === 'a'), [plan]);
  const cuesV = useMemo(() => plan.cues.filter((c) => c.actor === 'v'), [plan]);
  const [toX, toZ] = squareToWorld(battle.to);

  useEffect(() => {
    battleRuntime.reveal = false;
    for (const rig of [rigA, rigV]) {
      rig.mixer.stopAllAction();
      rig.current = null;
    }
    return () => {
      battleRuntime.reveal = false;
      for (const rig of [rigA, rigV]) {
        rig.mixer.stopAllAction();
        rig.current = null;
      }
    };
  }, [rigA, rigV]);

  const addBurst = (x: number, y: number, z: number, color: string, count: number) => {
    const id = ++burstId;
    setBursts((all) => [...all, { id, x, y, z, color, count }]);
    setTimeout(() => setBursts((all) => all.filter((b) => b.id !== id)), 1300);
  };

  const trigger = (cue: FxCue, t: number) => {
    const [ax, az] = attackerPosition(plan, t);
    const [vx, vz] = victimPosition(plan, t);
    const [dx, dz] = plan.dir;
    const mx = (ax + vx) / 2;
    const mz = (az + vz) / 2;
    const victimColor = battle.victim.color;
    const sound = gameStore.getState().prefs.sound;
    if (sound && !(cue.kind === 'transform' && cue.at === 'v')) playBattleSfx(cue.kind);
    switch (cue.kind) {
      case 'transform':
        if (cue.at === 'a') addBurst(ax, 0.35, az, '#f4ead6', 46);
        else addBurst(vx, 0.35, vz, '#f4ead6', 46);
        break;
      case 'clash':
      case 'block':
        addBurst(mx, 0.78, mz, SPARK, 34);
        emitImpact({ x: mx, z: mz, dirX: dx, dirZ: dz, victim: victimColor, power: 0.45, ring: false, burst: false });
        break;
      case 'hit':
        addBurst(vx, 0.62, vz, DUST, 28);
        emitImpact({ x: vx, z: vz, dirX: dx, dirZ: dz, victim: victimColor, power: 0.7, ring: false, burst: false });
        break;
      case 'death':
        addBurst(vx, 0.7, vz, SPARK, 60);
        emitImpact({ x: vx, z: vz, dirX: dx, dirZ: dz, victim: victimColor, power: 1.2, ring: true, burst: false });
        break;
      case 'fall':
        addBurst(vx + dx * 0.35, 0.08, vz + dz * 0.35, DUST, 40);
        emitImpact({ x: vx, z: vz, dirX: dx, dirZ: dz, victim: victimColor, power: 0.5, ring: false, burst: false });
        break;
      case 'vanish':
        battleRuntime.reveal = true;
        addBurst(ax, 0.4, az, AURA[battle.attacker.color], 40);
        addBurst(toX, 0.3, toZ, AURA[battle.attacker.color], 30);
        break;
      default:
        break;
    }
  };

  useFrame((_, dt) => {
    const s = state.current;
    if (s.done) return;
    // nach einem Tab-Wechsel nicht springen
    const step = Math.min(dt, 1 / 20) * slowMotion(plan, s.t);
    s.t += step;
    const t = s.t;
    markActive(400);
    activity.shadowsUntil = performance.now() + 300;

    while (s.cueA < cuesA.length && cuesA[s.cueA].t <= t) {
      const c = cuesA[s.cueA++];
      play(rigA, c.role, c.speed, c.loop, c.fade);
    }
    while (s.cueV < cuesV.length && cuesV[s.cueV].t <= t) {
      const c = cuesV[s.cueV++];
      play(rigV, c.role, c.speed, c.loop, c.fade);
    }
    while (s.fx < plan.fx.length && plan.fx[s.fx].t <= t) trigger(plan.fx[s.fx++], t);
    rigA.mixer.update(step);
    rigV.mixer.update(step);

    // Kamera kreist langsam um die Kämpfer und schwenkt beim Todesstoß zum fallenden Opfer
    const controls = sceneHandles.controls;
    if (controls && t > plan.runEnd && t < plan.outro) void controls.rotate(ORBIT_SPEED * step, 0, true);
    if (controls && !s.panned && t > plan.impacts[3] + 0.05) {
      s.panned = true;
      void controls.moveTo(...deathPan(plan), true);
    }

    const [dx, dz] = plan.dir;
    const [ax, az] = attackerPosition(plan, t);
    const [vx, vz] = victimPosition(plan, t);
    const sa = appearScale(plan, 'a', t);
    const sv = appearScale(plan, 'v', t);
    groupA.current.position.set(ax, 0, az);
    groupA.current.rotation.y = Math.atan2(dx, dz);
    groupA.current.scale.setScalar(Math.max(0.001, plan.scale.a * sa));
    groupV.current.position.set(vx, victimSink(plan, t), vz);
    groupV.current.rotation.y = Math.atan2(-dx, -dz);
    groupV.current.scale.setScalar(Math.max(0.001, plan.scale.v * sv));
    auraA.current.position.set(ax, 0.012, az);
    auraV.current.position.set(vx, 0.012, vz);
    (auraA.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * sa;
    const dead = Math.min(1, Math.max(0, (t - plan.impacts[3]) / 0.6));
    (auraV.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * sv * (1 - dead);

    if (t >= plan.total) {
      s.done = true;
      const cur = gameStore.getState();
      if (cur.battle?.id === battle.id) cur.endBattle();
    }
  });

  return (
    <group>
      <group ref={groupA} scale={0.001}>
        <primitive object={rigA.root} dispose={null} />
      </group>
      <group ref={groupV} scale={0.001}>
        <primitive object={rigV.root} dispose={null} />
      </group>
      {(['a', 'v'] as Actor[]).map((actor) => (
        <mesh key={actor} ref={actor === 'a' ? auraA : auraV} rotation-x={-Math.PI / 2} renderOrder={6} raycast={() => null}>
          <circleGeometry args={[0.48, 40]} />
          <meshBasicMaterial
            map={getSprite()}
            color={AURA[actor === 'a' ? battle.attacker.color : battle.victim.color]}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      {bursts.map((b) => (
        <group key={b.id} position={[b.x, b.y, b.z]}>
          <Burst color={b.color} count={b.count} />
        </group>
      ))}
    </group>
  );
}

/**
 * Kriegerkampf nach einem Schlagzug (Einstellung „Kriegerkampf“). Lädt die Krieger vorab im Hintergrund.
 * Sind sie beim Schlagen noch nicht da, endet der Kampf sofort – die Figuren schlagen dann wie bei „Kurz“.
 */
export function BattleStage() {
  const mode = useGame((s) => s.prefs.battleMode);
  const battle = useGame((s) => s.battle);
  const warriors = useWarriors(mode === 'warriors');

  useEffect(() => {
    if (!battle || warriors) return;
    const s = gameStore.getState();
    s.endBattle();
    if (s.prefs.sound) playSfx('strike');
  }, [battle, warriors]);

  if (!battle || !warriors) return null;
  return <Fight key={battle.id} battle={battle} warriors={warriors} />;
}
