import { create } from 'zustand';

export type DialogKind = 'resign' | 'restart' | 'pgn' | null;
export type SheetKind = 'moves' | 'more' | null;

interface UiState {
  dialog: DialogKind;
  sheet: SheetKind;
  /** Ergebnisfenster für diese Stellung weggeklickt („Brett ansehen“) */
  dismissedResultKey: string | null;
  /** Gemessene Höhe der HUD-Leisten auf Smartphones (für die Kamera) */
  insets: { top: number; bottom: number } | null;
  openDialog(d: DialogKind): void;
  openSheet(s: SheetKind): void;
  dismissResult(key: string): void;
  setInsets(insets: { top: number; bottom: number } | null): void;
}

/** Reiner Oberflächenzustand (welche Dialoge offen sind) – getrennt vom Spielzustand. */
export const useUi = create<UiState>((set) => ({
  dialog: null,
  sheet: null,
  dismissedResultKey: null,
  insets: null,
  openDialog: (dialog) => set({ dialog, sheet: null }),
  openSheet: (sheet) => set({ sheet }),
  dismissResult: (key) => set({ dismissedResultKey: key }),
  setInsets: (insets) =>
    set((s) => {
      const same = s.insets && insets && Math.abs(s.insets.top - insets.top) < 4 && Math.abs(s.insets.bottom - insets.bottom) < 4;
      return same ? s : { insets };
    }),
}));
