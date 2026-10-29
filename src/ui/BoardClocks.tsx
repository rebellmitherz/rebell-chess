import { useEffect, useRef, useState } from 'react';
import { formatClock, timeLeft } from '../core/clock';
import type { Color } from '../core/types';
import { opposite } from '../core/types';
import { useGame, gameStore } from '../game/instance';
import { tr } from '../i18n';
import { COLOR_NAME, FIGURINE, playerName } from './format';
import { useNow } from './useLayout';

/** Platz, den die Uhr-Tafeln neben dem Brett brauchen (px) */
export const CLOCK_PAD_WIDTH = 168;
/** Höhe der Leiste oben/unten, wenn neben dem Brett kein Platz ist (px) */
export const CLOCK_BAR_INSET = 70;

export type ClockPadMode = 'side' | 'bar';

/**
 * Wo stehen die Uhren? Ist links und rechts vom (quadratischen) Brett genug Platz, stehen sie dort oben und unten.
 * Sonst bekommen sie eine schmale Leiste über und unter dem Brett (das Brett wird dafür etwas kleiner).
 */
export function clockPadMode(areaWidth: number, areaHeight: number): ClockPadMode {
  const side = (areaWidth - areaHeight * 0.96) / 2;
  return side >= CLOCK_PAD_WIDTH + 24 ? 'side' : 'bar';
}

/** Bedenkzeit je Spieler für Partien ohne Zeitlimit: zählt hoch, solange der Spieler am Zug ist */
function useThinkTime(enabled: boolean) {
  const gameId = useGame((s) => s.gameId);
  const acc = useRef<{ id: number; w: number; b: number; last: number }>({ id: gameId, w: 0, b: 0, last: Date.now() });
  const [, force] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      const s = gameStore.getState();
      const a = acc.current;
      const now = Date.now();
      if (a.id !== s.gameId) {
        a.id = s.gameId;
        a.w = 0;
        a.b = 0;
      } else if (s.active && !s.result && !s.paused && s.battle === null && s.viewPly === null) {
        a[s.status.turn] += now - a.last;
      }
      a.last = now;
      force((n) => n + 1);
    }, 250);
    return () => window.clearInterval(id);
  }, [enabled]);
  return acc.current;
}

/** Verbrauchte Zeit ohne Zehntel: 4:05, 1:02:09 */
function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function Pad({ color, think }: { color: Color; think: { w: number; b: number } }) {
  const settings = useGame((s) => s.settings);
  const clock = useGame((s) => s.clock);
  const turn = useGame((s) => s.status.turn);
  const result = useGame((s) => s.result);
  const paused = useGame((s) => s.paused);
  const started = useGame((s) => s.history.length > 0);
  const running = clock.running === color && clock.since !== null;
  const now = useNow(100, running);
  const timed = clock.enabled;
  const active = !result && turn === color;
  const ms = timed ? timeLeft(clock, color, now) : think[color];
  const low = timed && ms < 20_000 && active && started;
  const canPause = timed && !result && started;

  return (
    <button
      type="button"
      className={`clock-pad${active ? ' active' : ''}${low ? ' low' : ''}${paused ? ' paused' : ''}${canPause ? '' : ' static'}`}
      onClick={() => canPause && gameStore.getState().setPaused(!paused)}
      aria-label={`${timed ? tr('Restzeit') : tr('Zeit verbraucht')} ${COLOR_NAME[color]}${canPause ? ` – ${paused ? tr('Uhr antippen: weiter') : tr('Uhr antippen: Pause')}` : ''}`}
      title={canPause ? (paused ? tr('Uhr antippen: weiter') : tr('Uhr antippen: Pause')) : undefined}
    >
      <span className="clock-pad-top">
        <span className={`piece-chip small chip-${color}`}>{FIGURINE.k}</span>
        <span className="clock-pad-name">{playerName(settings, color)}</span>
      </span>
      <span className="clock-pad-time">{timed ? formatClock(ms) : formatElapsed(ms)}</span>
      <span className="clock-pad-sub">{timed ? '' : tr('Zeit verbraucht')}</span>
    </button>
  );
}

/** Schachuhr-Tafeln: Gegner oben, eigener Spieler unten – die Tafel des Spielers am Zug leuchtet und ist „gedrückt“ */
export function BoardClocks({ mode, sidebar, areaWidth, areaHeight }: { mode: ClockPadMode; sidebar: number; areaWidth: number; areaHeight: number }) {
  const viewSide = useGame((s) => s.viewSide);
  const timed = useGame((s) => s.clock.enabled);
  const think = useThinkTime(!timed);
  return (
    <div className={`clock-pads ${mode}`} style={{ right: sidebar, ['--pad-x' as string]: `${(areaWidth - areaHeight * 0.96) / 4}px` }}>
      <Pad color={opposite(viewSide)} think={think} />
      <Pad color={viewSide} think={think} />
    </div>
  );
}
