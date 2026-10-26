import { describe, expect, it } from 'vitest';
import {
  actorPosition,
  APPEAR,
  appearScale,
  cinematicView,
  MIN_DISTANCE,
  planBattle,
  SCENARIOS,
  shotView,
  timeScale,
  victimSink,
  type BattleInput,
  type MoveLibrary,
  type ShotKind,
} from '../../src/scene/battleScript';

/** Kleine Test-Bibliothek in der Art der Mixamo-Bewegungen (mit und ohne Fortbewegung) */
const LIB: MoveLibrary = {
  idle: [{ name: 'idle', role: 'idle', duration: 2 }],
  run: [{ name: 'run', role: 'run', duration: 0.8 }],
  attack: [
    { name: 'slash', role: 'attack', duration: 1.2, impact: 0.5 },
    { name: 'slash 2', role: 'attack', duration: 1.0, impact: 0.42, root: [[0, 0, 0], [0.5, 0.25, 0], [1, 0.5, 0]] },
    { name: 'attack 3', role: 'attack', duration: 1.3, impact: 0.62 },
  ],
  heavy: [{ name: 'jump attack', role: 'heavy', duration: 1.6, impact: 0.8, root: [[0, 0, 0], [1, 0.6, 0]] }],
  kick: [{ name: 'kick', role: 'kick', duration: 1.1, impact: 0.45 }],
  block: [{ name: 'block', role: 'block', duration: 1 }],
  impact: [
    { name: 'impact', role: 'impact', duration: 0.8 },
    { name: 'impact 2', role: 'impact', duration: 0.9, root: [[0, 0, 0], [1, -0.3, 0]] },
  ],
  death: [
    { name: 'death', role: 'death', duration: 2.2, impact: 1.1, root: [[0, 0, 0], [0.5, -0.5, 0], [1, -0.8, 0]] },
    { name: 'death 2', role: 'death', duration: 1.8, impact: 0.9 },
  ],
  taunt: [{ name: 'power up', role: 'taunt', duration: 1.8 }],
};
const OPTS = { library: { w: LIB, b: LIB } };

const pawnTakesPawn: BattleInput = { from: 'e4', victimSquare: 'd5', attacker: { color: 'w', type: 'p' }, victim: { color: 'b', type: 'p' } };
const rookAcrossBoard: BattleInput = { from: 'a1', victimSquare: 'a8', attacker: { color: 'w', type: 'r' }, victim: { color: 'b', type: 'r' } };
const pawnTakesQueen: BattleInput = { from: 'e4', victimSquare: 'd5', attacker: { color: 'b', type: 'p' }, victim: { color: 'w', type: 'q' } };
const queenTakesPawn: BattleInput = { from: 'd1', victimSquare: 'd5', attacker: { color: 'w', type: 'q' }, victim: { color: 'b', type: 'p' } };

const names = new Set(Object.values(LIB).flat().map((c) => c.name));

describe('Drehbuch des Kriegerkampfs', () => {
  it('würfelt viele verschiedene Kämpfe – alle Szenarien kommen vor', () => {
    const seen = new Set<string>();
    const signatures = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const plan = planBattle(pawnTakesPawn, { ...OPTS, seed });
      seen.add(plan.scenario);
      if (seed <= 30) signatures.add(plan.scenario + plan.cues.map((c) => c.clip).join(',') + plan.shots.map((s) => s.kind).join(','));
    }
    expect([...seen].sort()).toEqual(Object.keys(SCENARIOS).sort());
    // 30 Kämpfe derselben Figuren: fast alle sehen anders aus
    expect(signatures.size).toBeGreaterThanOrEqual(26);
  });

  it('wiederholt die zuletzt gespielten Szenarien nicht', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const plan = planBattle(pawnTakesPawn, { ...OPTS, seed, avoid: ['duel', 'kick'] });
      expect(['duel', 'kick']).not.toContain(plan.scenario);
    }
  });

  it('passt das Szenario den Figuren an: Bauer gegen Dame kämpft länger als Dame gegen Bauer', () => {
    const count = (input: BattleInput, scenario: string) => {
      let n = 0;
      for (let seed = 1; seed <= 400; seed++) if (planBattle(input, { ...OPTS, seed }).scenario === scenario) n++;
      return n;
    };
    expect(count(pawnTakesQueen, 'comeback')).toBeGreaterThan(count(queenTakesPawn, 'comeback') * 2);
    expect(count(queenTakesPawn, 'blitz')).toBeGreaterThan(count(pawnTakesQueen, 'blitz') * 2);
  });

  for (const scenario of Object.keys(SCENARIOS)) {
    it(`Szenario „${scenario}“ ist schlüssig`, () => {
      for (const input of [pawnTakesPawn, rookAcrossBoard]) {
        for (let seed = 1; seed <= 12; seed++) {
          const plan = planBattle(input, { ...OPTS, seed, scenario });
          // genau ein tödlicher Treffer, er ist der letzte und kommt vom Angreifer
          const kills = plan.hits.filter((h) => h.result === 'kill');
          expect(kills).toHaveLength(1);
          expect(plan.hits.at(-1)).toMatchObject({ by: 'a', result: 'kill', t: plan.deathAt });
          expect(plan.hits.map((h) => h.t)).toEqual([...plan.hits.map((h) => h.t)].sort((a, b) => a - b));
          // nur Bewegungen aus der Bibliothek, das Opfer bewegt sich nach dem Tod nicht mehr selbst
          for (const c of plan.cues) expect(names).toContain(c.clip);
          expect(plan.cues.filter((c) => c.actor === 'v' && c.t > plan.deathAt + 1e-9)).toHaveLength(0);
          expect(plan.cues.find((c) => c.actor === 'v' && c.role === 'death')?.t).toBeCloseTo(plan.deathAt);
          // Ablauf: Tod → Versinken → Rückverwandlung
          expect(plan.sink).toBeGreaterThan(plan.deathAt);
          expect(plan.outro).toBeGreaterThan(plan.sink);
          expect(plan.total).toBeGreaterThan(2.4);
          expect(plan.total).toBeLessThan(9);
          // niemand läuft durch den anderen hindurch
          for (let t = plan.runEnd; t < plan.deathAt; t += 0.05) {
            const a = actorPosition(plan, 'a', t);
            const v = actorPosition(plan, 'v', t);
            expect(Math.hypot(a[0] - v[0], a[1] - v[1])).toBeGreaterThan(MIN_DISTANCE * 0.95);
          }
        }
      }
    });
  }

  it('begrenzt den Anlauf auch über das ganze Brett', () => {
    const plan = planBattle(rookAcrossBoard, { ...OPTS, seed: 7 });
    expect(plan.runEnd - plan.runStart).toBeLessThanOrEqual(1.0 + 1e-9);
    expect(plan.cues.some((c) => c.role === 'run' && c.actor === 'a')).toBe(true);
    expect(plan.fx.filter((f) => f.kind === 'step').length).toBeGreaterThan(3);
    expect(actorPosition(plan, 'a', 0)).toEqual(plan.start);
    expect(actorPosition(plan, 'a', plan.runEnd)).toEqual(plan.stop);
  });

  it('stößt das Opfer zurück, lässt es im Brett versinken und verwandelt die Krieger', () => {
    const plan = planBattle(pawnTakesPawn, { ...OPTS, seed: 3, scenario: 'duel' });
    const before = actorPosition(plan, 'v', 0);
    const after = actorPosition(plan, 'v', plan.total);
    const pushed = (after[0] - before[0]) * plan.dir[0] + (after[1] - before[1]) * plan.dir[1];
    expect(pushed).toBeGreaterThan(0.1);
    expect(victimSink(plan, plan.sink - 0.01)).toBeCloseTo(0);
    expect(victimSink(plan, plan.total)).toBeLessThan(-0.5);
    expect(appearScale(plan, 'a', 0)).toBe(0);
    expect(appearScale(plan, 'a', APPEAR + 0.01)).toBe(1);
    expect(appearScale(plan, 'a', plan.total)).toBe(0);
  });

  it('Zeitlupe beim Todesstoß, kurzes Anhalten bei Treffern', () => {
    const plan = planBattle(pawnTakesPawn, { ...OPTS, seed: 5, scenario: 'trade' });
    expect(timeScale(plan, plan.deathAt + 0.1)).toBeLessThan(0.5);
    const hit = plan.hits.find((h) => h.result === 'hit')!;
    expect(timeScale(plan, hit.t + 0.02)).toBeLessThan(0.2);
    expect(timeScale(plan, plan.deathAt + 1)).toBe(1);
  });
});

describe('Kamera im Kampf', () => {
  const opts = (aspect: number, viewSide: 'w' | 'b' = 'w') => ({ aspect, fov: 28, viewSide, usableHeight: 0.8 });

  it('beginnt mit der Totale, schneidet vor dem Todesstoß auf eine Nahaufnahme', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const plan = planBattle(pawnTakesPawn, { ...OPTS, seed });
      expect(plan.shots[0]).toMatchObject({ t: 0, kind: 'side' });
      const killShot = plan.shots.find((s) => s.t <= plan.deathAt && s.t >= plan.deathAt - 0.4 && (s.kind === 'close' || s.kind === 'low'));
      expect(killShot, `Seed ${seed}`).toBeDefined();
    }
  });

  it('Totale von der Seite des Spielers', () => {
    const plan = planBattle({ ...pawnTakesPawn, from: 'c5', victimSquare: 'e5' }, { ...OPTS, seed: 1 });
    for (const aspect of [0.46, 1.78]) {
      expect(cinematicView(plan, opts(aspect, 'w')).position[2]).toBeGreaterThan(plan.victim[1]);
      expect(cinematicView(plan, opts(aspect, 'b')).position[2]).toBeLessThan(plan.victim[1]);
    }
  });

  it('jede Einstellung bleibt über dem Brett und hält Abstand zu den Kriegern', () => {
    const kinds: ShotKind[] = ['side', 'overA', 'overV', 'low', 'close', 'hero', 'high'];
    for (const input of [pawnTakesPawn, rookAcrossBoard, queenTakesPawn]) {
      const plan = planBattle(input, { ...OPTS, seed: 11 });
      for (const kind of kinds) {
        for (const aspect of [0.46, 1.78]) {
          const t = plan.deathAt - 0.2;
          const view = shotView(plan, kind, t, opts(aspect));
          expect(view.position[1], kind).toBeGreaterThan(0.1);
          const d = Math.hypot(...(view.position.map((p, i) => p - view.target[i]) as [number, number, number]));
          expect(d, kind).toBeGreaterThan(0.6);
          expect(d, kind).toBeLessThan(25);
        }
      }
    }
  });
});
