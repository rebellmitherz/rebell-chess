import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, sanitizePreferences } from '../../src/game/settings';

describe('Gespeicherte Ansicht', () => {
  it('behält 2D, von oben und schräg', () => {
    for (const viewMode of ['flat', 'top', 'perspective'] as const) expect(sanitizePreferences({ viewMode }).viewMode).toBe(viewMode);
  });
  it('fällt bei unbekanntem Wert auf den Standard zurück', () => {
    expect(sanitizePreferences({ viewMode: '2d' }).viewMode).toBe(DEFAULT_PREFERENCES.viewMode);
    expect(sanitizePreferences(null).viewMode).toBe(DEFAULT_PREFERENCES.viewMode);
  });
});
