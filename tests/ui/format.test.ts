import { describe, expect, it } from 'vitest';
import { battleTitle } from '../../src/ui/format';

describe('Überschrift des Kriegerkampfs', () => {
  it('beugt Farbe und Figur richtig', () => {
    expect(battleTitle({ attacker: { color: 'w', type: 'p' }, victim: { color: 'b', type: 'p' } })).toBe(
      'Weißer Bauer schlägt schwarzen Bauern',
    );
    expect(battleTitle({ attacker: { color: 'b', type: 'q' }, victim: { color: 'w', type: 'n' } })).toBe(
      'Schwarze Dame schlägt weißen Springer',
    );
    expect(battleTitle({ attacker: { color: 'w', type: 'k' }, victim: { color: 'b', type: 'q' } })).toBe(
      'Weißer König schlägt schwarze Dame',
    );
  });
});
