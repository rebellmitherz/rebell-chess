/**
 * Bewegungsabläufe der Figuren als reine Funktionen (Zeit → Haltung), damit sie testbar sind.
 *
 * - glide:  normaler Zug – abheben, in Zugrichtung neigen, federnd landen
 * - hop:    Springer – hoher Bogen
 * - attack: Schlagzug – ausholen, Ansturm, Einschlag beim Gegner, federnd landen
 * - knock:  geschlagene Figur – wird beim Einschlag getroffen, fliegt rückwärts, überschlägt sich, prallt auf
 */

export interface Pose {
  x: number;
  z: number;
  y: number;
  /** Neigung in Bewegungsrichtung (Bogenmaß, positiv = Kopf nach vorn) */
  tilt: number;
  /** Stauchung beim Aufsetzen (1 = normal) */
  squash: number;
}

export type MoveProfile = 'glide' | 'hop' | 'attack';

/** Zeitpunkt des Einschlags nach Beginn eines Schlagzugs (Sekunden) */
export const ATTACK_IMPACT = 0.36;
const ATTACK_WINDUP = 0.12;
const SETTLE = 0.26;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t: number) => t * t * t;

/** Gesamtdauer eines Bewegungsablaufs */
export function moveDuration(profile: MoveProfile, distance: number): number {
  if (profile === 'attack') return ATTACK_IMPACT + SETTLE;
  const travel = Math.min(0.55, 0.26 + distance * 0.045);
  return travel + SETTLE * (profile === 'hop' ? 1 : 0.75);
}

/** Federndes Einschwingen nach der Landung (0 → 1 über `SETTLE`) */
function settle(t: number): { squash: number; tilt: number } {
  const k = clamp01(t / SETTLE);
  const decay = Math.exp(-5 * k);
  const wave = Math.sin(k * Math.PI * 3);
  return { squash: 1 - 0.14 * decay * Math.cos(k * Math.PI * 3), tilt: -0.12 * decay * wave };
}

export function movePose(profile: MoveProfile, fromX: number, fromZ: number, toX: number, toZ: number, time: number): Pose {
  const dist = Math.hypot(toX - fromX, toZ - fromZ);
  if (profile === 'attack') {
    // 1) ausholen: leicht zurück, hoch, nach hinten lehnen
    if (time < ATTACK_WINDUP) {
      const k = easeInOut(time / ATTACK_WINDUP);
      const back = dist > 0 ? 0.18 / dist : 0;
      return { x: lerp(fromX, fromX - (toX - fromX) * back, k), z: lerp(fromZ, fromZ - (toZ - fromZ) * back, k), y: 0.35 * k, tilt: -0.35 * k, squash: 1 };
    }
    // 2) Ansturm im Bogen, nach vorn gelehnt
    if (time < ATTACK_IMPACT) {
      const k = easeIn((time - ATTACK_WINDUP) / (ATTACK_IMPACT - ATTACK_WINDUP));
      const back = dist > 0 ? 0.18 / dist : 0;
      const sx = fromX - (toX - fromX) * back;
      const sz = fromZ - (toZ - fromZ) * back;
      const arc = Math.sin(k * Math.PI) * (0.25 + dist * 0.05);
      return { x: lerp(sx, toX, k), z: lerp(sz, toZ, k), y: lerp(0.35, 0.05, k) + arc, tilt: lerp(-0.35, 0.55, k), squash: 1 };
    }
    // 3) Einschlag und federnd landen
    const s = settle(time - ATTACK_IMPACT);
    const k = clamp01((time - ATTACK_IMPACT) / 0.12);
    return { x: toX, z: toZ, y: 0.05 * (1 - k), tilt: lerp(0.55, 0, clamp01((time - ATTACK_IMPACT) / 0.18)) + s.tilt, squash: s.squash };
  }

  const travel = Math.min(0.55, 0.26 + dist * 0.045);
  if (time < travel) {
    const k = easeInOut(time / travel);
    const height = profile === 'hop' ? 0.45 + dist * 0.05 : Math.min(0.22, 0.08 + dist * 0.03);
    // Neigung: beim Losfliegen nach vorn, zur Landung zurück
    const tilt = (profile === 'hop' ? 0.35 : 0.22) * Math.sin(k * Math.PI) * (k < 0.5 ? 1 : 0.6);
    return { x: lerp(fromX, toX, k), z: lerp(fromZ, toZ, k), y: Math.sin(k * Math.PI) * height, tilt, squash: 1 };
  }
  const s = settle((time - travel) * (profile === 'hop' ? 1 : 1.3));
  return { x: toX, z: toZ, y: 0, tilt: s.tilt * (profile === 'hop' ? 1 : 0.6), squash: 1 - (1 - s.squash) * (profile === 'hop' ? 1 : 0.6) };
}

export interface KnockPose {
  /** Versatz zur Ausgangsposition */
  dx: number;
  dz: number;
  y: number;
  /** Überschlag um die Achse quer zur Flugrichtung */
  spin: number;
  /** Deckkraft */
  opacity: number;
  /** wurde schon getroffen? */
  hit: boolean;
}

/** Gesamtdauer des Treffer-Ablaufs der geschlagenen Figur */
export const KNOCK_TOTAL = ATTACK_IMPACT + 0.95;

/**
 * Geschlagene Figur: zittert bis zum Einschlag, wird dann rückwärts geschleudert (Richtung dirX/dirZ),
 * überschlägt sich, prallt einmal auf und verblasst.
 */
export function knockPose(dirX: number, dirZ: number, time: number): KnockPose {
  if (time < ATTACK_IMPACT) {
    const tremble = time > ATTACK_IMPACT * 0.55 ? Math.sin(time * 90) * 0.012 : 0;
    return { dx: tremble * dirZ, dz: -tremble * dirX, y: 0, spin: 0, opacity: 1, hit: false };
  }
  const t = time - ATTACK_IMPACT;
  const speed = 5.2;
  const up = 3.0;
  const g = 11;
  const tLand = (2 * up) / g; // Aufprall
  let y: number;
  let travel: number;
  if (t < tLand) {
    y = up * t - 0.5 * g * t * t;
    travel = speed * t;
  } else {
    // ein gedämpfter Abpraller
    const t2 = t - tLand;
    const up2 = up * 0.32;
    y = Math.max(0, up2 * t2 - 0.5 * g * t2 * t2);
    travel = speed * tLand + speed * 0.4 * t2;
  }
  const opacity = 1 - clamp01((t - 0.45) / 0.4);
  return { dx: dirX * travel, dz: dirZ * travel, y, spin: Math.min(t, tLand) * 9 + Math.max(0, t - tLand) * 3, opacity, hit: true };
}
