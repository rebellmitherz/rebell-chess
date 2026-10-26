import type { Color, PieceSymbol, Square } from '../core/types';
import { squareToWorld } from './boardMath';

/**
 * Drehbuch eines Kriegerkampfs als reine Funktionen (ohne three.js, testbar):
 * Verwandlung → Anlauf → Hieb gegen Abwehr → Konter gegen Abwehr → Treffer → Todesstoß → Jubel → Rückverwandlung.
 * Alle Zeiten in Sekunden ab Kampfbeginn, Positionen in Weltmaß (ein Feld = 1).
 */

export type ClipRole = 'idle' | 'run' | 'attack1' | 'attack2' | 'finisher' | 'block' | 'blockHit' | 'hit' | 'death' | 'cheer';

interface ClipInfo {
  name: string;
  /** Treffermoment im Clip (s) – schnellste bzw. weiteste Bewegung der Waffenspitze, aus den Animationsdaten gemessen */
  impact?: number;
}

/** Weiß kämpft als Ritter (Schwert + Schild), Schwarz als Barbar (Zweihandaxt) */
export const WARRIOR_CLIPS: Record<Color, Record<ClipRole, ClipInfo>> = {
  w: {
    idle: { name: 'Idle' },
    run: { name: 'Running_A' },
    attack1: { name: '1H_Melee_Attack_Chop', impact: 0.64 },
    attack2: { name: '1H_Melee_Attack_Slice_Diagonal', impact: 0.41 },
    finisher: { name: '1H_Melee_Attack_Stab', impact: 0.7 },
    block: { name: 'Block' },
    blockHit: { name: 'Block_Hit' },
    hit: { name: 'Hit_A' },
    death: { name: 'Death_A' },
    cheer: { name: 'Cheer' },
  },
  b: {
    idle: { name: '2H_Melee_Idle' },
    run: { name: 'Running_A' },
    attack1: { name: '2H_Melee_Attack_Chop', impact: 0.83 },
    attack2: { name: '2H_Melee_Attack_Slice', impact: 0.41 },
    finisher: { name: '2H_Melee_Attack_Spin', impact: 1.22 },
    block: { name: 'Block' },
    blockHit: { name: 'Block_Hit' },
    hit: { name: 'Hit_A' },
    death: { name: 'Death_A' },
    cheer: { name: 'Cheer' },
  },
};

/** Grundgröße auf dem Brett: ein Krieger ist etwa so hoch wie ein König */
export const WARRIOR_SCALE = 0.56;
/** Größere Figuren werden zu größeren Kriegern */
const TYPE_SCALE: Record<PieceSymbol, number> = { p: 0.88, n: 0.96, b: 0.96, r: 1, q: 1.04, k: 1.08 };
/** Abstand der Kämpfer – die Klingen erreichen den Gegner knapp */
export const FIGHT_DISTANCE = 1.02;
const RUN_SPEED = 2.6;
/** Dauer der Verwandlung (Figur → Krieger) */
export const APPEAR = 0.32;
/** Dauer der Rückverwandlung */
export const VANISH = 0.42;

export type Actor = 'a' | 'v';
export type Vec2 = [number, number];

export interface ActorCue {
  t: number;
  actor: Actor;
  role: ClipRole;
  /** Abspieltempo des Clips */
  speed: number;
  loop: boolean;
  /** Überblendzeit vom vorigen Clip */
  fade: number;
}

export type BattleFxKind = 'transform' | 'step' | 'swing' | 'clash' | 'block' | 'hit' | 'death' | 'fall' | 'cheer' | 'vanish';

export interface FxCue {
  t: number;
  kind: BattleFxKind;
  /** Wo es passiert: beim Angreifer, beim Opfer oder zwischen beiden */
  at: Actor | 'mid';
}

export interface BattleInput {
  from: Square;
  victimSquare: Square;
  attacker: { color: Color; type: PieceSymbol };
  victim: { color: Color; type: PieceSymbol };
}

export interface BattlePlan {
  start: Vec2;
  /** Standplatz des Angreifers im Kampf */
  stop: Vec2;
  victim: Vec2;
  /** Mitte zwischen den Kämpfern */
  mid: Vec2;
  /** Einheitsvektor Angreifer → Opfer */
  dir: Vec2;
  runStart: number;
  runEnd: number;
  /** Treffer: Hieb (abgewehrt), Konter (abgewehrt), Treffer, Todesstoß */
  impacts: [number, number, number, number];
  cues: ActorCue[];
  fx: FxCue[];
  /** Opfer versinkt im Brett */
  sink: number;
  /** Rückverwandlung beginnt */
  outro: number;
  total: number;
  scale: Record<Actor, number>;
  colors: Record<Actor, Color>;
}

const impactOf = (color: Color, role: ClipRole) => WARRIOR_CLIPS[color][role].impact ?? 0.5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (k: number) => k * k * (3 - 2 * k);

export function planBattle(input: BattleInput): BattlePlan {
  const [sx, sz] = squareToWorld(input.from);
  const [vx, vz] = squareToWorld(input.victimSquare);
  const dist = Math.hypot(vx - sx, vz - sz) || 1;
  const dir: Vec2 = [(vx - sx) / dist, (vz - sz) / dist];
  const runDist = Math.max(0, dist - FIGHT_DISTANCE);
  const stop: Vec2 = [sx + dir[0] * runDist, sz + dir[1] * runDist];
  const a = input.attacker.color;
  const v = input.victim.color;
  const cues: ActorCue[] = [];
  const fx: FxCue[] = [];
  const cue = (t: number, actor: Actor, role: ClipRole, speed = 1, fade = 0.14, loop = false) =>
    cues.push({ t, actor, role, speed, loop, fade });

  // Verwandlung: beide Figuren werden zu Kriegern
  cue(0, 'a', 'idle', 1, 0, true);
  cue(0, 'v', 'idle', 1, 0, true);
  fx.push({ t: 0, kind: 'transform', at: 'a' }, { t: 0.04, kind: 'transform', at: 'v' });

  // Anlauf (weite Wege schneller, damit kein Kampf zu lange dauert)
  let runStart = APPEAR;
  let runEnd = APPEAR;
  if (runDist > 0.12) {
    runStart = APPEAR + 0.04;
    const duration = clamp(runDist / RUN_SPEED, 0.28, 1.05);
    runEnd = runStart + duration;
    cue(runStart, 'a', 'run', clamp(runDist / duration / RUN_SPEED, 0.9, 1.8), 0.1, true);
    for (let t = runStart + 0.08; t < runEnd - 0.05; t += 0.19) fx.push({ t, kind: 'step', at: 'a' });
  }

  // Wer einen Schild trägt (Ritter), wehrt damit ab – der Barbar pariert mit der Axt
  const guard = (c: Color): BattleFxKind => (c === 'w' ? 'block' : 'clash');

  // 1. Hieb – das Opfer wehrt ab
  const c1 = runEnd + 0.02;
  const s1 = 1.3;
  const i1 = c1 + impactOf(a, 'attack1') / s1;
  cue(c1, 'a', 'attack1', s1, 0.12);
  cue(i1 - 0.3, 'v', 'block', 1.25, 0.12);
  cue(i1, 'v', 'blockHit', 1.35, 0.06);
  fx.push({ t: i1 - 0.16, kind: 'swing', at: 'a' }, { t: i1, kind: guard(v), at: 'mid' });

  // 2. Konter – der Angreifer wehrt ab
  const c2 = i1 + 0.26;
  const s2 = 1.35;
  const i2 = c2 + impactOf(v, 'attack2') / s2;
  cue(c2, 'v', 'attack2', s2, 0.12);
  cue(i2 - 0.28, 'a', 'block', 1.25, 0.12);
  cue(i2, 'a', 'blockHit', 1.35, 0.06);
  fx.push({ t: i2 - 0.15, kind: 'swing', at: 'v' }, { t: i2, kind: guard(a), at: 'mid' });

  // 3. Treffer
  const c3 = i2 + 0.24;
  const s3 = 1.35;
  const i3 = c3 + impactOf(a, 'attack2') / s3;
  cue(c3, 'a', 'attack2', s3, 0.12);
  cue(i3, 'v', 'hit', 1.15, 0.06);
  fx.push({ t: i3 - 0.15, kind: 'swing', at: 'a' }, { t: i3, kind: 'hit', at: 'v' });

  // 4. Todesstoß
  const c4 = i3 + 0.28;
  const s4 = a === 'b' ? 1.45 : 1.3;
  const i4 = c4 + impactOf(a, 'finisher') / s4;
  cue(c4, 'a', 'finisher', s4, 0.12);
  cue(i4, 'v', 'death', 1, 0.08);
  fx.push(
    { t: i4 - 0.17, kind: 'swing', at: 'a' },
    { t: i4, kind: 'death', at: 'v' },
    { t: i4 + 0.52, kind: 'fall', at: 'v' },
  );

  // Jubel, dann Rückverwandlung
  cue(i4 + 0.5, 'a', 'cheer', 1.15, 0.22);
  fx.push({ t: i4 + 0.62, kind: 'cheer', at: 'a' });
  const sink = i4 + 0.95;
  const outro = i4 + 1.4;
  fx.push({ t: outro, kind: 'vanish', at: 'a' });

  return {
    start: [sx, sz],
    stop,
    victim: [vx, vz],
    mid: [(stop[0] + vx) / 2, (stop[1] + vz) / 2],
    dir,
    runStart,
    runEnd,
    impacts: [i1, i2, i3, i4],
    cues: cues.sort((x, y) => x.t - y.t),
    fx: fx.sort((x, y) => x.t - y.t),
    sink,
    outro,
    total: outro + VANISH,
    scale: { a: WARRIOR_SCALE * TYPE_SCALE[input.attacker.type], v: WARRIOR_SCALE * TYPE_SCALE[input.victim.type] },
    colors: { a, v },
  };
}

/** Position des Angreifers (Anlauf mit weichem Start und Abbremsen) */
export function attackerPosition(plan: BattlePlan, t: number): Vec2 {
  if (plan.runEnd <= plan.runStart) return plan.stop;
  const k = clamp((t - plan.runStart) / (plan.runEnd - plan.runStart), 0, 1);
  // fast gleichmäßig laufen, nur Anfang und Ende weich
  const e = 0.12 * smooth(k) + 0.88 * k;
  return [plan.start[0] + (plan.stop[0] - plan.start[0]) * e, plan.start[1] + (plan.stop[1] - plan.start[1]) * e];
}

/** Position des Opfers: wird vom Treffer und vom Todesstoß ein Stück zurückgestoßen */
export function victimPosition(plan: BattlePlan, t: number): Vec2 {
  const [, , i3, i4] = plan.impacts;
  const knock = 0.07 * smooth(clamp((t - i3) / 0.22, 0, 1)) + 0.12 * smooth(clamp((t - i4) / 0.35, 0, 1));
  return [plan.victim[0] + plan.dir[0] * knock, plan.victim[1] + plan.dir[1] * knock];
}

/** Größe 0–1: Auftauchen mit kleinem Überschwingen, beim Angreifer am Ende Verschwinden */
export function appearScale(plan: BattlePlan, actor: Actor, t: number): number {
  const delay = actor === 'v' ? 0.04 : 0;
  const k = clamp((t - delay) / APPEAR, 0, 1);
  const pop = k < 1 ? smooth(k) + Math.sin(k * Math.PI) * 0.18 : 1;
  if (actor === 'v') return pop;
  const out = clamp((t - plan.outro) / (VANISH * 0.75), 0, 1);
  return pop * (1 - smooth(out));
}

/** Höhe des Opfers: liegt nach dem Tod kurz, dann versinkt es im Brett */
export function victimSink(plan: BattlePlan, t: number): number {
  return -0.75 * smooth(clamp((t - plan.sink) / 0.5, 0, 1));
}

export interface CinematicView {
  position: [number, number, number];
  target: [number, number, number];
}

/** Höhe des Kriegermodells in Modell-Einheiten (Ruhepose) */
export const WARRIOR_MODEL_HEIGHT = 2.47;

/**
 * Kamera für den Kampf: seitlich, knapp über Augenhöhe der Kämpfer, auf der Seite des Spielers.
 * Im Hochformat dreht sie etwas Richtung Kampfachse (über die Schulter des Angreifers), damit beide Krieger
 * ins schmale Bild passen. Der Abstand wird gesucht, bis beide Krieger samt Waffen zwischen die Kino-Balken passen
 * (`usableHeight` = Anteil der Bildhöhe zwischen den Balken).
 */
export function cinematicView(
  plan: BattlePlan,
  opts: { aspect: number; fov: number; viewSide: Color; usableHeight: number },
): CinematicView {
  const [dx, dz] = plan.dir;
  // Senkrechte zur Kampfachse, zum Spieler hin (Weiß sitzt bei +z); läuft der Kampf zum Spieler hin, nach außen
  const playerZ = opts.viewSide === 'w' ? 1 : -1;
  let px = -dz;
  let pz = dx;
  if (Math.abs(pz) > 0.3) {
    if (pz * playerZ < 0) [px, pz] = [-px, -pz];
  } else if (px * plan.mid[0] < 0) [px, pz] = [-px, -pz];
  const portrait = opts.aspect < 0.9;
  const beta = portrait ? 0.2 : 0.14;
  let cx = px * Math.cos(beta) - dx * Math.sin(beta);
  let cz = pz * Math.cos(beta) - dz * Math.sin(beta);
  const len = Math.hypot(cx, cz) || 1;
  cx /= len;
  cz /= len;
  // leicht von oben: so verdecken Figuren im Vordergrund die Krieger nicht
  const elevation = portrait ? 0.42 : 0.3;
  const target: [number, number, number] = [plan.mid[0], 0.62, plan.mid[1]];

  // Punkte, die sichtbar sein müssen: Fuß und erhobene Waffe beider Krieger
  // (das gefallene Opfer holt der Schwenk beim Todesstoß ins Bild, siehe deathPan)
  const points: Array<[number, number, number]> = [];
  const add = (x: number, z: number, height: number, r: number) => {
    for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      points.push([x + ox, 0, z + oz], [x + ox, height, z + oz]);
    }
  };
  add(plan.stop[0], plan.stop[1], WARRIOR_MODEL_HEIGHT * plan.scale.a * 1.06, 0.3);
  add(plan.victim[0], plan.victim[1], WARRIOR_MODEL_HEIGHT * plan.scale.v * 1.06, 0.3);

  const tanV = Math.tan(((opts.fov / 2) * Math.PI) / 180);
  const camAt = (d: number): [number, number, number] => [
    target[0] + cx * d * Math.cos(elevation),
    target[1] + d * Math.sin(elevation),
    target[2] + cz * d * Math.cos(elevation),
  ];
  const fits = (d: number) => {
    const cam = camAt(d);
    // Blickrichtung, rechts, oben
    let fx = target[0] - cam[0];
    let fy = target[1] - cam[1];
    let fz = target[2] - cam[2];
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl;
    fy /= fl;
    fz /= fl;
    let rx = -fz;
    let rz = fx;
    const rl = Math.hypot(rx, rz);
    rx /= rl;
    rz /= rl;
    const ux = -rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy;
    for (const [x, y, z] of points) {
      const vx = x - cam[0];
      const vy = y - cam[1];
      const vz = z - cam[2];
      const depth = vx * fx + vy * fy + vz * fz;
      if (depth < 0.3) return false;
      const sx = (vx * rx + vz * rz) / (depth * tanV * opts.aspect);
      const sy = (vx * ux + vy * uy + vz * uz) / (depth * tanV);
      if (Math.abs(sx) > 0.9 || Math.abs(sy) > opts.usableHeight * 0.92) return false;
    }
    return true;
  };
  let lo = 1.5;
  let hi = 40;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return { target, position: camAt(hi) };
}

/** Blickpunkt nach dem Todesstoß: Das Opfer fällt rücklings – die Kamera schwenkt ein Stück mit. */
export function deathPan(plan: BattlePlan): [number, number, number] {
  const shift = 0.4;
  return [plan.mid[0] + plan.dir[0] * shift, 0.5, plan.mid[1] + plan.dir[1] * shift];
}
