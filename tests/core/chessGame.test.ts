import { describe, expect, it } from 'vitest';
import { ChessGame, parsePgn, parseUci, START_FEN } from '../../src/core/chessGame';

const play = (game: ChessGame, moves: string[]) => {
  for (const m of moves) {
    const r = game.moveUci(m);
    if (!r) throw new Error(`Zug ${m} wurde abgelehnt`);
  }
};

describe('Grundstellung und Zuggenerierung', () => {
  it('hat 20 legale Züge in der Grundstellung', () => {
    const g = new ChessGame();
    expect(g.allLegalMoves()).toHaveLength(20);
    expect(g.turn).toBe('w');
    expect(g.status()).toEqual({ turn: 'w', inCheck: false, checkSquare: null, result: null });
  });

  it('liefert die Zielfelder einer Figur', () => {
    const g = new ChessGame();
    expect(g.legalMovesFrom('g1').map((m) => m.to).sort()).toEqual(['f3', 'h3']);
    expect(g.legalMovesFrom('e2').map((m) => m.to).sort()).toEqual(['e3', 'e4']);
    expect(g.legalMovesFrom('e1')).toEqual([]);
  });

  it('lehnt illegale Züge ab und lässt die Partie unverändert', () => {
    const g = new ChessGame();
    expect(g.move({ from: 'e2', to: 'e5' })).toBeNull();
    expect(g.moveUci('e7e5')).toBeNull(); // Schwarz ist nicht am Zug
    expect(g.fen).toBe(START_FEN);
  });

  it('verbietet Züge, die den eigenen König im Schach lassen (Fesselung)', () => {
    // Weißer Springer e2 ist durch den Turm e8 an den König e1 gefesselt
    const g = new ChessGame('4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1');
    expect(g.legalMovesFrom('e2')).toEqual([]);
  });

  it('erzwingt eine Schachabwehr', () => {
    const g = new ChessGame('4k3/8/8/8/8/8/3P4/r3K3 w - - 0 1');
    expect(g.status().inCheck).toBe(true);
    expect(g.status().checkSquare).toBe('e1');
    const moves = g.allLegalMoves().map((m) => m.uci).sort();
    expect(moves).toEqual(['e1e2', 'e1f2']);
  });
});

describe('Rochade', () => {
  it('kurze und lange Rochade für Weiß', () => {
    const g = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const short = g.moveUci('e1g1')!;
    expect(short.isKingsideCastle).toBe(true);
    expect(g.pieceAt('f1')?.type).toBe('r');
    expect(g.pieceAt('h1')).toBeNull();
    g.undo();
    const long = g.moveUci('e1c1')!;
    expect(long.isQueensideCastle).toBe(true);
    expect(g.pieceAt('d1')?.type).toBe('r');
    expect(long.san).toBe('O-O-O');
  });

  it('keine Rochade aus dem Schach, durch ein angegriffenes Feld oder nach Königszug', () => {
    // Läufer b5 gibt Schach
    const inCheck = new ChessGame('4k3/8/8/1b6/8/8/8/R3K2R w KQ - 0 1');
    expect(inCheck.legalMovesFrom('e1').map((m) => m.to)).not.toContain('g1');
    // Turm f8 kontrolliert f1
    const through = new ChessGame('4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    expect(through.legalMovesFrom('e1').map((m) => m.to)).not.toContain('g1');
    expect(through.legalMovesFrom('e1').map((m) => m.to)).toContain('c1');
    // König zieht und kehrt zurück
    const moved = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    play(moved, ['e1f1', 'e8f8', 'f1e1', 'f8e8']);
    expect(moved.legalMovesFrom('e1').map((m) => m.to)).not.toContain('g1');
  });

  it('keine Rochade, wenn Figuren dazwischen stehen', () => {
    const g = new ChessGame();
    expect(g.legalMovesFrom('e1')).toEqual([]);
  });
});

describe('En passant', () => {
  it('ist nur direkt nach dem Doppelschritt möglich', () => {
    const g = new ChessGame();
    play(g, ['e2e4', 'a7a6', 'e4e5', 'd7d5']);
    const ep = g.legalMovesFrom('e5').find((m) => m.to === 'd6');
    expect(ep?.isCapture).toBe(true);
    const rec = g.moveUci('e5d6')!;
    expect(rec.isEnPassant).toBe(true);
    expect(g.pieceAt('d5')).toBeNull();
    g.undo();
    play(g, ['h2h3', 'h7h6']); // ein Zug später
    expect(g.legalMovesFrom('e5').map((m) => m.to)).not.toContain('d6');
  });
});

describe('Bauernumwandlung', () => {
  it('erkennt Umwandlungszüge und erlaubt alle vier Figuren', () => {
    const fen = '8/P7/8/8/8/8/8/k6K w - - 0 1';
    const g = new ChessGame(fen);
    expect(g.isPromotionMove('a7', 'a8')).toBe(true);
    const options = g.legalMovesFrom('a7');
    expect(options).toEqual([{ to: 'a8', isCapture: false, isPromotion: true }]);
    for (const piece of ['q', 'r', 'b', 'n'] as const) {
      const game = new ChessGame(fen);
      const rec = game.move({ from: 'a7', to: 'a8', promotion: piece })!;
      expect(rec.promotion).toBe(piece);
      expect(game.pieceAt('a8')?.type).toBe(piece);
    }
  });
});

describe('Partieende', () => {
  it('erkennt Schachmatt (Narrenmatt)', () => {
    const g = new ChessGame();
    play(g, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(g.status().result).toEqual({ winner: 'b', reason: 'checkmate' });
    expect(g.history().at(-1)?.isCheckmate).toBe(true);
  });

  it('erkennt Schachmatt (Schäfermatt)', () => {
    const g = new ChessGame();
    play(g, ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7']);
    expect(g.status().result).toEqual({ winner: 'w', reason: 'checkmate' });
  });

  it('erkennt Patt', () => {
    const g = new ChessGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(g.status().result).toEqual({ winner: null, reason: 'stalemate' });
  });

  it('erkennt ungenügendes Material', () => {
    expect(new ChessGame('8/8/8/4k3/8/8/8/4K3 w - - 0 1').status().result?.reason).toBe('insufficient-material');
    expect(new ChessGame('8/8/8/4k3/8/8/8/3BK3 w - - 0 1').status().result?.reason).toBe('insufficient-material');
    expect(new ChessGame('8/8/8/4k3/8/8/8/3NK3 w - - 0 1').status().result?.reason).toBe('insufficient-material');
    expect(new ChessGame('8/8/8/4k3/8/8/8/3RK3 w - - 0 1').status().result).toBeNull();
  });

  it('erkennt dreifache Stellungswiederholung', () => {
    const g = new ChessGame();
    play(g, ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1']);
    expect(g.status().result).toBeNull();
    g.moveUci('f6g8');
    expect(g.status().result).toEqual({ winner: null, reason: 'threefold-repetition' });
  });

  it('erkennt die 50-Züge-Regel', () => {
    const g = new ChessGame('8/8/8/4k3/8/8/4R3/4K3 w - - 99 80');
    expect(g.status().result).toBeNull();
    g.moveUci('e2a2');
    expect(g.status().result).toEqual({ winner: null, reason: 'fifty-move-rule' });
  });

  it('Matt hat Vorrang vor der 50-Züge-Regel', () => {
    const g = new ChessGame('k7/8/1K6/8/8/8/8/7R w - - 99 80');
    g.moveUci('h1h8');
    expect(g.status().result).toEqual({ winner: 'w', reason: 'checkmate' });
  });
});

describe('Rückgängig, Nachspielen, PGN', () => {
  it('nimmt Züge zurück', () => {
    const g = new ChessGame();
    play(g, ['e2e4', 'e7e5']);
    expect(g.undo()?.san).toBe('e5');
    expect(g.ply).toBe(1);
    expect(g.turn).toBe('b');
  });

  it('baut Partien aus UCI-Zügen nach und lehnt illegale Folgen ab', () => {
    const g = ChessGame.fromUciMoves(START_FEN, ['e2e4', 'e7e5', 'g1f3']);
    expect(g.uciMoves()).toEqual(['e2e4', 'e7e5', 'g1f3']);
    expect(() => ChessGame.fromUciMoves(START_FEN, ['e2e4', 'e2e4'])).toThrow();
  });

  it('exportiert und importiert PGN', () => {
    const g = new ChessGame();
    play(g, ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'e1e2']);
    const pgn = g.pgn({ White: 'Spieler', Black: 'Stockfish' });
    expect(pgn).toContain('[White "Spieler"]');
    expect(pgn).toContain('1. e4 c5 2. Nf3 d6 3. Ke2');
    const parsed = parsePgn(pgn)!;
    expect(parsed.moves).toEqual(g.uciMoves());
    expect(parsePgn('1. e4 e5 2. Ke3 Kxx')).toBeNull();
  });

  it('parst UCI-Notation', () => {
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
    expect(parseUci('e2e4')).toEqual({ from: 'e2', to: 'e4', promotion: undefined });
    expect(parseUci('e9e4')).toBeNull();
  });
});
