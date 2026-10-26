import { describe, expect, it } from 'vitest';
import {
  APPEAR,
  appearScale,
  attackerPosition,
  cinematicView,
  FIGHT_DISTANCE,
  planBattle,
  victimPosition,
  victimSink,
  WARRIOR_CLIPS,
  type BattleInput,
} from '../../src/scene/battleScript';

const pawnTakesPawn: BattleInput = {
  from: 'e4',
  victimSquare: 'd5',
  attacker: { color: 'w', type: 'p' },
  victim: { color: 'b', type: 'p' },
};

const rookAcrossBoard: BattleInput = {
  from: 'a1',
  victimSquare: 'a8',
  attacker: { color: 'w', type: 'r' },
  victim: { color: 'b', type: 'r' },
};

describe('Drehbuch des Kriegerkampfs', () => {
  it('folgt der Reihenfolge Hieb – Konter – Treffer – Todesstoß – Jubel', () => {
    const plan = planBattle(pawnTakesPawn);
    const [i1, i2, i3, i4] = plan.impacts;
    expect(i1).toBeGreaterThan(plan.runEnd);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
    expect(i4).toBeGreaterThan(i3);
    const roleAt = (actor: 'a' | 'v', role: string) => plan.cues.find((c) => c.actor === actor && c.role === role)!.t;
    expect(roleAt('v', 'blockHit')).toBeCloseTo(i1);
    expect(roleAt('a', 'blockHit')).toBeCloseTo(i2);
    expect(roleAt('v', 'hit')).toBeCloseTo(i3);
    expect(roleAt('v', 'death')).toBeCloseTo(i4);
    expect(roleAt('a', 'cheer')).toBeGreaterThan(i4);
    // Nach dem Tod greift das Opfer nicht mehr an
    expect(plan.cues.filter((c) => c.actor === 'v' && c.t > i4)).toHaveLength(0);
    // Klänge und Effekte im Takt der Treffer
    const fxAt = (kind: string) => plan.fx.filter((f) => f.kind === kind).map((f) => f.t);
    expect(fxAt('death')).toEqual([i4]);
    expect(fxAt('fall')[0]).toBeGreaterThan(i4);
    expect(fxAt('hit')).toEqual([i3]);
    // Weiß hat einen Schild (Ritter), Schwarz pariert mit der Axt
    expect(plan.fx.find((f) => f.t === i1)?.kind).toBe('clash');
    expect(plan.fx.find((f) => f.t === i2)?.kind).toBe('block');
  });

  it('dauert spürbar, aber nicht ewig – auch über das ganze Brett', () => {
    const short = planBattle(pawnTakesPawn);
    expect(short.total).toBeGreaterThan(3.8);
    expect(short.total).toBeLessThan(6.2);
    const long = planBattle(rookAcrossBoard);
    expect(long.runEnd - long.runStart).toBeLessThanOrEqual(1.05 + 1e-9);
    expect(long.total).toBeLessThan(short.total + 1.2);
    // Schritte während des Anlaufs
    expect(long.fx.filter((f) => f.kind === 'step').length).toBeGreaterThan(3);
  });

  it('läuft bis auf Kampfabstand an das Opfer heran', () => {
    const plan = planBattle(rookAcrossBoard);
    expect(attackerPosition(plan, 0)).toEqual(plan.start);
    const stop = attackerPosition(plan, plan.runEnd + 0.01);
    expect(Math.hypot(stop[0] - plan.victim[0], stop[1] - plan.victim[1])).toBeCloseTo(FIGHT_DISTANCE);
    // Auf halbem Weg wirklich unterwegs
    const half = attackerPosition(plan, (plan.runStart + plan.runEnd) / 2);
    expect(half[1]).toBeLessThan(plan.start[1]);
    expect(half[1]).toBeGreaterThan(plan.stop[1]);
  });

  it('stößt das Opfer zurück, legt es hin und lässt es im Brett versinken', () => {
    const plan = planBattle(pawnTakesPawn);
    const before = victimPosition(plan, 0);
    const after = victimPosition(plan, plan.total);
    const pushed = (after[0] - before[0]) * plan.dir[0] + (after[1] - before[1]) * plan.dir[1];
    expect(pushed).toBeGreaterThan(0.1);
    expect(victimSink(plan, plan.sink - 0.01)).toBeCloseTo(0);
    expect(victimSink(plan, plan.total)).toBeLessThan(-0.5);
  });

  it('verwandelt Figuren in Krieger und zurück', () => {
    const plan = planBattle(pawnTakesPawn);
    expect(appearScale(plan, 'a', 0)).toBe(0);
    expect(appearScale(plan, 'a', APPEAR + 0.01)).toBe(1);
    expect(appearScale(plan, 'v', APPEAR + 0.1)).toBe(1);
    expect(appearScale(plan, 'a', plan.total)).toBe(0);
    // Größere Figuren werden größere Krieger
    const queen = planBattle({ ...pawnTakesPawn, attacker: { color: 'w', type: 'q' } });
    expect(queen.scale.a).toBeGreaterThan(plan.scale.a);
  });

  it('nutzt nur Animationen, die das Krieger-Skript mitliefert', () => {
    // Abgleich mit scripts/build-warriors.mjs
    expect(Object.values(WARRIOR_CLIPS.w).map((c) => c.name)).toContain('1H_Melee_Attack_Stab');
    expect(Object.values(WARRIOR_CLIPS.b).map((c) => c.name)).toContain('2H_Melee_Attack_Spin');
    for (const color of ['w', 'b'] as const) {
      for (const role of ['attack1', 'attack2', 'finisher'] as const) expect(WARRIOR_CLIPS[color][role].impact).toBeGreaterThan(0);
    }
  });
});

describe('Kamera im Kampf', () => {
  it('filmt von der Seite des Spielers, schräg von oben, nah genug', () => {
    // Kampf entlang einer Reihe (quer zum Spieler): Kamera auf der Seite des Spielers
    const plan = planBattle({ ...pawnTakesPawn, from: 'c5', victimSquare: 'e5' });
    for (const aspect of [0.46, 1.78]) {
      const white = cinematicView(plan, { aspect, fov: 28, viewSide: 'w', usableHeight: 0.8 });
      const black = cinematicView(plan, { aspect, fov: 28, viewSide: 'b', usableHeight: 0.8 });
      expect(white.position[2]).toBeGreaterThan(plan.mid[1]);
      expect(black.position[2]).toBeLessThan(plan.mid[1]);
      expect(white.position[1]).toBeGreaterThan(white.target[1]);
      const d = Math.hypot(...white.position.map((v, i) => v - white.target[i]) as [number, number, number]);
      expect(d).toBeGreaterThan(2);
      expect(d).toBeLessThan(aspect < 1 ? 14 : 8);
    }
  });

  it('geht im Hochformat weiter zurück als im Querformat', () => {
    const plan = planBattle(pawnTakesPawn);
    const dist = (aspect: number) => {
      const v = cinematicView(plan, { aspect, fov: 28, viewSide: 'w', usableHeight: 0.8 });
      return Math.hypot(...v.position.map((p, i) => p - v.target[i]) as [number, number, number]);
    };
    expect(dist(0.5)).toBeGreaterThan(dist(1.8));
  });
});
