import { useEffect, useRef, useState } from 'react';
import { gameStore, useGame } from '../game/instance';
import type { BattleState } from '../game/store';
import { battleTitle } from './format';
import { tr } from '../i18n';

/** Wie lange die Balken nach dem Kampf noch herausfahren (ms, passend zu styles.css) */
const LEAVE_MS = 420;
/** Ein Doppeltipp beim Schlagen soll den Kampf nicht gleich wieder abbrechen */
const SKIP_GUARD_MS = 350;

/**
 * Kino-Rahmen für den Kriegerkampf: schwarze Balken oben und unten (die Kamera rechnet mit ihnen),
 * Titel des Duells und „Überspringen“. Tippen oder Klicken irgendwo beendet den Kampf.
 */
export function BattleOverlay() {
  const battle = useGame((s) => (s.screen === 'game' ? s.battle : null));
  const [shown, setShown] = useState<BattleState | null>(null);
  const [leaving, setLeaving] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    if (battle) {
      startedAt.current = performance.now();
      setShown(battle);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const id = setTimeout(() => setShown(null), LEAVE_MS);
    return () => clearTimeout(id);
  }, [battle]);

  if (!shown) return null;
  const skip = () => {
    if (!leaving && performance.now() - startedAt.current > SKIP_GUARD_MS) gameStore.getState().endBattle();
  };

  return (
    <div className={leaving ? 'battle-overlay leaving' : 'battle-overlay'} onPointerDown={skip}>
      <div className="battle-bar top">
        <span className="battle-title">⚔︎ {battleTitle(shown)}</span>
      </div>
      <div className="battle-bar bottom">
        <button className="battle-skip" onClick={skip} aria-label={tr('Kampf überspringen')}>
          {tr('Überspringen ▸▸')}
        </button>
      </div>
    </div>
  );
}
