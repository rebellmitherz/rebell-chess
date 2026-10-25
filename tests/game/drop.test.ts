import { describe, expect, it } from 'vitest';
import { resolveDrop } from '../../src/game/drop';

const targets = [
  { to: 'e3' as const, isCapture: false, isPromotion: false },
  { to: 'e4' as const, isCapture: false, isPromotion: false },
];

describe('Loslassen einer gezogenen Figur', () => {
  it('zieht auf ein legales Zielfeld', () => {
    expect(resolveDrop('e2', 'e4', targets)).toEqual({ kind: 'move', to: 'e4' });
  });
  it('behält die Auswahl auf dem Ausgangsfeld', () => {
    expect(resolveDrop('e2', 'e2', targets)).toEqual({ kind: 'keep' });
  });
  it('bricht bei illegalem Feld oder außerhalb des Bretts ab', () => {
    expect(resolveDrop('e2', 'e5', targets)).toEqual({ kind: 'cancel' });
    expect(resolveDrop('e2', null, targets)).toEqual({ kind: 'cancel' });
  });
});
