import { PIECE_VALUES, type MoveRecord } from '../core/types';

/**
 * Wann gibt es einen Kriegerkampf? Nicht bei jedem Schlag – sonst nutzt er sich ab und bremst das Spiel.
 * Wichtige Momente: Matt, Dame geschlagen, Turm geschlagen, Schach mit Beute, ein Bauer schlägt eine Figur
 * und jede größere Figur, die mehr einbringt, als sie kostet. Die meisten Schläge laufen als schneller
 * Schlag mit Mini-Explosion ab. Damit der Kampf nie ganz ausbleibt, bekommt der nächste Schlag mit Beute
 * einen, wenn schon mehrere schnelle hintereinander kamen; direkt nach einem Kampf gibt es keinen zweiten
 * (außer bei Matt oder Dame).
 */
export interface BattleHistory {
  /** schnelle Schläge seit dem letzten Kampf */
  quickStreak: number;
  /** Halbzug (Zuglistenlänge) des letzten Kampfes, -Infinity = noch keiner */
  lastFightPly: number;
}

export const FRESH_BATTLE_HISTORY: BattleHistory = { quickStreak: 0, lastFightPly: -Infinity };

/** Nach so vielen schnellen Schlägen ohne Kampf wird der nächste mit Beute ein Kampf */
export const QUICK_STREAK_LIMIT = 4;
/** So viele Halbzüge Pause nach einem Kampf, bevor der nächste „normale“ wichtige Schlag wieder einen bekommt */
export const FIGHT_COOLDOWN_PLIES = 6;

export function isImportantCapture(record: MoveRecord): boolean {
  if (!record.isCapture) return false;
  if (record.isCheckmate) return true;
  const victim = PIECE_VALUES[record.captured ?? 'p'];
  const attacker = PIECE_VALUES[record.piece];
  if (victim >= 5) return true; // Turm oder Dame
  if (record.isCheck && victim >= 3) return true; // Schach mit Beute
  if (victim >= 3 && attacker <= 1) return true; // Bauer schlägt Figur
  if (victim - attacker >= 2) return true; // deutlicher Gewinn (Figur schlägt Turm/Dame ist oben schon drin)
  return false;
}

export function shouldFight(record: MoveRecord, ply: number, history: BattleHistory): boolean {
  if (!record.isCapture) return false;
  const queen = record.captured === 'q';
  if (record.isCheckmate || queen) return true;
  const important = isImportantCapture(record);
  const cooledDown = ply - history.lastFightPly > FIGHT_COOLDOWN_PLIES;
  if (important && cooledDown) return true;
  // Damit der Kampf nicht ganz ausbleibt: nach mehreren schnellen Schlägen ist die nächste Beute dran
  const prize = (record.captured ? PIECE_VALUES[record.captured] : 1) >= 3;
  return history.quickStreak >= QUICK_STREAK_LIMIT && prize && cooledDown;
}

/** Verlauf nach einem Schlagzug fortschreiben */
export function nextHistory(history: BattleHistory, fought: boolean, ply: number): BattleHistory {
  return fought ? { quickStreak: 0, lastFightPly: ply } : { quickStreak: history.quickStreak + 1, lastFightPly: history.lastFightPly };
}
