/** Grenzen einer Suche; was zuerst erreicht ist, beendet sie */
export interface SearchLimits {
  depth?: number;
  /** Bedenkzeit in Millisekunden */
  movetime?: number;
  nodes?: number;
}

export interface SearchResult {
  bestMove: string | null;
  depth: number;
  /** Bewertung aus Sicht der Seite am Zug, in Centipawns */
  scoreCp?: number;
  /** Matt in n Zügen (positiv = Seite am Zug setzt matt) */
  mate?: number;
  pv: string[];
}

/** Bewertung in Centipawns; Matt wird auf einen großen Wert abgebildet (näheres Matt = größer). */
export function scoreToCp(scoreCp: number | undefined, mate: number | undefined): number {
  if (mate !== undefined) return mate > 0 ? 100_000 - mate * 100 : -100_000 - mate * 100;
  return scoreCp ?? 0;
}
