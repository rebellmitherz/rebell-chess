import { describe, expect, it } from 'vitest';
import { ATTACK_IMPACT, KNOCK_TOTAL, knockPose, moveDuration, movePose, type MoveProfile } from '../../src/scene/choreography';

describe('Figuren-Animationen', () => {
  it.each<MoveProfile>(['glide', 'hop', 'attack'])('%s beginnt am Start und endet ruhig am Ziel', (profile) => {
    const start = movePose(profile, 0, 0, 2, -3, 0);
    expect(start.x).toBeCloseTo(0, 5);
    expect(start.z).toBeCloseTo(0, 5);
    expect(start.y).toBeCloseTo(0, 5);
    const end = movePose(profile, 0, 0, 2, -3, moveDuration(profile, Math.hypot(2, 3)) + 0.01);
    expect(end).toMatchObject({ x: 2, z: -3 });
    expect(end.y).toBeCloseTo(0, 3);
    expect(Math.abs(end.tilt)).toBeLessThan(0.02);
    expect(end.squash).toBeCloseTo(1, 1);
  });

  it('bleibt immer über dem Brett', () => {
    for (const profile of ['glide', 'hop', 'attack'] as const) {
      for (let t = 0; t < 1.2; t += 0.01) expect(movePose(profile, 0, 0, 3, 3, t).y).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('der Angreifer holt aus und trifft genau beim Einschlag', () => {
    const windup = movePose('attack', 0, 0, 0, -2, 0.15);
    expect(windup.z).toBeGreaterThan(0); // zurück, weg vom Ziel
    expect(windup.tilt).toBeLessThan(0); // nach hinten gelehnt
    const lunge = movePose('attack', 0, 0, 0, -2, ATTACK_IMPACT - 0.02);
    expect(lunge.tilt).toBeGreaterThan(0.3); // nach vorn gelehnt
    const impact = movePose('attack', 0, 0, 0, -2, ATTACK_IMPACT);
    expect(impact.z).toBeCloseTo(-2, 5);
  });

  it('die geschlagene Figur wartet auf den Einschlag, fliegt dann in Schlagrichtung und verblasst', () => {
    expect(knockPose(0, -1, ATTACK_IMPACT - 0.01).hit).toBe(false);
    expect(knockPose(0, -1, ATTACK_IMPACT - 0.01).opacity).toBe(1);
    const flying = knockPose(0, -1, ATTACK_IMPACT + 0.2);
    expect(flying.hit).toBe(true);
    expect(flying.dz).toBeLessThan(-0.5);
    expect(flying.y).toBeGreaterThan(0.2);
    expect(flying.spin).toBeGreaterThan(1);
    const gone = knockPose(0, -1, KNOCK_TOTAL);
    expect(gone.opacity).toBe(0);
    expect(gone.y).toBeGreaterThanOrEqual(0);
  });
});
