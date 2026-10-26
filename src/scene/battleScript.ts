import type { Color, PieceSymbol, Square } from '../core/types';
import { squareToWorld } from './boardMath';

/**
 * Drehbuch eines Kriegerkampfs als reine Funktionen (ohne three.js, testbar).
 *
 * Jeder Kampf wird neu gewürfelt: ein Szenario (Duell, Blitzangriff, Comeback, Tritt, Schlagabtausch …), daraus
 * zufällige Bewegungen aus der Bewegungsbibliothek, eigenes Tempo, eigene Kameraeinstellungen und Schnitte.
 * Die zuletzt gespielten Szenarien werden gemieden, damit sich nichts wiederholt. Alle Zeiten in Sekunden ab
 * Kampfbeginn, Positionen in Weltmaß (ein Feld = 1).
 */

/** Wozu eine Bewegung taugt */
export type MoveRole =
  | 'idle'
  | 'run'
  | 'attack'
  | 'heavy'
  | 'kick'
  | 'block'
  | 'blockHit'
  | 'impact'
  | 'death'
  | 'taunt'
  | 'victory';

/** Eine Animation der Bibliothek (erzeugt von scripts/build-warriors.mjs) */
export interface MoveClip {
  name: string;
  role: MoveRole;
  duration: number;
  /** Treffermoment (s im Clip): schnellste Bewegung von Waffe bzw. Fuß */
  impact?: number;
  /**
   * Fortbewegung aus der Animation (Modellmaß, auf den Boden projiziert): [Anteil der Dauer, vorwärts, seitwärts].
   * Die Hüfte bewegt sich in der Datei nicht mehr waagrecht – die Szene verschiebt dafür den ganzen Krieger.
   */
  root?: Array<[number, number, number]>;
}

export type MoveLibrary = Partial<Record<MoveRole, MoveClip[]>>;

/** Größe des Kriegermodells (Ruhepose, Modellmaß) – die Szene skaliert auf Brettgröße */
export const WARRIOR_MODEL_HEIGHT = 1.8;
/** Ein Krieger ist auf dem Brett etwa 1,35 Felder hoch (so groß wie ein König) */
export const WARRIOR_SCALE = 1.35 / WARRIOR_MODEL_HEIGHT;
/** Größere Figuren werden zu größeren Kriegern */
const TYPE_SCALE: Record<PieceSymbol, number> = { p: 0.9, n: 0.97, b: 0.97, r: 1.02, q: 1.02, k: 1.06 };
/** Abstand der Kämpfer (Weltmaß) – die Klingen erreichen den Gegner knapp */
export const FIGHT_DISTANCE = 0.95;
/** Näher kommen sie sich auch beim Vorstoßen nicht */
export const MIN_DISTANCE = 0.62;
const RUN_SPEED = 2.8;
/** So weit treibt ein Ausfallschritt den Gegner höchstens zurück */
const MAX_PUSH = 1.2;
/** Dauer der Verwandlung (Figur → Krieger) */
export const APPEAR = 0.32;
/** Dauer der Rückverwandlung */
export const VANISH = 0.42;

export type Actor = 'a' | 'v';
export type Vec2 = [number, number];

export interface ActorCue {
  t: number;
  actor: Actor;
  clip: string;
  role: MoveRole;
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

/** Kameraeinstellungen: Totale von der Seite, über die Schulter, Froschperspektive, Nahaufnahme, Held, von oben */
export type ShotKind = 'side' | 'overA' | 'overV' | 'low' | 'close' | 'hero' | 'high';

export interface Shot {
  t: number;
  kind: ShotKind;
  /** harter Schnitt statt Kamerafahrt */
  cut: boolean;
}

/** Zeitlupe bzw. kurzes Anhalten beim Treffer */
export interface Warp {
  from: number;
  to: number;
  factor: number;
}

export interface Hit {
  t: number;
  by: Actor;
  result: 'blocked' | 'hit' | 'kill';
}

/** Ortsänderung eines Kriegers in einem Zeitabschnitt (Anlauf, Vorstoß, Rückstoß, Sturz) */
export interface Segment {
  t0: number;
  t1: number;
  from: Vec2;
  to: Vec2;
  /** Fortschritt 0–1 an gleichmäßig verteilten Zeitpunkten (fehlt = weich) */
  curve?: number[];
}

export interface BattleInput {
  from: Square;
  victimSquare: Square;
  attacker: { color: Color; type: PieceSymbol };
  victim: { color: Color; type: PieceSymbol };
}

export interface PlanOptions {
  library: Record<Color, MoveLibrary>;
  /** Startwert für den Zufall (gleicher Wert = gleicher Kampf) */
  seed: number;
  /** zuletzt gespielte Szenarien – werden nicht wiederholt */
  avoid?: string[];
  /** festes Szenario (für Tests) */
  scenario?: string;
}

export interface BattlePlan {
  scenario: string;
  start: Vec2;
  /** Standplatz des Angreifers nach dem Anlauf */
  stop: Vec2;
  victim: Vec2;
  /** Einheitsvektor Angreifer → Opfer */
  dir: Vec2;
  paths: Record<Actor, Segment[]>;
  runStart: number;
  runEnd: number;
  cues: ActorCue[];
  fx: FxCue[];
  shots: Shot[];
  warps: Warp[];
  hits: Hit[];
  /** tödlicher Treffer */
  deathAt: number;
  /** Opfer versinkt im Brett */
  sink: number;
  /** Rückverwandlung beginnt */
  outro: number;
  total: number;
  scale: Record<Actor, number>;
  colors: Record<Actor, Color>;
}

// ---------- Zufall ----------

/** Kleiner, schneller Zufallsgenerator mit Startwert (mulberry32) */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (k: number) => k * k * (3 - 2 * k);
const other = (a: Actor): Actor => (a === 'a' ? 'v' : 'a');

// ---------- Szenarien ----------

/** Ein Szenario beschreibt nur den Ablauf; Bewegungen, Tempo und Kamera würfelt der Planer */
type Beat =
  | { do: 'strike'; by: Actor; result: Hit['result']; role?: 'attack' | 'heavy' | 'kick'; tempo?: number }
  | { do: 'taunt'; by: Actor };

export const SCENARIOS: Record<string, Beat[]> = {
  // Hieb gegen Abwehr, Konter gegen Abwehr, Treffer, Todesstoß
  duel: [
    { do: 'strike', by: 'a', result: 'blocked' },
    { do: 'strike', by: 'v', result: 'blocked' },
    { do: 'strike', by: 'a', result: 'hit' },
    { do: 'strike', by: 'a', result: 'kill', role: 'heavy' },
  ],
  // Anlauf und ein einziger, gewaltiger Schlag
  blitz: [{ do: 'strike', by: 'a', result: 'kill', role: 'heavy', tempo: 1.1 }],
  // Schlag auf Schlag – die Abwehr hält zweimal, dann nicht mehr
  flurry: [
    { do: 'strike', by: 'a', result: 'blocked', tempo: 1.35 },
    { do: 'strike', by: 'a', result: 'blocked', tempo: 1.35 },
    { do: 'strike', by: 'a', result: 'hit', tempo: 1.3 },
    { do: 'strike', by: 'a', result: 'kill' },
  ],
  // Das Opfer trifft zuerst, der Angreifer rafft sich auf und dreht den Kampf
  comeback: [
    { do: 'strike', by: 'v', result: 'hit' },
    { do: 'taunt', by: 'a' },
    { do: 'strike', by: 'a', result: 'hit' },
    { do: 'strike', by: 'a', result: 'kill', role: 'heavy' },
  ],
  // Abgewehrt – dann ein Tritt, der den Gegner aus der Deckung holt
  kick: [
    { do: 'strike', by: 'a', result: 'blocked' },
    { do: 'strike', by: 'a', result: 'hit', role: 'kick' },
    { do: 'strike', by: 'a', result: 'kill' },
  ],
  // Beide landen einen Treffer, der Angreifer den letzten
  trade: [
    { do: 'strike', by: 'a', result: 'hit' },
    { do: 'strike', by: 'v', result: 'hit' },
    { do: 'strike', by: 'a', result: 'kill', role: 'heavy' },
  ],
  // Das Opfer greift an, läuft zweimal in die Abwehr – und wird ausgekontert
  parry: [
    { do: 'strike', by: 'v', result: 'blocked' },
    { do: 'strike', by: 'v', result: 'blocked', tempo: 1.25 },
    { do: 'strike', by: 'a', result: 'kill', role: 'heavy' },
  ],
  // Der Angreifer verhöhnt den Gegner, dann ein schneller Wechsel
  taunt: [
    { do: 'taunt', by: 'a' },
    { do: 'strike', by: 'v', result: 'blocked' },
    { do: 'strike', by: 'a', result: 'hit', tempo: 1.25 },
    { do: 'strike', by: 'a', result: 'kill' },
  ],
};

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 10 };

/** Welche Szenarien passen zu wem: der Bauer gegen die Dame kämpft sich zurück, die Dame macht kurzen Prozess */
export function scenarioWeights(input: BattleInput): Record<string, number> {
  const w: Record<string, number> = { duel: 3, blitz: 1.5, flurry: 2, comeback: 1.5, kick: 2, trade: 1.5, parry: 1.5, taunt: 1.2 };
  const diff = VALUE[input.victim.type] - VALUE[input.attacker.type];
  if (diff >= 3) {
    // Außenseiter siegt: lange, harte Kämpfe
    w.comeback += 3;
    w.trade += 2;
    w.blitz *= 0.3;
  } else if (diff <= -3) {
    // Übermacht: kurz und gnadenlos
    w.blitz += 2.5;
    w.flurry += 1.5;
    w.taunt += 1.5;
    w.comeback *= 0.3;
  }
  if (input.attacker.type === 'n') w.kick += 2;
  if (input.attacker.type === 'r') w.duel += 1.5;
  if (input.attacker.type === 'q') w.flurry += 2;
  if (input.attacker.type === 'k') w.taunt += 1.5;
  return w;
}

function pickWeighted(rnd: () => number, weights: Record<string, number>): string {
  const entries = Object.entries(weights).filter(([, v]) => v > 0);
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  let r = rnd() * sum;
  for (const [k, v] of entries) {
    r -= v;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

// ---------- Planer ----------

export function planBattle(input: BattleInput, opts: PlanOptions): BattlePlan {
  const rnd = seededRandom(opts.seed);
  const pick = <T,>(items: T[]): T => items[Math.floor(rnd() * items.length) % items.length];
  const vary = (v: number, amount: number) => v * (1 + (rnd() * 2 - 1) * amount);

  const colors: Record<Actor, Color> = { a: input.attacker.color, v: input.victim.color };
  const scale: Record<Actor, number> = {
    a: WARRIOR_SCALE * TYPE_SCALE[input.attacker.type],
    v: WARRIOR_SCALE * TYPE_SCALE[input.victim.type],
  };
  const lib = (actor: Actor) => opts.library[colors[actor]];
  const clipsFor = (actor: Actor, ...roles: MoveRole[]): MoveClip[] => {
    for (const role of roles) {
      const list = lib(actor)[role];
      if (list && list.length) return list;
    }
    return [];
  };
  // Nicht zweimal hintereinander dieselbe Bewegung
  const lastClip: Record<Actor, string> = { a: '', v: '' };
  const choose = (actor: Actor, ...roles: MoveRole[]): MoveClip | null => {
    const list = clipsFor(actor, ...roles);
    if (!list.length) return null;
    const fresh = list.filter((c) => c.name !== lastClip[actor]);
    return pick(fresh.length ? fresh : list);
  };

  // Szenario würfeln – die zuletzt gespielten bleiben außen vor
  const weights = scenarioWeights(input);
  for (const name of opts.avoid ?? []) {
    const remaining = Object.entries(weights).filter(([k, v]) => k !== name && v > 0);
    if (name in weights && remaining.length) weights[name] = 0;
  }
  const scenario = opts.scenario ?? pickWeighted(rnd, weights);

  const [sx, sz] = squareToWorld(input.from);
  const [vx, vz] = squareToWorld(input.victimSquare);
  const dist = Math.hypot(vx - sx, vz - sz) || 1;
  const dir: Vec2 = [(vx - sx) / dist, (vz - sz) / dist];
  const facing: Record<Actor, Vec2> = { a: dir, v: [-dir[0], -dir[1]] };

  const cues: ActorCue[] = [];
  const fx: FxCue[] = [];
  const shots: Shot[] = [];
  const warps: Warp[] = [];
  const hits: Hit[] = [];
  const paths: Record<Actor, Segment[]> = { a: [], v: [] };
  const pos: Record<Actor, Vec2> = { a: [sx, sz], v: [vx, vz] };

  const cue = (t: number, actor: Actor, clip: MoveClip, speed: number, fade = 0.14, loop = false) => {
    cues.push({ t, actor, clip: clip.name, role: clip.role, speed, loop, fade });
    lastClip[actor] = clip.name;
  };
  const moveTo = (actor: Actor, t0: number, t1: number, to: Vec2, curve?: number[]) => {
    paths[actor].push({ t0, t1, from: [pos[actor][0], pos[actor][1]], to, curve });
    pos[actor] = to;
  };
  const gap = () => Math.hypot(pos.v[0] - pos.a[0], pos.v[1] - pos.a[1]);

  /** Fortbewegung aus der Animation übernehmen (vorwärts nur so weit, dass sich niemand durchdringt) */
  const rootMotion = (actor: Actor, clip: MoveClip, t0: number, speed: number) => {
    if (!clip.root || clip.root.length < 2) return;
    const last = clip.root[clip.root.length - 1];
    const total = last[1];
    if (Math.abs(total) < 0.03) return;
    const fwd = total * scale[actor];
    if (Math.abs(fwd) < 0.02) return;
    const f = facing[actor];
    const curve = clip.root.map(([, d]) => clamp(d / total, -0.5, 1.5));
    const t1 = t0 + clip.duration / speed;
    // Stößt der Krieger weiter vor, als Platz ist, treibt er den Gegner vor sich her (nicht durch ihn hindurch)
    const room = Math.max(0, gap() - MIN_DISTANCE);
    const push = fwd > room ? Math.min(fwd - room, MAX_PUSH) : 0;
    const step = fwd > 0 ? Math.min(fwd, room + push) : fwd;
    if (push > 0.02) {
      const target = other(actor);
      const g = facing[target];
      moveTo(target, t0, t1, [pos[target][0] - g[0] * push, pos[target][1] - g[1] * push], curve);
    }
    moveTo(actor, t0, t1, [pos[actor][0] + f[0] * step, pos[actor][1] + f[1] * step], curve);
  };

  /** Zurückgestoßen werden (zusätzlich, wenn die Animation am Platz bleibt) */
  const knock = (actor: Actor, t: number, amount: number, length: number) => {
    const f = facing[actor];
    moveTo(actor, t, t + length, [pos[actor][0] - f[0] * amount, pos[actor][1] - f[1] * amount]);
  };

  // ----- Verwandlung und Anlauf -----
  const idleA = choose('a', 'idle');
  const idleV = choose('v', 'idle');
  if (idleA) cue(0, 'a', idleA, 1, 0, true);
  if (idleV) cue(0, 'v', idleV, 1, 0, true);
  fx.push({ t: 0, kind: 'transform', at: 'a' }, { t: 0.04, kind: 'transform', at: 'v' });
  shots.push({ t: 0, kind: 'side', cut: false });

  const runDist = Math.max(0, dist - FIGHT_DISTANCE);
  let runStart = APPEAR;
  let runEnd = APPEAR;
  if (runDist > 0.12) {
    runStart = APPEAR + 0.04;
    const duration = clamp(runDist / RUN_SPEED, 0.28, 1.0);
    runEnd = runStart + duration;
    const run = choose('a', 'run');
    if (run) cue(runStart, 'a', run, clamp(runDist / duration / RUN_SPEED, 0.9, 1.8), 0.1, true);
    moveTo('a', runStart, runEnd, [sx + dir[0] * runDist, sz + dir[1] * runDist]);
    for (let t = runStart + 0.08; t < runEnd - 0.05; t += 0.19) fx.push({ t, kind: 'step', at: 'a' });
  }
  const stop: Vec2 = [pos.a[0], pos.a[1]];

  // ----- Schlagabtausch -----
  let cursor = runEnd + 0.04;
  let deathAt = cursor + 1;
  let lastShot: ShotKind = 'side';
  const shotKinds: ShotKind[] = ['side', 'overA', 'overV', 'low', 'high'];
  const newShot = (t: number) => {
    const k = pick(shotKinds.filter((s) => s !== lastShot));
    shots.push({ t, kind: k, cut: rnd() < 0.7 });
    lastShot = k;
  };
  // Mal klirren die Klingen, mal kracht es auf den Schild
  const guardFx = (): BattleFxKind => (rnd() < 0.5 ? 'block' : 'clash');

  SCENARIOS[scenario].forEach((beat, index) => {
    if (index > 0 && rnd() < 0.55) newShot(cursor - 0.05);
    if (beat.do === 'taunt') {
      const clip = choose(beat.by, 'taunt', 'victory', 'idle');
      if (!clip) return;
      const speed = vary(1.15, 0.1);
      cue(cursor, beat.by, clip, speed, 0.18);
      const waiting = choose(other(beat.by), 'idle');
      if (waiting) cue(cursor + 0.1, other(beat.by), waiting, 1, 0.25, true);
      cursor += Math.min(1.1, (clip.duration / speed) * 0.75);
      return;
    }
    const by = beat.by;
    const target = other(by);
    const role = beat.role ?? 'attack';
    const move = choose(by, role, role === 'kick' ? 'heavy' : 'attack', 'attack', 'heavy');
    if (!move) return;
    const speed = vary(beat.tempo ?? 1.15, 0.08);
    const impact = cursor + (move.impact ?? move.duration * 0.5) / speed;
    cue(cursor, by, move, speed, 0.12);
    rootMotion(by, move, cursor, speed);
    if (move.role !== 'kick') fx.push({ t: impact - 0.15, kind: 'swing', at: by });
    hits.push({ t: impact, by, result: beat.result });

    if (beat.result === 'blocked') {
      const block = choose(target, 'block');
      if (block) cue(Math.max(cursor, impact - 0.3), target, block, 1.25, 0.12);
      const blockHit = choose(target, 'blockHit');
      if (blockHit) {
        cue(impact, target, blockHit, 1.3, 0.06);
        rootMotion(target, blockHit, impact, 1.3);
      }
      if (!blockHit?.root) knock(target, impact, 0.05, 0.18);
      fx.push({ t: impact, kind: guardFx(), at: 'mid' });
      warps.push({ from: impact, to: impact + 0.05, factor: 0.15 });
      cursor = impact + vary(0.24, 0.25);
    } else if (beat.result === 'hit') {
      const react = choose(target, 'impact');
      if (react) {
        const s = vary(1.1, 0.08);
        cue(impact, target, react, s, 0.06);
        rootMotion(target, react, impact, s);
      }
      if (!react?.root) knock(target, impact, move.role === 'kick' ? 0.32 : 0.14, move.role === 'kick' ? 0.35 : 0.22);
      fx.push({ t: impact, kind: 'hit', at: target });
      warps.push({ from: impact, to: impact + 0.08, factor: 0.08 });
      cursor = impact + vary(0.32, 0.2);
    } else {
      deathAt = impact;
      // Todesstoß: Nahaufnahme kurz vorher, Zeitlupe um den Treffer
      const closeKind: ShotKind = rnd() < 0.6 ? 'close' : 'low';
      shots.push({ t: Math.max(cursor, impact - 0.32), kind: closeKind, cut: true });
      lastShot = closeKind;
      const death = choose(target, 'death');
      if (death) {
        cue(impact, target, death, 1, 0.08);
        rootMotion(target, death, impact, 1);
      }
      if (!death?.root) knock(target, impact, 0.2, 0.4);
      fx.push(
        { t: impact, kind: 'death', at: target },
        { t: impact + clamp((death?.duration ?? 1) * 0.45, 0.35, 0.9), kind: 'fall', at: target },
      );
      warps.push({ from: impact - 0.12, to: impact + 0.45, factor: 0.32 });
      cursor = impact;
    }
  });

  // ----- Sieg und Rückverwandlung -----
  const victory = choose('a', 'victory', 'taunt', 'idle');
  if (victory) cue(deathAt + 0.55, 'a', victory, vary(1.1, 0.08), 0.22);
  fx.push({ t: deathAt + 0.65, kind: 'cheer', at: 'a' });
  shots.push({ t: deathAt + 0.6, kind: rnd() < 0.5 ? 'hero' : 'side', cut: rnd() < 0.5 });
  const deathCue = cues.find((c) => c.actor === 'v' && c.role === 'death');
  const deathLength = deathCue ? (clipsFor('v', 'death').find((c) => c.name === deathCue.clip)?.duration ?? 1) : 1;
  const sink = deathAt + clamp(deathLength * 0.85, 0.85, 1.6);
  const outro = Math.max(deathAt + 1.45, sink + 0.35);
  fx.push({ t: outro, kind: 'vanish', at: 'a' });

  return {
    scenario,
    start: [sx, sz],
    stop,
    victim: [vx, vz],
    dir,
    paths,
    runStart,
    runEnd,
    cues: cues.sort((x, y) => x.t - y.t),
    fx: fx.sort((x, y) => x.t - y.t),
    shots: shots.sort((x, y) => x.t - y.t),
    warps,
    hits,
    deathAt,
    sink,
    outro,
    total: outro + VANISH,
    scale,
    colors,
  };
}

// ---------- Auswertung zur Laufzeit ----------

function evalSegment(seg: Segment, t: number): Vec2 {
  const k = clamp((t - seg.t0) / Math.max(1e-6, seg.t1 - seg.t0), 0, 1);
  let e: number;
  if (seg.curve && seg.curve.length > 1) {
    const x = k * (seg.curve.length - 1);
    const i = Math.min(seg.curve.length - 2, Math.floor(x));
    e = seg.curve[i] + (seg.curve[i + 1] - seg.curve[i]) * (x - i);
  } else e = 0.1 * smooth(k) + 0.9 * k;
  return [seg.from[0] + (seg.to[0] - seg.from[0]) * e, seg.from[1] + (seg.to[1] - seg.from[1]) * e];
}

/** Position eines Kriegers zur Zeit t */
export function actorPosition(plan: BattlePlan, actor: Actor, t: number): Vec2 {
  let p: Vec2 = actor === 'a' ? plan.start : plan.victim;
  for (const seg of plan.paths[actor]) {
    if (t < seg.t0) break;
    p = evalSegment(seg, t);
  }
  return p;
}

export const attackerPosition = (plan: BattlePlan, t: number) => actorPosition(plan, 'a', t);
export const victimPosition = (plan: BattlePlan, t: number) => actorPosition(plan, 'v', t);

/** Zeitfaktor (Zeitlupe, kurzes Anhalten bei Treffern) */
export function timeScale(plan: BattlePlan, t: number): number {
  let f = 1;
  for (const w of plan.warps) if (t >= w.from && t < w.to) f = Math.min(f, w.factor);
  return f;
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

/** Kameraeinstellung, die zur Zeit t gilt */
export function shotAt(plan: BattlePlan, t: number): { shot: Shot; index: number } {
  let index = 0;
  for (let i = 0; i < plan.shots.length; i++) if (plan.shots[i].t <= t) index = i;
  return { shot: plan.shots[index], index };
}

// ---------- Kamera ----------

export interface CinematicView {
  position: [number, number, number];
  target: [number, number, number];
}

export interface ViewOptions {
  aspect: number;
  fov: number;
  viewSide: Color;
  /** Anteil der Bildhöhe zwischen den Kino-Balken */
  usableHeight: number;
}

/** Senkrechte zur Kampfachse auf der Seite des Spielers (Weiß sitzt bei +z); läuft der Kampf zum Spieler, nach außen */
function playerSide(plan: BattlePlan, viewSide: Color, a: Vec2, v: Vec2): Vec2 {
  const [dx, dz] = plan.dir;
  const playerZ = viewSide === 'w' ? 1 : -1;
  let px = -dz;
  let pz = dx;
  const midX = (a[0] + v[0]) / 2;
  if (Math.abs(pz) > 0.3) {
    if (pz * playerZ < 0) [px, pz] = [-px, -pz];
  } else if (px * midX < 0) [px, pz] = [-px, -pz];
  return [px, pz];
}

/**
 * Seitliche Totale: knapp über Augenhöhe, auf der Seite des Spielers. Im Hochformat dreht sie etwas Richtung
 * Kampfachse, damit beide Krieger ins schmale Bild passen. Der Abstand wird gesucht, bis beide Krieger samt Waffen
 * zwischen die Kino-Balken passen.
 */
export function cinematicView(
  plan: BattlePlan,
  opts: ViewOptions,
  a: Vec2 = plan.stop,
  v: Vec2 = plan.victim,
  /** Blickwinkel von oben (Bogenmaß); ohne Angabe leicht von oben */
  tilt?: number,
): CinematicView {
  const [dx, dz] = plan.dir;
  const [px, pz] = playerSide(plan, opts.viewSide, a, v);
  const portrait = opts.aspect < 0.9;
  const beta = portrait ? 0.2 : 0.14;
  let cx = px * Math.cos(beta) - dx * Math.sin(beta);
  let cz = pz * Math.cos(beta) - dz * Math.sin(beta);
  const len = Math.hypot(cx, cz) || 1;
  cx /= len;
  cz /= len;
  // leicht von oben: so verdecken Figuren im Vordergrund die Krieger nicht
  const elevation = tilt ?? (portrait ? 0.42 : 0.3);
  const target: [number, number, number] = [(a[0] + v[0]) / 2, 0.62, (a[1] + v[1]) / 2];

  const points: Array<[number, number, number]> = [];
  const add = (x: number, z: number, height: number, r: number) => {
    for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) points.push([x + ox, 0, z + oz], [x + ox, height, z + oz]);
  };
  add(a[0], a[1], WARRIOR_MODEL_HEIGHT * plan.scale.a * 1.08, 0.32);
  add(v[0], v[1], WARRIOR_MODEL_HEIGHT * plan.scale.v * 1.08, 0.32);

  const tanV = Math.tan(((opts.fov / 2) * Math.PI) / 180);
  const camAt = (d: number): [number, number, number] => [
    target[0] + cx * d * Math.cos(elevation),
    target[1] + d * Math.sin(elevation),
    target[2] + cz * d * Math.cos(elevation),
  ];
  const fits = (d: number) => {
    const cam = camAt(d);
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
    const m = (lo + hi) / 2;
    if (fits(m)) hi = m;
    else lo = m;
  }
  return { target, position: camAt(hi) };
}

/**
 * Kamera für eine Einstellung zur Zeit t (aus den aktuellen Positionen der Krieger).
 * Im Hochformat gehen nahe Einstellungen weiter zurück, damit der Ausschnitt nicht zu eng wird.
 */
export function shotView(plan: BattlePlan, kind: ShotKind, t: number, opts: ViewOptions): CinematicView {
  const a = actorPosition(plan, 'a', t);
  const v = actorPosition(plan, 'v', t);
  if (kind === 'side') return cinematicView(plan, opts, a, v);
  const [dx, dz] = plan.dir;
  const [px, pz] = playerSide(plan, opts.viewSide, a, v);
  const s = Math.max(plan.scale.a, plan.scale.v) / WARRIOR_SCALE;
  const k = (opts.aspect < 0.9 ? 2.1 : 1) * s;
  const mid: Vec2 = [(a[0] + v[0]) / 2, (a[1] + v[1]) / 2];
  /** Punkt `back` hinter p (entgegen der Kampfrichtung), `side` zum Spieler hin, `up` hoch */
  const at = (p: Vec2, back: number, side: number, up: number): [number, number, number] => [
    p[0] - dx * back * k + px * side * k,
    Math.max(0.12, up * s),
    p[1] - dz * back * k + pz * side * k,
  ];
  switch (kind) {
    case 'overA':
      // hinter dem Angreifer, Blick auf das Opfer
      return { position: at(a, 2.5, 1.2, 1.5), target: [v[0], 0.8 * s, v[1]] };
    case 'overV':
      // hinter dem Opfer, Blick auf den Angreifer
      return { position: at(v, -2.5, 1.2, 1.5), target: [a[0], 0.8 * s, a[1]] };
    case 'low':
      // Froschperspektive von der Seite – die Krieger wirken riesig
      return { position: [mid[0] + px * 3.3 * k, 0.3, mid[1] + pz * 3.3 * k], target: [mid[0], 0.85 * s, mid[1]] };
    case 'close':
      // beide Kämpfer eng und flach von der Seite – der Todesstoß soll ganz zu sehen sein
      return cinematicView(plan, opts, a, v, 0.1);
    case 'hero':
      // der Sieger von unten
      return { position: at(a, -1.6, 2.0, 0.45), target: [a[0], 0.85 * s, a[1]] };
    case 'high':
      // schräg von oben über das Schlachtfeld
      return {
        position: [mid[0] + px * 2.4 * k, 3.6 * s * (opts.aspect < 0.9 ? 1.3 : 1), mid[1] + pz * 2.4 * k],
        target: [mid[0], 0.3, mid[1]],
      };
  }
}
