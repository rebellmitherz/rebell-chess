/** Parser für die Textausgaben einer UCI-Engine. */

export interface UciInfo {
  depth?: number;
  multipv?: number;
  /** Bewertung aus Sicht der Seite am Zug, in Centipawns */
  scoreCp?: number;
  /** Matt in n Zügen (positiv = Seite am Zug setzt matt) */
  mate?: number;
  /** obere/untere Schranke statt exakter Bewertung */
  bound?: 'lower' | 'upper';
  nodes?: number;
  pv?: string[];
}

export function parseInfoLine(line: string): UciInfo | null {
  if (!line.startsWith('info ')) return null;
  const tokens = line.trim().split(/\s+/);
  const info: UciInfo = {};
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    switch (t) {
      case 'depth':
        info.depth = Number(tokens[++i]);
        break;
      case 'multipv':
        info.multipv = Number(tokens[++i]);
        break;
      case 'nodes':
        info.nodes = Number(tokens[++i]);
        break;
      case 'score': {
        const kind = tokens[++i];
        const value = Number(tokens[++i]);
        if (kind === 'cp') info.scoreCp = value;
        else if (kind === 'mate') info.mate = value;
        if (tokens[i + 1] === 'lowerbound' || tokens[i + 1] === 'upperbound') {
          info.bound = tokens[++i] === 'lowerbound' ? 'lower' : 'upper';
        }
        break;
      }
      case 'pv':
        info.pv = tokens.slice(i + 1);
        i = tokens.length;
        break;
      case 'string':
        return null;
      default:
        break;
    }
  }
  return info;
}

export function parseBestMove(line: string): { bestMove: string | null; ponder?: string } | null {
  const m = /^bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/.exec(line.trim());
  if (!m) return null;
  return { bestMove: m[1] === '(none)' || m[1] === '0000' ? null : m[1], ponder: m[2] };
}

/** Bewertung in Centipawns; Matt wird auf einen großen Wert abgebildet (näheres Matt = größer). */
export function scoreToCp(scoreCp: number | undefined, mate: number | undefined): number {
  if (mate !== undefined) return mate > 0 ? 100_000 - mate * 100 : -100_000 - mate * 100;
  return scoreCp ?? 0;
}
