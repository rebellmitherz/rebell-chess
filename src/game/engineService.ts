import { ANALYSIS_OPTIONS, type DifficultyLevel } from '../engine/difficulty';
import { StockfishEngine, type EngineTransport, type SearchResult } from '../engine/StockfishEngine';

/** Was der Spielfluss von einer Engine braucht. Im Test durch eine Attrappe ersetzbar. */
export interface EngineService {
  /** Zug der KI auf der gegebenen Stufe (UCI) oder null, wenn kein Zug möglich ist */
  playMove(fen: string, level: DifficultyLevel): Promise<string | null>;
  /** Analyse mit voller Stärke (für Hinweise, Zugbewertung, Remisangebote) */
  analyse(fen: string, depth: number): Promise<SearchResult>;
  /** Neue Partie: Hash leeren */
  newGame(): void;
  /** Engine schon vorab laden (WASM-Download, Initialisierung), damit der erste Zug nicht wartet */
  warmUp(parts: { player: boolean; analysis: boolean }): void;
  /** Laufende KI-Suche abbrechen */
  cancelPlay(): void;
  dispose(): void;
}

/**
 * Zwei getrennte Stockfish-Instanzen: eine spielt, eine analysiert.
 * So blockiert eine Trainingsanalyse nie den Zug der KI.
 */
export function createStockfishService(createTransport: () => EngineTransport): EngineService {
  let player: StockfishEngine | null = null;
  let analyser: StockfishEngine | null = null;

  const getPlayer = async () => {
    if (!player) player = new StockfishEngine(createTransport());
    await player.init();
    return player;
  };
  const getAnalyser = async () => {
    if (!analyser) {
      analyser = new StockfishEngine(createTransport());
      await analyser.init();
      await analyser.setOptions(ANALYSIS_OPTIONS);
    }
    await analyser.init();
    return analyser;
  };

  const reset = (which: 'player' | 'analyser') => {
    if (which === 'player') {
      player?.dispose();
      player = null;
    } else {
      analyser?.dispose();
      analyser = null;
    }
  };

  return {
    async playMove(fen, level) {
      try {
        const engine = await getPlayer();
        await engine.setOptions(level.options);
        const result = await engine.search(fen, level.limits);
        return result.bestMove;
      } catch (err) {
        reset('player');
        throw err;
      }
    },
    async analyse(fen, depth) {
      try {
        const engine = await getAnalyser();
        return await engine.search(fen, { depth });
      } catch (err) {
        reset('analyser');
        throw err;
      }
    },
    newGame() {
      player?.newGame().catch(() => undefined);
      analyser?.newGame().catch(() => undefined);
    },
    warmUp(parts) {
      if (parts.player) getPlayer().catch(() => reset('player'));
      if (parts.analysis) getAnalyser().catch(() => reset('analyser'));
    },
    cancelPlay() {
      player?.stop();
    },
    dispose() {
      reset('player');
      reset('analyser');
    },
  };
}
