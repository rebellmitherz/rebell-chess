import { describe, expect, it, vi } from 'vitest';
import { ChessGame } from '../../src/core/chessGame';
import type { SearchResult } from '../../src/engine/StockfishEngine';
import type { EngineService } from '../../src/game/engineService';
import { MemoryStorage, SAVE_KEY } from '../../src/game/persistence';
import { DEFAULT_SETTINGS, type GameSettings } from '../../src/game/settings';
import { createGameStore } from '../../src/game/store';

/** Test-Engine: spielt den ersten legalen Zug (oder vorgegebene Züge), Analyse liefert feste Werte. */
function fakeEngine(opts: { moves?: string[]; analyse?: (fen: string) => Partial<SearchResult> } = {}) {
  const queue = [...(opts.moves ?? [])];
  const engine: EngineService & { playMove: ReturnType<typeof vi.fn> } = {
    playMove: vi.fn(async (fen: string) => queue.shift() ?? new ChessGame(fen).allLegalMoves()[0]?.uci ?? null),
    analyse: vi.fn(async (fen: string) => {
      const custom = opts.analyse?.(fen) ?? {};
      return { bestMove: new ChessGame(fen).allLegalMoves()[0]?.uci ?? null, depth: 10, pv: [], scoreCp: 0, ...custom };
    }),
    newGame: vi.fn(),
    warmUp: vi.fn(),
    cancelPlay: vi.fn(),
    dispose: vi.fn(),
  };
  return engine;
}

function setup(settings: Partial<GameSettings> = {}, engine: EngineService | null = fakeEngine()) {
  let time = 1_000_000;
  const storage = new MemoryStorage();
  const store = createGameStore({ engine, storage, now: () => time, random: () => 0.99, aiDelayMs: 0 });
  store.getState().startGame({ ...DEFAULT_SETTINGS, mode: 'local', ...settings });
  return {
    store,
    storage,
    engine,
    advance: (ms: number) => {
      time += ms;
    },
    click: (...squares: string[]) => squares.forEach((sq) => store.getState().selectSquare(sq as never)),
  };
}

describe('Lokale Partie', () => {
  it('wählt Figuren aus, zeigt Ziele und zieht', () => {
    const { store, click } = setup();
    click('e2');
    expect(store.getState().selected).toBe('e2');
    expect(store.getState().targets.map((t) => t.to).sort()).toEqual(['e3', 'e4']);
    click('e4');
    const s = store.getState();
    expect(s.history.map((m) => m.san)).toEqual(['e4']);
    expect(s.status.turn).toBe('b');
    expect(s.selected).toBeNull();
    expect(s.pieces.find((p) => p.id === 'wp-e2')?.square).toBe('e4');
  });

  it('ignoriert gegnerische Figuren und illegale Ziele', () => {
    const { store, click } = setup();
    click('e7');
    expect(store.getState().selected).toBeNull();
    click('e2', 'e5');
    expect(store.getState().history).toHaveLength(0);
    expect(store.getState().selected).toBeNull();
  });

  it('Drag & Drop: legales Ziel zieht, Ausgangsfeld behält Auswahl, illegales Ziel bricht ab', () => {
    const { store } = setup();
    store.getState().dropPiece('e2', 'e5');
    expect(store.getState().history).toHaveLength(0);
    expect(store.getState().selected).toBeNull();
    store.getState().dropPiece('e2', 'e2');
    expect(store.getState().selected).toBe('e2');
    expect(store.getState().targets.map((t) => t.to).sort()).toEqual(['e3', 'e4']);
    store.getState().dropPiece('e2', null); // neben das Brett
    expect(store.getState().selected).toBeNull();
    store.getState().dropPiece('g1', 'f3');
    expect(store.getState().history.map((m) => m.san)).toEqual(['Nf3']);
    store.getState().dropPiece('f3', 'e5'); // Schwarz ist am Zug – Weiß darf nicht ziehen
    expect(store.getState().history).toHaveLength(1);
  });

  it('fragt bei der Bauernumwandlung nach der Figur', () => {
    const { store } = setup();
    store.getState().importPgn('[FEN "8/P6k/8/8/8/8/8/K7 w - - 0 1"]\n[SetUp "1"]\n\n*');
    store.getState().tryMove('a7', 'a8');
    expect(store.getState().pendingPromotion).toEqual({ from: 'a7', to: 'a8' });
    store.getState().choosePromotion('n');
    expect(store.getState().history.at(-1)?.san).toBe('a8=N');
    expect(store.getState().pieces.find((p) => p.square === 'a8')?.type).toBe('n');
  });

  it('nimmt im lokalen Spiel genau einen Halbzug zurück', () => {
    const { store, click } = setup();
    click('e2', 'e4', 'e7', 'e5');
    store.getState().undo();
    expect(store.getState().history.map((m) => m.san)).toEqual(['e4']);
    expect(store.getState().status.turn).toBe('b');
  });

  it('erkennt Matt und blockiert weitere Eingaben', () => {
    const { store, click } = setup();
    click('f2', 'f3', 'e7', 'e5', 'g2', 'g4', 'd8', 'h4');
    expect(store.getState().result).toEqual({ winner: 'b', reason: 'checkmate' });
    click('a2');
    expect(store.getState().selected).toBeNull();
    store.getState().undo();
    expect(store.getState().result).toBeNull();
  });

  it('Aufgabe und Remis durch Einigung', () => {
    const a = setup();
    a.click('e2', 'e4');
    a.store.getState().resign(); // Schwarz am Zug gibt auf
    expect(a.store.getState().result).toEqual({ winner: 'w', reason: 'resignation' });

    const b = setup();
    b.store.getState().offerDraw();
    expect(b.store.getState().drawOffer).toEqual({ by: 'w' });
    b.click('e2');
    expect(b.store.getState().selected).toBeNull(); // während des Angebots keine Züge
    b.store.getState().answerDraw(true);
    expect(b.store.getState().result).toEqual({ winner: null, reason: 'agreement' });
  });
});

describe('Schachuhr im Spielfluss', () => {
  it('Zeitüberschreitung verliert', () => {
    const { store, click, advance } = setup({ timeControlId: '1+0' });
    click('e2', 'e4');
    advance(30_000);
    store.getState().tick();
    expect(store.getState().result).toBeNull();
    advance(30_001);
    store.getState().tick();
    expect(store.getState().result).toEqual({ winner: 'w', reason: 'timeout' });
  });

  it('Zeitüberschreitung ist Remis, wenn der Gegner nicht mehr mattsetzen kann', () => {
    const { store, advance } = setup();
    // Weiß hat nur den König, Schwarz König + Bauer. Fällt Schwarz' Blättchen, ist es Remis (FIDE 6.9).
    store.getState().startGame({ ...DEFAULT_SETTINGS, mode: 'local', timeControlId: '1+0' }, '4k3/4p3/8/8/8/8/8/4K3 w - - 0 1');
    store.getState().tryMove('e1', 'd1');
    advance(60_000);
    store.getState().tick();
    expect(store.getState().result).toEqual({ winner: null, reason: 'timeout-insufficient-material' });
    expect(store.getState().clock.remaining.b).toBe(0);
  });

  it('Pause hält die Uhr an', () => {
    const { store, click, advance } = setup({ timeControlId: '1+0' });
    click('e2', 'e4');
    store.getState().setPaused(true);
    advance(120_000);
    store.getState().tick();
    expect(store.getState().result).toBeNull();
    click('e7');
    expect(store.getState().selected).toBeNull();
    store.getState().setPaused(false);
    click('e7', 'e5');
    expect(store.getState().history).toHaveLength(2);
    expect(store.getState().clock.remaining.b).toBe(60_000);
  });

  it('Rückgängig stellt die Zeiten wieder her', () => {
    const { store, click, advance } = setup({ timeControlId: '3+2' });
    click('e2', 'e4');
    advance(10_000);
    click('e7', 'e5');
    expect(store.getState().clock.remaining.b).toBe(172_000);
    store.getState().undo();
    expect(store.getState().clock.remaining.b).toBe(170_000);
    expect(store.getState().clock.running).toBe('b');
  });
});

describe('Partie gegen die KI', () => {
  it('die KI antwortet auf den Zug des Menschen', async () => {
    const engine = fakeEngine({ moves: ['e7e5'] });
    const { store, click } = setup({ mode: 'ai', humanColor: 'w' }, engine);
    click('e2', 'e4');
    await vi.waitFor(() => expect(store.getState().history).toHaveLength(2));
    expect(store.getState().history[1].san).toBe('e5');
    expect(store.getState().engineThinking).toBe(false);
    expect(engine.playMove).toHaveBeenCalledTimes(1);
  });

  it('die KI eröffnet, wenn der Mensch Schwarz spielt', async () => {
    const { store } = setup({ mode: 'ai', humanColor: 'b' }, fakeEngine({ moves: ['d2d4'] }));
    await vi.waitFor(() => expect(store.getState().history.map((m) => m.san)).toEqual(['d4']));
    expect(store.getState().viewSide).toBe('b');
  });

  it('Rückgängig nimmt KI-Zug und eigenen Zug zurück', async () => {
    const { store, click } = setup({ mode: 'ai', humanColor: 'w' }, fakeEngine({ moves: ['e7e5'] }));
    click('e2', 'e4');
    await vi.waitFor(() => expect(store.getState().history).toHaveLength(2));
    store.getState().undo();
    expect(store.getState().history).toHaveLength(0);
    expect(store.getState().status.turn).toBe('w');
    expect(store.getState().engineThinking).toBe(false);
  });

  it('der Mensch kann nicht für die KI ziehen', async () => {
    const { store, click } = setup({ mode: 'ai', humanColor: 'w' }, fakeEngine({ moves: ['e7e5'] }));
    click('e2', 'e4');
    click('d7');
    expect(store.getState().selected).toBeNull();
    await vi.waitFor(() => expect(store.getState().history).toHaveLength(2));
  });

  it('spielt einen Ersatzzug, wenn die Engine ausfällt', async () => {
    const broken = fakeEngine();
    broken.playMove.mockRejectedValue(new Error('Worker kaputt'));
    const { store, click } = setup({ mode: 'ai', humanColor: 'w' }, broken);
    click('e2', 'e4');
    await vi.waitFor(() => expect(store.getState().history).toHaveLength(2));
    expect(store.getState().engineError).toBe('Worker kaputt');
    expect(store.getState().toast?.text).toContain('Ersatzzug');
  });

  it('Stockfish nimmt Remis nur in schlechterer Stellung an', async () => {
    // Mensch (Weiß) am Zug, Bewertung +300 für Weiß → KI steht schlecht → nimmt an
    const { store } = setup({ mode: 'ai', humanColor: 'w' }, fakeEngine({ analyse: () => ({ scoreCp: 300 }) }));
    store.getState().offerDraw();
    await vi.waitFor(() => expect(store.getState().result).toEqual({ winner: null, reason: 'agreement' }));

    const b = setup({ mode: 'ai', humanColor: 'w' }, fakeEngine({ analyse: () => ({ scoreCp: -200 }) }));
    b.store.getState().offerDraw();
    await vi.waitFor(() => expect(b.store.getState().toast?.text).toContain('lehnt'));
    expect(b.store.getState().result).toBeNull();
  });
});

describe('Training', () => {
  it('liefert einen Hinweis mit Zielfeldern und Erklärung', async () => {
    const engine = fakeEngine({ analyse: () => ({ bestMove: 'g1f3', scoreCp: 30 }) });
    const { store } = setup({ training: true }, engine);
    store.getState().requestHint();
    expect(store.getState().hint?.status).toBe('loading');
    await vi.waitFor(() => expect(store.getState().hint?.status).toBe('ready'));
    expect(store.getState().hint).toMatchObject({ from: 'g1', to: 'f3', title: 'Springer g1–f3' });
  });

  it('bewertet den gespielten Zug und nennt den besseren', async () => {
    // Vor dem Zug: bester Zug d2d4 mit +40. Nach dem gespielten Zug: Gegner steht +250 → gespielt = -250
    const engine = fakeEngine({
      analyse: (fen) => (fen.includes(' w ') ? { bestMove: 'd2d4', scoreCp: 40 } : { bestMove: 'e7e5', scoreCp: 250 }),
    });
    const { store, click } = setup({ training: true }, engine);
    click('f2', 'f3');
    expect(store.getState().feedback?.status).toBe('loading');
    await vi.waitFor(() => expect(store.getState().feedback?.status).toBe('ready'));
    const fb = store.getState().feedback!;
    expect(fb.classification?.quality).toBe('mistake');
    expect(fb.better?.san).toBe('d4');
  });
});

describe('Speichern und Laden', () => {
  it('speichert automatisch und setzt die Partie fort', () => {
    const { storage, click, store } = setup({ timeControlId: '5+0' });
    click('e2', 'e4', 'e7', 'e5', 'g1', 'f3');
    expect(storage.getItem(SAVE_KEY)).toContain('g1f3');

    const reloaded = createGameStore({ storage, now: () => 2_000_000, aiDelayMs: 0 });
    expect(reloaded.getState().hasSave).toBe(true);
    expect(reloaded.getState().continueSaved()).toBe(true);
    const s = reloaded.getState();
    expect(s.history.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(s.settings.timeControlId).toBe('5+0');
    expect(s.paused).toBe(true); // Uhr läuft erst nach „Fortsetzen“
    expect(s.clockSnapshots).toHaveLength(3);
    expect(store.getState().fen).toBe(s.fen);
  });

  it('verwirft beschädigte oder regelwidrige Spielstände', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{"version":1,"startFen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","moves":["e2e5"]}');
    const store = createGameStore({ storage });
    expect(store.getState().hasSave).toBe(false);
    expect(store.getState().continueSaved()).toBe(false);
    storage.setItem(SAVE_KEY, 'kein json');
    expect(createGameStore({ storage }).getState().hasSave).toBe(false);
  });

  it('exportiert PGN mit Kopfzeilen und importiert sie wieder', () => {
    const { store, click } = setup();
    click('e2', 'e4', 'c7', 'c5');
    const pgn = store.getState().exportPgn();
    expect(pgn).toContain('[White "Weiß"]');
    expect(pgn).toContain('1. e4 c5');
    const other = setup();
    expect(other.store.getState().importPgn(pgn)).toBe(true);
    expect(other.store.getState().history.map((m) => m.san)).toEqual(['e4', 'c5']);
    expect(other.store.getState().importPgn('Unsinn 1. Kx9')).toBe(false);
  });

  it('merkt sich Einstellungen', () => {
    const { store, storage } = setup();
    store.getState().setPrefs({ sound: false, graphics: 'low', volume: 0.35 });
    const again = createGameStore({ storage });
    expect(again.getState().prefs).toMatchObject({ sound: false, graphics: 'low', volume: 0.35 });
    // Kaputte Werte werden begrenzt bzw. ersetzt
    storage.setItem('rebellchess.prefs.v1', JSON.stringify({ volume: 7, graphics: 'ultra' }));
    expect(createGameStore({ storage }).getState().prefs).toMatchObject({ volume: 1, graphics: 'high' });
    // Alte Einstellungen (vor 0.5) mit Gold-Stil werden einmalig auf „Echt“ gehoben, neue Wahl bleibt erhalten
    storage.setItem('rebellchess.prefs.v1', JSON.stringify({ pieceStyle: 'classic' }));
    expect(createGameStore({ storage }).getState().prefs.pieceStyle).toBe('real');
    const chosen = createGameStore({ storage });
    chosen.getState().setPrefs({ pieceStyle: 'classic' });
    expect(createGameStore({ storage }).getState().prefs.pieceStyle).toBe('classic');
  });
});

describe('Analyse-Modus', () => {
  it('zeigt frühere Stellungen und sperrt dabei Eingaben', () => {
    const { store, click } = setup();
    click('e2', 'e4', 'e7', 'e5', 'g1', 'f3');
    store.getState().viewMove(1);
    const s = store.getState();
    expect(s.viewPly).toBe(1);
    expect(s.view!.pieces.find((p) => p.id === 'wp-e2')?.square).toBe('e4');
    expect(s.view!.pieces.find((p) => p.id === 'bp-e7')?.square).toBe('e7');
    expect(s.view!.pieces.find((p) => p.id === 'wn-g1')?.square).toBe('g1');
    // Live-Stellung bleibt unverändert
    expect(s.pieces.find((p) => p.id === 'wn-g1')?.square).toBe('f3');
    click('b8');
    expect(store.getState().selected).toBeNull();
    store.getState().stepView(-5);
    expect(store.getState().viewPly).toBe(0);
    store.getState().stepView(+10); // über das Ende hinaus = zurück zur Partie
    expect(store.getState().viewPly).toBeNull();
    click('b8');
    expect(store.getState().selected).toBe('b8');
  });

  it('Rückgängig beendet die Analyse-Ansicht', () => {
    const { store, click } = setup();
    click('e2', 'e4', 'e7', 'e5');
    store.getState().viewMove(0);
    store.getState().undo();
    expect(store.getState().viewPly).toBeNull();
    expect(store.getState().history).toHaveLength(1);
  });

  it('bewertet die gezeigte Stellung nur im Training oder nach Partieende', async () => {
    // Engine meldet +50 aus Sicht der Seite am Zug
    const engine = fakeEngine({ analyse: () => ({ scoreCp: 50, bestMove: null }) });
    const normal = setup({ training: false }, engine);
    normal.click('e2', 'e4');
    normal.store.getState().viewMove(0);
    await new Promise((r) => setTimeout(r, 10));
    expect(normal.store.getState().analysis).toBeNull();

    const training = setup({ training: true }, fakeEngine({ analyse: () => ({ scoreCp: 50, bestMove: 'e7e5' }) }));
    training.click('e2', 'e4');
    // Schwarz am Zug, +50 für Schwarz = -50 aus Sicht von Weiß
    await vi.waitFor(() => expect(training.store.getState().analysis?.status).toBe('ready'));
    expect(training.store.getState().analysis).toMatchObject({ cp: -50, best: 'e5' });
    training.store.getState().viewMove(0);
    await vi.waitFor(() => expect(training.store.getState().analysis?.cp).toBe(50));
  });

  it('zeigt nach Matt die Mattbewertung ohne Engine-Aufruf', () => {
    const engine = fakeEngine();
    const { store, click } = setup({}, engine);
    click('f2', 'f3', 'e7', 'e5', 'g2', 'g4', 'd8', 'h4');
    expect(store.getState().analysis).toMatchObject({ status: 'ready', mate: -1 });
  });
});

describe('Zwei Spieler an einem Gerät', () => {
  it('dreht das Brett nach jedem Zug zum Spieler am Zug (nach kurzer Verzögerung)', async () => {
    const store = createGameStore({ storage: new MemoryStorage(), aiDelayMs: 0, boardTurnDelayMs: 5 });
    store.getState().startGame({ ...DEFAULT_SETTINGS, mode: 'local' });
    expect(store.getState().viewSide).toBe('w');
    store.getState().tryMove('e2', 'e4');
    expect(store.getState().viewSide).toBe('w'); // erst Landung abwarten
    await vi.waitFor(() => expect(store.getState().viewSide).toBe('b'));
    store.getState().tryMove('e7', 'e5');
    await vi.waitFor(() => expect(store.getState().viewSide).toBe('w'));
  });

  it('lässt das Brett stehen, wenn das Drehen abgeschaltet ist', async () => {
    const store = createGameStore({ storage: new MemoryStorage(), aiDelayMs: 0, boardTurnDelayMs: 5 });
    store.getState().setPrefs({ turnBoard: false });
    store.getState().startGame({ ...DEFAULT_SETTINGS, mode: 'local' });
    store.getState().tryMove('e2', 'e4');
    await new Promise((r) => setTimeout(r, 30));
    expect(store.getState().viewSide).toBe('w');
  });
});
