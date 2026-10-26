import type { Color } from '../core/types';
import { DIFFICULTY_LEVELS } from '../engine/difficulty';

export type GameMode = 'local' | 'ai';
export type GraphicsQuality = 'high' | 'medium' | 'low';
/** real = Marmorfiguren + Holzbrett mit echten Texturen, classic = Modell in Gold/Onyx („Edel“), rebell = eigene Figuren */
export type PieceStyle = 'real' | 'classic' | 'rebell';
/** top = Brett gerade von oben, Figuren zum Spieler geneigt · perspective = schräge 3D-Ansicht */
export type ViewMode = 'top' | 'perspective';
/** Schlagzüge: warriors = Figuren werden zu Kriegern und kämpfen · quick = kurzer Stoß mit Splittern · off = schlicht */
export type BattleMode = 'warriors' | 'quick' | 'off';

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
  pieceStyle: PieceStyle;
  viewMode: ViewMode;
  /** Darstellung von Schlagzügen */
  battleMode: BattleMode;
  /** Zwei Spieler: Brett dreht sich nach jedem Zug zur Seite am Zug */
  turnBoard: boolean;
  showCoordinates: boolean;
  /** PC: Seitenleiste während der Partie ausgeblendet – das Brett bekommt die ganze Breite */
  hideSidebar: boolean;
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
  pieceStyle: 'real',
  viewMode: 'top',
  battleMode: 'warriors',
  turnBoard: true,
  showCoordinates: true,
  hideSidebar: false,
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

/** Version des gespeicherten Einstellungsformats */
export const PREFS_VERSION = 2;

export function sanitizePreferences(raw: unknown, base: Preferences = DEFAULT_PREFERENCES): Preferences {
  const r = isObj(raw) ? raw : {};
  return {
    showLegalMoves: bool(r.showLegalMoves, base.showLegalMoves),
    showLastMove: bool(r.showLastMove, base.showLastMove),
    sound: bool(r.sound, base.sound),
    volume: typeof r.volume === 'number' && Number.isFinite(r.volume) ? Math.min(1, Math.max(0, r.volume)) : base.volume,
    graphics: r.graphics === 'high' || r.graphics === 'medium' || r.graphics === 'low' ? r.graphics : base.graphics,
    // Bis 0.4 war „classic“ (Gold/Onyx) der Standard – gespeicherte Einstellungen von damals einmalig auf „Echt“ heben
    pieceStyle:
      r.prefsVersion !== PREFS_VERSION && r.pieceStyle === 'classic'
        ? 'real'
        : r.pieceStyle === 'real' || r.pieceStyle === 'classic' || r.pieceStyle === 'rebell'
          ? r.pieceStyle
          : base.pieceStyle,
    // Bis 0.5 gab es nur an/aus („battleAnimations“) – „aus“ bleibt aus, „an“ wird zum Kriegerkampf
    battleMode:
      r.battleMode === 'warriors' || r.battleMode === 'quick' || r.battleMode === 'off'
        ? r.battleMode
        : r.battleAnimations === false
          ? 'off'
          : base.battleMode,
    viewMode: r.viewMode === 'top' || r.viewMode === 'perspective' ? r.viewMode : base.viewMode,
    turnBoard: bool(r.turnBoard, base.turnBoard),
    showCoordinates: bool(r.showCoordinates, base.showCoordinates),
    hideSidebar: bool(r.hideSidebar, base.hideSidebar),
  };
}
