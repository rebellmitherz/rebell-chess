import type { Color } from '../core/types';
import { DIFFICULTY_LEVELS } from '../engine/difficulty';

export type GameMode = 'local' | 'ai';
export type GraphicsQuality = 'high' | 'medium' | 'low';

export interface TimeControl {
  id: string;
  name: string;
  label: string;
  initialMs: number;
  incrementMs: number;
}

const min = (m: number) => m * 60_000;

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'none', name: 'Ohne Uhr', label: '∞', initialMs: 0, incrementMs: 0 },
  { id: '1+0', name: 'Bullet', label: '1 + 0', initialMs: min(1), incrementMs: 0 },
  { id: '3+2', name: 'Blitz', label: '3 + 2', initialMs: min(3), incrementMs: 2000 },
  { id: '5+0', name: 'Blitz', label: '5 + 0', initialMs: min(5), incrementMs: 0 },
  { id: '10+0', name: 'Schnell', label: '10 + 0', initialMs: min(10), incrementMs: 0 },
  { id: '15+10', name: 'Schnell', label: '15 + 10', initialMs: min(15), incrementMs: 10_000 },
  { id: '30+0', name: 'Klassisch', label: '30 + 0', initialMs: min(30), incrementMs: 0 },
];

export function getTimeControl(id: string): TimeControl {
  return TIME_CONTROLS.find((t) => t.id === id) ?? TIME_CONTROLS[0];
}

/** Einstellungen einer Partie */
export interface GameSettings {
  mode: GameMode;
  /** Farbe des menschlichen Spielers gegen die KI */
  humanColor: Color;
  aiLevel: number;
  timeControlId: string;
  /** Trainingsmodus: Hinweise, Zugbewertung, Erklärungen */
  training: boolean;
}

/** Geräte-/Darstellungseinstellungen (unabhängig von der Partie) */
export interface Preferences {
  showLegalMoves: boolean;
  showLastMove: boolean;
  sound: boolean;
  /** Lautstärke 0–1 */
  volume: number;
  graphics: GraphicsQuality;
  /** Lokales Spiel: Brett dreht sich zur Seite am Zug */
  autoRotate: boolean;
  showCoordinates: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'ai',
  humanColor: 'w',
  aiLevel: 3,
  timeControlId: 'none',
  training: false,
};

export function detectDefaultGraphics(): GraphicsQuality {
  if (typeof window === 'undefined') return 'high';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  return coarse ? 'medium' : 'high';
}

export const DEFAULT_PREFERENCES: Preferences = {
  showLegalMoves: true,
  showLastMove: true,
  sound: true,
  volume: 0.8,
  graphics: 'high',
  autoRotate: false,
  showCoordinates: true,
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

export function sanitizeSettings(raw: unknown): GameSettings {
  const r = isObj(raw) ? raw : {};
  return {
    mode: r.mode === 'local' || r.mode === 'ai' ? r.mode : DEFAULT_SETTINGS.mode,
    humanColor: r.humanColor === 'b' ? 'b' : 'w',
    aiLevel: DIFFICULTY_LEVELS.some((l) => l.id === r.aiLevel) ? (r.aiLevel as number) : DEFAULT_SETTINGS.aiLevel,
    timeControlId: TIME_CONTROLS.some((t) => t.id === r.timeControlId) ? (r.timeControlId as string) : 'none',
    training: bool(r.training, false),
  };
}

export function sanitizePreferences(raw: unknown, base: Preferences = DEFAULT_PREFERENCES): Preferences {
  const r = isObj(raw) ? raw : {};
  return {
    showLegalMoves: bool(r.showLegalMoves, base.showLegalMoves),
    showLastMove: bool(r.showLastMove, base.showLastMove),
    sound: bool(r.sound, base.sound),
    volume: typeof r.volume === 'number' && Number.isFinite(r.volume) ? Math.min(1, Math.max(0, r.volume)) : base.volume,
    graphics: r.graphics === 'high' || r.graphics === 'medium' || r.graphics === 'low' ? r.graphics : base.graphics,
    autoRotate: bool(r.autoRotate, base.autoRotate),
    showCoordinates: bool(r.showCoordinates, base.showCoordinates),
  };
}
