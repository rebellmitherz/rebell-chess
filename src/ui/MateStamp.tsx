import { useEffect, useState } from 'react';
import { gameStore } from '../game/instance';
import { emitImpact } from '../scene/ImpactFX';
import { markActive } from '../scene/interaction';
import { squareToWorld } from '../scene/boardMath';
import { resultTitle } from './format';
import { useUi } from './uiState';

/** Der Stempel schlägt ein (nach dem Aufbau des Klangs, passend zu SFX „mate“) */
const SLAM_AT = 1100;
/** So lange steht der Stempel nach dem Einschlag, bevor das Ergebnisfenster kommt */
const HOLD_AFTER_SLAM = 2300;

interface Stamp {
  id: number;
  sub: string;
}

/** Kurzes, hartes Beben der ganzen 3D-Ansicht */
function quake() {
  const el = document.querySelector('.scene-canvas');
  if (!el || !('animate' in el)) return;
  const frames = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const a = 16 * Math.pow(0.62, i);
    return { transform: `translate(${(i % 2 ? -1 : 1) * a}px, ${(i % 3 ? 1 : -1) * a * 0.7}px)` };
  });
  (el as HTMLElement).animate([...frames, { transform: 'translate(0,0)' }], { duration: 520, easing: 'linear' });
}

/**
 * Schachmatt-Finale: Spannung, dann schlägt ein riesiger Stempel „SCHACHMATT“ ein – mit Blitz, Beben,
 * Explosion am König und tiefem Schlag. Danach erst erscheint das Ergebnisfenster. Antippen überspringt.
 */
export function MateStamp() {
  const [stamp, setStamp] = useState<Stamp | null>(null);

  useEffect(() => {
    let timers: number[] = [];
    let pendingGame: number | null = null;
    let active = false;
    const ui = () => useUi.getState();

    const stop = () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers = [];
      pendingGame = null;
      active = false;
      setStamp(null);
      ui().setStamping(false);
    };

    const run = () => {
      const s = gameStore.getState();
      if (!s.result) return;
      active = true;
      const id = Date.now();
      const kingSquare = s.status.checkSquare;
      timers.push(
        window.setTimeout(() => {
          setStamp({ id, sub: resultTitle(s.result!, s.settings) });
          quake();
          markActive(1500);
          if (kingSquare) {
            const [x, z] = squareToWorld(kingSquare);
            emitImpact({ x, z, dirX: 0, dirZ: 1, victim: s.status.turn, power: 2.4, ring: false, burst: true });
          }
          // Haltezeit zählt ab dem Einschlag (nicht ab dem Zug), sonst blitzt der Stempel bei trägem Gerät nur kurz auf
          timers.push(
            window.setTimeout(() => {
              active = false;
              setStamp(null);
              ui().setStamping(false);
            }, HOLD_AFTER_SLAM),
          );
        }, SLAM_AT),
      );
    };

    const unsub = gameStore.subscribe((s, prev) => {
      if (s.gameId !== prev.gameId || s.screen !== 'game') {
        stop();
        return;
      }
      const mate = s.result?.reason === 'checkmate';
      const wasMate = prev.result?.reason === 'checkmate';
      if (!mate) {
        if (wasMate || active || pendingGame !== null) stop();
        return;
      }
      if (!wasMate) {
        // Partie wurde gerade matt gesetzt (nicht: eine beendete Partie wurde geladen – dann ändert sich gameId)
        pendingGame = s.gameId;
        ui().setStamping(true);
      }
      // Nach einem Schlagzug mit Kriegerkampf erst nach dem Kampf
      if (pendingGame === s.gameId && !s.battle) {
        pendingGame = null;
        run();
      }
    });
    return () => {
      unsub();
      stop();
    };
  }, []);

  if (!stamp) return null;
  const skip = () => {
    useUi.getState().setStamping(false);
    setStamp(null);
  };
  return (
    <div className="mate-layer" onPointerDown={skip} key={stamp.id}>
      <div className="mate-flash" />
      <div className="mate-stamp">
        <span className="mate-word">SCHACHMATT</span>
        <span className="mate-sub">{stamp.sub}</span>
      </div>
    </div>
  );
}
