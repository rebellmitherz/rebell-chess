import { coordsToSquare, squareToCoords, type Square } from '../core/types';

/** Ein Feld = 1 Einheit. a1 liegt links vorne aus Sicht von Weiß (Weiß sitzt bei +z). */
export function squareToWorld(square: Square): [number, number] {
  const { file, rank } = squareToCoords(square);
  return [file - 3.5, 3.5 - rank];
}

export function worldToSquare(x: number, z: number): Square | null {
  return coordsToSquare(Math.floor(x + 4), Math.floor(4 - z));
}

export const BOARD_TOP = 0;
export const FRAME_HALF = 4.8;
