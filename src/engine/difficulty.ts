import type { SearchLimits } from './types';

export interface DifficultyLevel {
  id: number;
  name: string;
  /** Grober Richtwert aus Testpartien, keine geprüfte Wertungszahl */
  strength: string;
  description: string;
  limits: SearchLimits;
  /** Abweichung vom besten Zug in Centipawns: die KI wählt zufällig unter den Zügen in diesem Abstand */
  margin?: number;
  /** Eröffnungsbuch nutzen */
  book: boolean;
  /** Wahrscheinlichkeit für einen zufälligen legalen Zug (macht niedrige Stufen menschlicher) */
  randomMoveChance: number;
}

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  {
    id: 1,
    name: 'Einsteiger',
    strength: 'ca. 600 Elo',
    description: 'Macht oft Fehler – ideal zum Lernen der Regeln.',
    limits: { depth: 1 },
    margin: 250,
    book: false,
    randomMoveChance: 0.35,
  },
  {
    id: 2,
    name: 'Anfänger',
    strength: 'ca. 900 Elo',
    description: 'Sieht einfache Drohungen, übersieht aber Taktik.',
    limits: { depth: 1 },
    margin: 130,
    book: false,
    randomMoveChance: 0.15,
  },
  {
    id: 3,
    name: 'Hobbyspieler',
    strength: 'ca. 1300 Elo',
    description: 'Solide Züge mit gelegentlichen Ungenauigkeiten.',
    limits: { depth: 2 },
    margin: 80,
    book: true,
    randomMoveChance: 0.06,
  },
  {
    id: 4,
    name: 'Vereinsspieler',
    strength: 'ca. 1600 Elo',
    description: 'Spielt planvoll und nutzt Fehler aus.',
    limits: { depth: 3 },
    margin: 25,
    book: true,
    randomMoveChance: 0,
  },
  {
    id: 5,
    name: 'Experte',
    strength: 'ca. 2000 Elo',
    description: 'Starke Taktik, kaum grobe Fehler.',
    limits: { depth: 4, movetime: 300 },
    book: true,
    randomMoveChance: 0,
  },
  {
    id: 6,
    name: 'Meister',
    strength: 'ca. 2400 Elo',
    description: 'Meisterniveau – sehr schwer zu schlagen.',
    limits: { movetime: 150 },
    book: true,
    randomMoveChance: 0,
  },
  {
    id: 7,
    name: 'Großmeister',
    strength: 'volle Stärke',
    description: 'Die Rebell-KI ohne Bremse (2 Sekunden pro Zug).',
    limits: { movetime: 2000 },
    book: true,
    randomMoveChance: 0,
  },
];

export function getDifficulty(id: number): DifficultyLevel {
  return DIFFICULTY_LEVELS.find((l) => l.id === id) ?? DIFFICULTY_LEVELS[2];
}
