import type { MoveOption, Square } from '../core/types';

export type DropAction = { kind: 'move'; to: Square } | { kind: 'keep' } | { kind: 'cancel' };

/**
 * Was passiert, wenn eine gezogene Figur losgelassen wird?
 * - auf einem legalen Zielfeld: Zug
 * - auf dem Ausgangsfeld: Auswahl bleibt (danach kann per Klick gezogen werden)
 * - sonst (illegal, neben dem Brett): Figur springt zurück, Auswahl wird aufgehoben
 */
export function resolveDrop(from: Square, over: Square | null, targets: MoveOption[]): DropAction {
  if (over === from) return { kind: 'keep' };
  if (over && targets.some((t) => t.to === over)) return { kind: 'move', to: over };
  return { kind: 'cancel' };
}
