import type { Color } from './types';

/**
 * Schachuhr als reine Funktionen. Zeiten in Millisekunden, `now` wird immer übergeben,
 * damit die Uhr deterministisch testbar ist.
 *
 * - Die Uhr startet nach dem ersten Zug von Weiß (dann läuft Schwarz).
 * - Nach jedem Zug bekommt der Ziehende das Inkrement gutgeschrieben (Fischer-Modus).
 */
export interface ClockState {
  enabled: boolean;
  initialMs: number;
  incrementMs: number;
  remaining: Record<Color, number>;
  /** Wessen Uhr gerade läuft (null = noch nicht gestartet oder angehalten) */
  running: Color | null;
  /** Zeitpunkt, seit dem die laufende Uhr zählt; null = pausiert */
  since: number | null;
}

export function createClock(initialMs: number, incrementMs: number): ClockState {
  return {
    enabled: initialMs > 0,
    initialMs,
    incrementMs,
    remaining: { w: initialMs, b: initialMs },
    running: null,
    since: null,
  };
}

export function timeLeft(clock: ClockState, color: Color, now: number): number {
  const base = clock.remaining[color];
  if (clock.running === color && clock.since !== null) return Math.max(0, base - (now - clock.since));
  return Math.max(0, base);
}

/** Der Ziehende `mover` hat seinen Zug beendet: Zeit abziehen, Inkrement gutschreiben, Gegneruhr starten. */
export function pressClock(clock: ClockState, mover: Color, now: number, paused = false): ClockState {
  if (!clock.enabled) return clock;
  const opponent: Color = mover === 'w' ? 'b' : 'w';
  const remaining = { ...clock.remaining };
  if (clock.running === mover) {
    remaining[mover] = timeLeft(clock, mover, now) + clock.incrementMs;
  }
  return { ...clock, remaining, running: opponent, since: paused ? null : now };
}

export function pauseClock(clock: ClockState, now: number): ClockState {
  if (!clock.enabled || clock.running === null || clock.since === null) return clock;
  const remaining = { ...clock.remaining, [clock.running]: timeLeft(clock, clock.running, now) };
  return { ...clock, remaining, since: null };
}

export function resumeClock(clock: ClockState, now: number): ClockState {
  if (!clock.enabled || clock.running === null || clock.since !== null) return clock;
  return { ...clock, since: now };
}

export function stopClock(clock: ClockState, now: number): ClockState {
  const paused = pauseClock(clock, now);
  return { ...paused, running: null, since: null };
}

/** Setzt die Restzeiten (z. B. nach Rückgängig) und lässt die Uhr von `turn` laufen, falls sie schon lief. */
export function restoreClock(
  clock: ClockState,
  remaining: Record<Color, number>,
  turn: Color,
  started: boolean,
  now: number,
  paused: boolean,
): ClockState {
  if (!clock.enabled) return clock;
  return {
    ...clock,
    remaining: { ...remaining },
    running: started ? turn : null,
    since: started && !paused ? now : null,
  };
}

/** Farbe, deren Zeit abgelaufen ist, sonst null. */
export function flaggedColor(clock: ClockState, now: number): Color | null {
  if (!clock.enabled || clock.running === null) return null;
  return timeLeft(clock, clock.running, now) <= 0 ? clock.running : null;
}

export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 10_000) {
    const tenths = Math.floor(clamped / 100);
    return `0:${String(Math.floor(tenths / 10)).padStart(2, '0')}.${tenths % 10}`;
  }
  const totalSeconds = Math.ceil(clamped / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
