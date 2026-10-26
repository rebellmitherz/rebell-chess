import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { playBattleSfx, playSfx } from '../audio/sound';
import type { Color } from '../core/types';
import { gameStore, useGame } from '../game/instance';
import type { BattleState } from '../game/store';
import {
  actorPosition,
  appearScale,
  planBattle,
  shotAt,
  shotView,
  timeScale,
  victimSink,
  type Actor,
  type CinematicView,
  type FxCue,
} from './battleScript';
import { squareToWorld } from './boardMath';
import { FOV, LETTERBOX } from './CameraRig';
import { Burst, getSprite } from './Effects';
import { emitImpact } from './ImpactFX';
import { activity, markActive, sceneHandles } from './interaction';
import { MOVE_LIBRARY, useWarriors, type Warriors } from './warriors';
import { WeaponTrail } from './WeaponTrail';

/** Gemeinsam mit den Figuren: ab der Rückverwandlung darf die siegreiche Schachfigur wieder erscheinen */
export const battleRuntime = { reveal: false };

/** Zuletzt gespielte Szenarien – der nächste Kampf soll anders aussehen */
const recentScenarios: string[] = [];

interface Rig {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  current: THREE.AnimationAction | null;
}

// Es kämpft immer genau ein weißer gegen einen schwarzen Krieger – je Farbe genügt eine Instanz
const rigs = new WeakMap<THREE.Object3D, Rig>();

function rigFor(model: THREE.Object3D): Rig {
  let rig = rigs.get(model);
  if (!rig) {
    rig = { root: model, mixer: new THREE.AnimationMixer(model), actions: new Map(), current: null };
    rigs.set(model, rig);
  }
  return rig;
}

function play(rig: Rig, warriors: Warriors, name: string, speed: number, loop: boolean, fade: number) {
  const clip = warriors.clips.get(name);
  if (!clip) return;
  let next = rig.actions.get(name);
  if (!next) {
    next = rig.mixer.clipAction(clip);
    rig.actions.set(name, next);
  }
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
/** Langsame Kreisfahrt der Kamera innerhalb einer Einstellung (rad/s) */
const ORBIT_SPEED = 0.09;

interface BurstFx {
  id: number;
  x: number;
  y: number;
  z: number;
  color: string;
  count: number;
}

let burstId = 0;

/** Kamera um den Blickpunkt drehen (langsame Kreisfahrt) */
function orbit(view: CinematicView, angle: number): CinematicView {
  const [tx, , tz] = view.target;
  const dx = view.position[0] - tx;
  const dz = view.position[2] - tz;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { target: view.target, position: [tx + dx * c - dz * s, view.position[1], tz + dx * s + dz * c] };
}

function Fight({ battle, warriors }: { battle: BattleState; warriors: Warriors }) {
  const size = useThree((s) => s.size);
  const viewSide = useMemo(() => gameStore.getState().viewSide, []);
  const plan = useMemo(
    () =>
      planBattle(battle, {
        library: { w: MOVE_LIBRARY, b: MOVE_LIBRARY },
        seed: (Math.random() * 2 ** 31) | 0,
        avoid: recentScenarios.slice(-2),
      }),
    [battle],
  );
  const rigA = rigFor(warriors.models[battle.attacker.color]);
  const rigV = rigFor(warriors.models[battle.victim.color]);
  const groupA = useRef<THREE.Group>(null!);
  const groupV = useRef<THREE.Group>(null!);
  const auraA = useRef<THREE.Mesh>(null!);
  const auraV = useRef<THREE.Mesh>(null!);
  const state = useRef({ t: 0, cueA: 0, cueV: 0, fx: 0, shot: -1, done: false });
  /** Rolle der gerade laufenden Bewegung je Krieger (für die Schwertspur) */
  const roles = useRef<Record<Actor, string>>({ a: '', v: '' });
  const [bursts, setBursts] = useState<BurstFx[]>([]);
  const cuesA = useMemo(() => plan.cues.filter((c) => c.actor === 'a'), [plan]);
  const cuesV = useMemo(() => plan.cues.filter((c) => c.actor === 'v'), [plan]);
  const [toX, toZ] = squareToWorld(battle.to);

  useEffect(() => {
    recentScenarios.push(plan.scenario);
    if (recentScenarios.length > 4) recentScenarios.shift();
    // Nur im Dev-Modus: Drehbuch für Prüfungen in der Browser-Konsole
    if (import.meta.env.DEV) (window as unknown as { __battlePlan?: unknown }).__battlePlan = plan;
  }, [plan]);

  useEffect(() => {
    battleRuntime.reveal = false;
    for (const rig of [rigA, rigV]) {
      rig.mixer.stopAllAction();
      rig.current = null;
    }
    void sceneHandles.controls?.setFocalOffset(0, 0, 0, true);
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
    const [ax, az] = actorPosition(plan, 'a', t);
    const [vx, vz] = actorPosition(plan, 'v', t);
    const [dx, dz] = plan.dir;
    const mx = (ax + vx) / 2;
    const mz = (az + vz) / 2;
    const victimColor = battle.victim.color;
    const [px, pz] = cue.at === 'a' ? [ax, az] : cue.at === 'v' ? [vx, vz] : [mx, mz];
    const sound = gameStore.getState().prefs.sound;
    if (sound && !(cue.kind === 'transform' && cue.at === 'v')) playBattleSfx(cue.kind);
    switch (cue.kind) {
      case 'transform':
        addBurst(px, 0.35, pz, '#f4ead6', 46);
        break;
      case 'clash':
      case 'block':
        addBurst(mx, 0.78, mz, SPARK, 38);
        emitImpact({ x: mx, z: mz, dirX: dx, dirZ: dz, victim: victimColor, power: 0.5, ring: false, burst: false });
        break;
      case 'hit':
        addBurst(px, 0.62, pz, DUST, 30);
        emitImpact({ x: px, z: pz, dirX: dx, dirZ: dz, victim: victimColor, power: 0.75, ring: false, burst: false });
        break;
      case 'death':
        addBurst(px, 0.7, pz, SPARK, 64);
        emitImpact({ x: px, z: pz, dirX: dx, dirZ: dz, victim: victimColor, power: 1.25, ring: false, burst: false });
        break;
      case 'fall':
        addBurst(px, 0.08, pz, DUST, 44);
        emitImpact({ x: px, z: pz, dirX: dx, dirZ: dz, victim: victimColor, power: 0.55, ring: false, burst: false });
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
    // nach einem Tab-Wechsel nicht springen; Zeitlupe und kurzes Anhalten bei Treffern
    const step = Math.min(dt, 1 / 20) * timeScale(plan, s.t);
    s.t += step;
    const t = s.t;
    markActive(400);
    activity.shadowsUntil = performance.now() + 300;

    while (s.cueA < cuesA.length && cuesA[s.cueA].t <= t) {
      const c = cuesA[s.cueA++];
      roles.current.a = c.role;
      play(rigA, warriors, c.clip, c.speed, c.loop, c.fade);
    }
    while (s.cueV < cuesV.length && cuesV[s.cueV].t <= t) {
      const c = cuesV[s.cueV++];
      roles.current.v = c.role;
      play(rigV, warriors, c.clip, c.speed, c.loop, c.fade);
    }
    while (s.fx < plan.fx.length && plan.fx[s.fx].t <= t) trigger(plan.fx[s.fx++], t);
    rigA.mixer.update(step);
    rigV.mixer.update(step);

    // Kamera: Schnitt oder Fahrt in die nächste Einstellung, dabei langsam kreisen und den Kämpfern folgen
    const controls = sceneHandles.controls;
    if (controls && t < plan.outro) {
      const { shot, index } = shotAt(plan, t);
      const opts = { aspect: size.width / size.height, fov: FOV, viewSide, usableHeight: 1 - 2 * LETTERBOX };
      const view = orbit(shotView(plan, shot.kind, t, opts), ORBIT_SPEED * (t - shot.t));
      const jump = index !== s.shot && shot.cut;
      s.shot = index;
      void controls.setLookAt(...view.position, ...view.target, !jump);
    }

    const [dx, dz] = plan.dir;
    const [ax, az] = actorPosition(plan, 'a', t);
    const [vx, vz] = actorPosition(plan, 'v', t);
    const sa = appearScale(plan, 'a', t);
    const sv = appearScale(plan, 'v', t);
    groupA.current.position.set(ax, 0, az);
    groupA.current.rotation.y = Math.atan2(dx, dz);
    const sA = Math.max(0.001, plan.scale.a * sa);
    groupA.current.scale.set(plan.mirror.a ? -sA : sA, sA, sA);
    groupV.current.position.set(vx, victimSink(plan, t), vz);
    groupV.current.rotation.y = Math.atan2(-dx, -dz);
    const sV = Math.max(0.001, plan.scale.v * sv);
    groupV.current.scale.set(plan.mirror.v ? -sV : sV, sV, sV);
    auraA.current.position.set(ax, 0.012, az);
    auraV.current.position.set(vx, 0.012, vz);
    (auraA.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * sa;
    const dead = Math.min(1, Math.max(0, (t - plan.deathAt) / 0.6));
    (auraV.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * sv * (1 - dead);

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
      {(['a', 'v'] as Actor[]).map((actor) => {
        const color = actor === 'a' ? battle.attacker.color : battle.victim.color;
        const blade = warriors.blades[color];
        const attacking = () => ['attack', 'heavy', 'kick'].includes(roles.current[actor]);
        return blade && <WeaponTrail key={`trail-${actor}`} blade={blade} color={AURA[color]} active={attacking} />;
      })}
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
  const warriors = useWarriors(mode === 'warriors' || mode === 'always');

  useEffect(() => {
    if (!battle || warriors) return;
    const s = gameStore.getState();
    s.endBattle();
    if (s.prefs.sound) playSfx('strike');
  }, [battle, warriors]);

  if (!battle || !warriors) return null;
  return <Fight key={battle.id} battle={battle} warriors={warriors} />;
}
