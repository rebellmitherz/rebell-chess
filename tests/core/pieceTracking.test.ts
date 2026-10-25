import { describe, expect, it } from 'vitest';
import { ChessGame, START_FEN } from '../../src/core/chessGame';
import { initialTrackedPieces, trackPieces } from '../../src/core/pieceTracking';

const historyOf = (fen: string, moves: string[]) => ChessGame.fromUciMoves(fen, moves).history();

describe('Figuren-IDs', () => {
  it('vergibt 32 eindeutige IDs in der Grundstellung', () => {
    const pieces = initialTrackedPieces(START_FEN);
    expect(pieces).toHaveLength(32);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(32);
  });

  it('behält die ID beim Ziehen und entfernt geschlagene Figuren', () => {
    const pos = trackPieces(START_FEN, historyOf(START_FEN, ['e2e4', 'd7d5', 'e4d5']));
    const pawn = pos.pieces.find((p) => p.id === 'wp-e2');
    expect(pawn?.square).toBe('d5');
    expect(pos.pieces).toHaveLength(31);
    expect(pos.captured.map((p) => p.id)).toEqual(['bp-d7']);
  });

  it('bewegt bei der Rochade auch den Turm', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const pos = trackPieces(fen, historyOf(fen, ['e1g1', 'e8c8']));
    expect(pos.pieces.find((p) => p.id === 'wr-h1')?.square).toBe('f1');
    expect(pos.pieces.find((p) => p.id === 'wk-e1')?.square).toBe('g1');
    expect(pos.pieces.find((p) => p.id === 'br-a8')?.square).toBe('d8');
    expect(pos.pieces.find((p) => p.id === 'bk-e8')?.square).toBe('c8');
  });

  it('entfernt beim en passant den richtigen Bauern', () => {
    const pos = trackPieces(START_FEN, historyOf(START_FEN, ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']));
    expect(pos.captured.map((p) => p.id)).toEqual(['bp-d7']);
    expect(pos.pieces.find((p) => p.id === 'wp-e2')?.square).toBe('d6');
  });

  it('ändert bei der Umwandlung den Typ, nicht die ID', () => {
    const fen = '1r5k/P7/8/8/8/8/8/7K w - - 0 1';
    const pos = trackPieces(fen, historyOf(fen, ['a7b8n']));
    const promoted = pos.pieces.find((p) => p.id === 'wp-a7');
    expect(promoted).toMatchObject({ type: 'n', square: 'b8' });
    expect(pos.captured.map((p) => p.type)).toEqual(['r']);
  });
});
