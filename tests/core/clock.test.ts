import { describe, expect, it } from 'vitest';
import {
  createClock,
  flaggedColor,
  formatClock,
  pauseClock,
  pressClock,
  restoreClock,
  resumeClock,
  stopClock,
  timeLeft,
} from '../../src/core/clock';

describe('Schachuhr', () => {
  it('ohne Bedenkzeit ist die Uhr aus', () => {
    const c = createClock(0, 0);
    expect(c.enabled).toBe(false);
    expect(pressClock(c, 'w', 1000)).toBe(c);
    expect(flaggedColor(c, 1e9)).toBeNull();
  });

  it('startet nach dem ersten Zug von Weiß und zieht Zeit nur vom Ziehenden ab', () => {
    let c = createClock(60_000, 0);
    c = pressClock(c, 'w', 1000); // Weiß zieht – Schwarz läuft ab jetzt
    expect(c.running).toBe('b');
    expect(timeLeft(c, 'w', 5000)).toBe(60_000);
    expect(timeLeft(c, 'b', 5000)).toBe(56_000);
    c = pressClock(c, 'b', 5000);
    expect(c.remaining.b).toBe(56_000);
    expect(c.running).toBe('w');
    expect(timeLeft(c, 'w', 7000)).toBe(58_000);
  });

  it('schreibt das Inkrement nach dem Zug gut, aber nicht beim allerersten Zug', () => {
    let c = createClock(180_000, 2000);
    c = pressClock(c, 'w', 0);
    expect(c.remaining.w).toBe(180_000);
    c = pressClock(c, 'b', 10_000);
    expect(c.remaining.b).toBe(172_000);
    c = pressClock(c, 'w', 13_000);
    expect(c.remaining.w).toBe(179_000);
  });

  it('pausiert und setzt fort', () => {
    let c = createClock(60_000, 0);
    c = pressClock(c, 'w', 0);
    c = pauseClock(c, 10_000);
    expect(timeLeft(c, 'b', 50_000)).toBe(50_000);
    c = resumeClock(c, 50_000);
    expect(timeLeft(c, 'b', 55_000)).toBe(45_000);
  });

  it('erkennt Zeitüberschreitung', () => {
    let c = createClock(5_000, 0);
    c = pressClock(c, 'w', 0);
    expect(flaggedColor(c, 4_999)).toBeNull();
    expect(flaggedColor(c, 5_000)).toBe('b');
    expect(timeLeft(c, 'b', 9_000)).toBe(0);
  });

  it('stellt Zeiten nach Rückgängig wieder her', () => {
    let c = createClock(60_000, 0);
    c = pressClock(c, 'w', 0);
    c = pressClock(c, 'b', 20_000);
    c = restoreClock(c, { w: 60_000, b: 60_000 }, 'b', true, 30_000, false);
    expect(c.running).toBe('b');
    expect(timeLeft(c, 'b', 31_000)).toBe(59_000);
    const stopped = stopClock(c, 40_000);
    expect(stopped.running).toBeNull();
    expect(stopped.remaining.b).toBe(50_000);
  });

  it('formatiert die Anzeige', () => {
    expect(formatClock(600_000)).toBe('10:00');
    expect(formatClock(65_400)).toBe('1:06');
    expect(formatClock(9_450)).toBe('0:09.4');
    expect(formatClock(3_600_000)).toBe('1:00:00');
    expect(formatClock(-5)).toBe('0:00.0');
  });
});
