import type { EngineOptions, SearchLimits } from './StockfishEngine';

export interface DifficultyLevel {
  id: number;
  name: string;
  /** Grober Richtwert – die Lite-Engine ist nicht exakt kalibriert */
  strength: string;
  description: string;
  options: EngineOptions;
  limits: SearchLimits;
  /** Wahrscheinlichkeit für einen zufälligen legalen Zug (macht niedrige Stufen menschlicher) */
  randomMoveChance: number;
}

const unlimited = { 'UCI_LimitStrength': false, 'Skill Level': 20 };

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  {
    id: 1,
    name: 'Einsteiger',
    strength: 'ca. 600 Elo',
    description: 'Macht oft Fehler – ideal zum Lernen der Regeln.',
    options: { 'UCI_LimitStrength': false, 'Skill Level': 0 },
    limits: { depth: 1 },
    randomMoveChance: 0.45,
  },
  {
    id: 2,
    name: 'Anfänger',
    strength: 'ca. 900 Elo',
    description: 'Sieht einfache Drohungen, übersieht aber Taktik.',
    options: { 'UCI_LimitStrength': false, 'Skill Level': 0 },
    limits: { depth: 2 },
    randomMoveChance: 0.18,
  },
  {
    id: 3,
    name: 'Hobbyspieler',
    strength: 'ca. 1300 Elo',
    description: 'Solide Züge mit gelegentlichen Ungenauigkeiten.',
    options: { 'UCI_LimitStrength': false, 'Skill Level': 4 },
    limits: { depth: 5, movetime: 400 },
    randomMoveChance: 0.04,
  },
  {
    id: 4,
    name: 'Vereinsspieler',
    strength: 'ca. 1600 Elo',
    description: 'Spielt planvoll und nutzt Fehler aus.',
    options: { 'Skill Level': 20, 'UCI_LimitStrength': true, 'UCI_Elo': 1600 },
    limits: { movetime: 500 },
    randomMoveChance: 0,
  },
  {
    id: 5,
    name: 'Experte',
    strength: 'ca. 2000 Elo',
    description: 'Starke Taktik, kaum grobe Fehler.',
    options: { 'Skill Level': 20, 'UCI_LimitStrength': true, 'UCI_Elo': 2000 },
    limits: { movetime: 800 },
    randomMoveChance: 0,
  },
  {
    id: 6,
    name: 'Meister',
    strength: 'ca. 2400 Elo',
    description: 'Meisterniveau – sehr schwer zu schlagen.',
    options: { 'Skill Level': 20, 'UCI_LimitStrength': true, 'UCI_Elo': 2400 },
    limits: { movetime: 1200 },
    randomMoveChance: 0,
  },
  {
    id: 7,
    name: 'Großmeister',
    strength: 'volle Stärke',
    description: 'Stockfish ohne Bremse (Lite-Netz, 2 Sekunden pro Zug).',
    options: unlimited,
    limits: { movetime: 2000 },
    randomMoveChance: 0,
  },
];

export function getDifficulty(id: number): DifficultyLevel {
  return DIFFICULTY_LEVELS.find((l) => l.id === id) ?? DIFFICULTY_LEVELS[2];
}

/** Einstellungen für Analyse (Hinweise, Zugbewertung): immer volle Stärke. */
export const ANALYSIS_OPTIONS: EngineOptions = unlimited;
