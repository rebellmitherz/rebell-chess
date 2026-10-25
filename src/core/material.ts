import { isLightSquare, PIECE_VALUES, type BoardPiece, type Color } from './types';

/**
 * Kann `color` den gegnerischen König überhaupt noch mattsetzen (mit irgendeiner Zugfolge)?
 * Wird bei Zeitüberschreitung gebraucht: Fällt das Blättchen, der Gegner kann aber nicht mehr
 * mattsetzen, ist die Partie Remis (FIDE-Regeln 6.9).
 *
 * Bewusst konservativ: im Zweifel „ja“ (dann gewinnt der Gegner auf Zeit).
 */
export function canStillCheckmate(pieces: BoardPiece[], color: Color): boolean {
  const own = pieces.filter((p) => p.color === color && p.type !== 'k');
  const opp = pieces.filter((p) => p.color !== color && p.type !== 'k');

  if (own.some((p) => p.type === 'p' || p.type === 'r' || p.type === 'q')) return true;

  const knights = own.filter((p) => p.type === 'n');
  const bishops = own.filter((p) => p.type === 'b');

  if (knights.length + bishops.length === 0) return false;

  if (knights.length === 0) {
    const ownLight = bishops.some((b) => isLightSquare(b.square));
    const ownDark = bishops.some((b) => !isLightSquare(b.square));
    if (ownLight && ownDark) return true;
    // Nur gleichfarbige Läufer: Matt braucht blockierende gegnerische Figuren,
    // die nicht ausschließlich gleichfarbige Läufer sind.
    return opp.some(
      (p) => p.type !== 'b' || isLightSquare(p.square) !== ownLight,
    );
  }

  if (knights.length + bishops.length >= 2) return true;

  // Ein einzelner Springer: Matt nur möglich, wenn der Gegner noch Figuren hat, die Fluchtfelder verstellen.
  return opp.length > 0;
}

export function materialScore(pieces: BoardPiece[], color: Color): number {
  return pieces
    .filter((p) => p.color === color)
    .reduce((sum, p) => sum + PIECE_VALUES[p.type], 0);
}
