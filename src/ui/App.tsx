import { Component, Fragment, useEffect, type ReactNode } from 'react';
import { playSfx, setVolume, unlockAudio } from '../audio/sound';
import { gameStore, useGame } from '../game/instance';
import { ChessScene } from '../scene/ChessScene';
import { BattleOverlay } from './BattleOverlay';
import { ConfirmDialogs, DrawOfferDialog, GameOverDialog, PauseOverlay, PromotionDialog, Toast } from './Dialogs';
import { toggleFullscreen } from './fullscreen';
import { MateStamp } from './MateStamp';
import { Hud } from './Hud';
import { MainMenu } from './MainMenu';
import { useLayout } from './useLayout';
import { useUi } from './uiState';
import { tr } from '../i18n';

class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="fatal">
          <h1>{tr('3D-Darstellung nicht verfügbar')}</h1>
          <p>{tr('Dein Browser oder Grafiktreiber unterstützt WebGL nicht oder hat es deaktiviert. Bitte einen aktuellen Browser (Chrome, Edge, Firefox, Safari) verwenden.')}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function useSoundBridge() {
  useEffect(() => {
    setVolume(gameStore.getState().prefs.volume);
    return gameStore.subscribe((s, prev) => {
      if (s.prefs.volume !== prev.prefs.volume) setVolume(s.prefs.volume);
      if (s.sfx && s.sfx !== prev.sfx && s.prefs.sound) {
        // Mit Kampf-Animation: Anlauf-Rauschen, Einschlag genau beim Treffer
        playSfx(s.sfx.kind === 'capture' && s.prefs.battleMode !== 'off' ? 'strike' : s.sfx.kind);
      }
    });
  }, []);
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
}

function useClockTicker() {
  useEffect(() => {
    const id = window.setInterval(() => gameStore.getState().tick(), 100);
    return () => window.clearInterval(id);
  }, []);
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = gameStore.getState();
      const ui = useUi.getState();
      // Kriegerkampf: Leertaste, Enter oder Esc überspringen ihn
      if (s.battle && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault();
        s.endBattle();
        return;
      }
      if (e.key === 'Escape') {
        if (ui.sheet) ui.openSheet(null);
        else if (s.screen === 'game') s.openMenu();
        else if (s.active) s.closeMenu();
        return;
      }
      if (s.screen !== 'game' || ui.dialog) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        s.stepView(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (e.key === 'Home') return s.viewMove(0);
      if (e.key === 'End') return s.viewMove(null);
      switch (e.key.toLowerCase()) {
        case 'u':
          s.undo();
          break;
        case 'f':
          s.flipView();
          break;
        case 'h':
          if (s.settings.training) s.requestHint();
          break;
        case 'p':
          if (s.clock.enabled) s.setPaused(!s.paused);
          break;
        case 's':
          s.setPrefs({ hideSidebar: !s.prefs.hideSidebar });
          break;
        case 'v':
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const layout = useLayout();
  const screen = useGame((s) => s.screen);
  const measured = useUi((s) => s.insets);
  const fighting = useGame((s) => s.battle !== null);
  const hideSidebar = useGame((s) => s.prefs.hideSidebar);
  const lang = useGame((s) => s.prefs.lang);
  useSoundBridge();
  useClockTicker();
  useKeyboard();
  const inGame = screen === 'game';
  const topInset = !inGame || layout.desktop ? 0 : (measured?.top ?? layout.topInset);
  const bottomInset = !inGame || layout.desktop ? 0 : (measured?.bottom ?? layout.bottomInset);

  return (
    <div className="app">
      <SceneErrorBoundary>
        <ChessScene sidebar={inGame && !hideSidebar ? layout.sidebar : 0} topInset={topInset} bottomInset={bottomInset} />
      </SceneErrorBoundary>
      {/* Während eines Kriegerkampfs treten die Leisten zurück – volle Bühne für die Kamera */}
      {/* Sprachwechsel: Oberfläche neu aufbauen (die 3D-Szene bleibt stehen) */}
      <Fragment key={lang}>
        {inGame && (
          <div className={fighting ? 'hud-layer cinematic' : 'hud-layer'}>
            <Hud layout={layout} />
          </div>
        )}
        {inGame && <BattleOverlay />}
        <PromotionDialog />
        <GameOverDialog />
        <DrawOfferDialog />
        <PauseOverlay />
        <ConfirmDialogs />
        <Toast />
      </Fragment>
      <MateStamp />
      {screen === 'menu' && <MainMenu />}
    </div>
  );
}
