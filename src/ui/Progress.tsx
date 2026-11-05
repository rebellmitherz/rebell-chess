import { Chess } from 'chess.js';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { gameStore, useGame } from '../game/instance';
import { getOpponent, OPPONENTS, say, type Opponent } from '../game/opponents';
import {
  ACHIEVEMENTS,
  FAST_WIN_MOVES,
  getPuzzle,
  isUnlocked,
  levelInfo,
  nextOpponentId,
  nextPuzzle,
  PUZZLES,
  startCampaign,
  startPuzzle,
  totalStars,
  useProgress,
  type Reward,
} from '../game/progress';
import { tr } from '../i18n';
import { playChime } from '../audio/sound';
import { spriteUrl } from './Board2D';
import { figurineSan } from './format';
import { IconLock, IconTrophy } from './icons';
import { useUi } from './uiState';

/** Wappen eines Gegners: Marmorfigur auf farbigem Ring */
export function Avatar({ opp, size = 'md', locked = false }: { opp: Opponent; size?: 'sm' | 'md' | 'lg'; locked?: boolean }) {
  return (
    <span className={`avatar ${size}${locked ? ' locked' : ''}${opp.id === OPPONENTS.length ? ' boss' : ''}`} style={{ '--ring': opp.ring } as CSSProperties}>
      <img src={spriteUrl(opp.pieceColor, opp.piece)} alt="" draggable={false} />
    </span>
  );
}

export function Stars({ n, max = 3, big = false }: { n: number; max?: number; big?: boolean }) {
  return (
    <span className={`stars${big ? ' big' : ''}`} aria-label={tr('{n} von {max} Sternen', { n, max })}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? 'on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

/** Stufe, Rang und Erfahrungsbalken */
export function PlayerStrip() {
  const xp = useProgress((s) => s.data.xp);
  const info = levelInfo(xp);
  return (
    <div className="player-strip">
      <span className="lvl-badge">{info.level}</span>
      <span className="lvl-text">
        <strong>{info.rank}</strong>
        <span className="xp-bar">
          <span style={{ width: `${Math.round(info.progress * 100)}%` }} />
        </span>
        <small>
          {xp - info.from} / {info.to - info.from} {tr('EP')}
        </small>
      </span>
    </div>
  );
}

const play = () => gameStore;

/** Großer Knopf: nächster Gegner im Feldzug, sofort */
export function PlayButton() {
  const data = useProgress((s) => s.data);
  const opp = getOpponent(nextOpponentId(data))!;
  return (
    <button className="btn play-btn" onClick={() => startCampaign(play(), opp.id)}>
      <Avatar opp={opp} size="sm" />
      <span className="play-text">
        <span className="play-label">{tr('Spielen')}</span>
        <span className="play-sub">{tr('gegen {name}', { name: say(opp.name) })}</span>
      </span>
      <span className="play-arrow" aria-hidden="true">
        ▶
      </span>
    </button>
  );
}

export function CampaignPanel({ onBack }: { onBack: () => void }) {
  const data = useProgress((s) => s.data);
  const next = nextOpponentId(data);
  return (
    <div className="menu-panel">
      <h2 className="panel-title">{tr('Feldzug')}</h2>
      <p className="panel-lead">
        {tr('Besiege alle sieben Gegner bis zum Rebellen. Sterne:')} <span className="star-key">★</span> {tr('Sieg')} ·{' '}
        <span className="star-key">★</span> {tr('ohne Zurücknehmen')} · <span className="star-key">★</span>{' '}
        {tr('in höchstens {n} Zügen', { n: FAST_WIN_MOVES })}
      </p>
      <ol className="campaign">
        {OPPONENTS.map((o) => {
          const open = isUnlocked(data, o.id);
          const stars = data.stars[String(o.id)] ?? 0;
          return (
            <li key={o.id}>
              <button className={`opp-card${open ? '' : ' locked'}${o.id === next ? ' next' : ''}`} disabled={!open} onClick={() => startCampaign(play(), o.id)}>
                <Avatar opp={o} locked={!open} />
                <span className="opp-text">
                  <strong>{say(o.name)}</strong>
                  <small>{say(o.title)}</small>
                </span>
                <span className="opp-side">
                  {open ? <Stars n={stars} /> : <IconLock />}
                  <small>{tr('Stufe {n}', { n: o.level })}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="menu-actions">
        <button className="btn ghost" onClick={onBack}>
          {tr('Zurück')}
        </button>
      </div>
    </div>
  );
}

export function PuzzlePanel({ onBack }: { onBack: () => void }) {
  const data = useProgress((s) => s.data);
  const groups = [1, 2, 3].map((n) => {
    const all = PUZZLES.filter((p) => p.mateIn === n);
    const solved = all.filter((p) => data.puzzles.includes(p.id)).length;
    return { n, total: all.length, solved, next: all.find((p) => !data.puzzles.includes(p.id)) ?? all[0] };
  });
  const upcoming = nextPuzzle(data);
  return (
    <div className="menu-panel">
      <h2 className="panel-title">{tr('Rätsel')}</h2>
      <p className="panel-lead">{tr('Finde das Matt. Die KI verteidigt sich nach Kräften – nur der beste Zug gewinnt.')}</p>
      <div className="puzzle-stats">
        <span>
          <strong>{data.puzzles.length}</strong>
          <small>/ {PUZZLES.length} {tr('gelöst')}</small>
        </span>
        <span>
          <strong>{data.streak}</strong>
          <small>{tr('Serie (Rekord {n})', { n: data.bestStreak })}</small>
        </span>
      </div>
      {upcoming && (
        <button className="btn primary big" onClick={() => startPuzzle(play(), upcoming)}>
          {tr('Nächstes Rätsel')} · {tr('Matt in {n}', { n: upcoming.mateIn })}
        </button>
      )}
      <div className="puzzle-groups">
        {groups.map((g) =>
          g.total ? (
            <button key={g.n} className="puzzle-group" onClick={() => g.next && startPuzzle(play(), g.next)}>
              <strong>{tr('Matt in {n}', { n: g.n })}</strong>
              <span className="xp-bar">
                <span style={{ width: `${Math.round((g.solved / g.total) * 100)}%` }} />
              </span>
              <small>
                {g.solved} / {g.total}
              </small>
            </button>
          ) : null,
        )}
      </div>
      <div className="menu-actions">
        <button className="btn ghost" onClick={onBack}>
          {tr('Zurück')}
        </button>
      </div>
    </div>
  );
}

export function AchievementsPanel({ onBack }: { onBack: () => void }) {
  const got = useProgress((s) => s.data.achievements);
  const data = useProgress((s) => s.data);
  return (
    <div className="menu-panel">
      <h2 className="panel-title">{tr('Erfolge')}</h2>
      <p className="panel-lead">
        {got.length} / {ACHIEVEMENTS.length} · ★ {totalStars(data)} / {OPPONENTS.length * 3} · {tr('{n} Kriegerkämpfe', { n: data.duels })}
      </p>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.id} className={`ach${got.includes(a.id) ? ' on' : ''}`}>
            <span className="ach-icon">
              <IconTrophy />
            </span>
            <strong>{tr(a.name)}</strong>
            <small>{tr(a.desc)}</small>
          </div>
        ))}
      </div>
      <div className="menu-actions">
        <button className="btn ghost" onClick={onBack}>
          {tr('Zurück')}
        </button>
      </div>
    </div>
  );
}

// ---------- In der Partie ----------

/** Sprechblase des Gegners über dem Brett (Feldzug) */
export function OpponentBubble({ left, right, top }: { left: number; right: number; top: number }) {
  const bubble = useProgress((s) => s.bubble);
  const ctx = useGame((s) => s.settings.context);
  const screen = useGame((s) => s.screen);
  const fighting = useGame((s) => s.battle !== null);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!bubble) return;
    setShown(bubble.id);
    const t = setTimeout(() => setShown((id) => (id === bubble.id ? null : id)), 3800);
    return () => clearTimeout(t);
  }, [bubble]);
  if (!bubble || shown !== bubble.id || ctx?.kind !== 'campaign' || screen !== 'game' || fighting) return null;
  const opp = getOpponent(ctx.opponent)!;
  return (
    <div className="opp-bubble-wrap" style={{ left, right, top }}>
      <div key={bubble.id} className="opp-bubble">
        <Avatar opp={opp} size="sm" />
        <span>
          <strong>{say(opp.name)}</strong>
          {bubble.text}
        </span>
      </div>
    </div>
  );
}

/** Auftritt vor einer Feldzug-Partie: Wappen, Name und Beiname des Gegners, dann geht es los */
export function MatchIntro() {
  const gameId = useGame((s) => s.gameId);
  const ctx = useGame((s) => s.settings.context);
  const fresh = useGame((s) => s.screen === 'game' && s.history.length === 0 && !s.result);
  const [shownFor, setShownFor] = useState<number | null>(null);
  useEffect(() => {
    if (ctx?.kind !== 'campaign' || !fresh) return;
    setShownFor(gameId);
    const t = setTimeout(() => setShownFor(null), 1900);
    return () => clearTimeout(t);
    // nur beim Start einer neuen Partie
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);
  if (shownFor !== gameId || ctx?.kind !== 'campaign') return null;
  const opp = getOpponent(ctx.opponent)!;
  return (
    <div className="match-intro" onClick={() => setShownFor(null)}>
      <div className="match-card">
        <small>{tr('Stufe {n}', { n: opp.level })} · {tr('Feldzug')}</small>
        <Avatar opp={opp} size="lg" />
        <strong>{say(opp.name)}</strong>
        <em>{say(opp.title)}</em>
      </div>
    </div>
  );
}

/** Erfolg freigeschaltet: goldene Einblendung */
export function AchievementToasts() {
  const toasts = useProgress((s) => s.toasts);
  const drop = useProgress((s) => s.dropToast);
  const first = toasts[0];
  useEffect(() => {
    if (!first) return;
    if (gameStore.getState().prefs.sound) playChime('achievement');
    const t = setTimeout(() => drop(first.key), 3400);
    return () => clearTimeout(t);
  }, [first, drop]);
  if (!first) return null;
  const a = ACHIEVEMENTS.find((x) => x.id === first.id);
  if (!a) return null;
  return (
    <div key={first.key} className="ach-toast" role="status">
      <span className="ach-icon">
        <IconTrophy />
      </span>
      <span>
        <small>{tr('Erfolg freigeschaltet')}</small>
        <strong>{tr(a.name)}</strong>
      </span>
    </div>
  );
}

/** Erste Partie: kurzer Hinweis, wie man zieht – verschwindet mit dem ersten Zug */
export function CoachHint({ left, right, bottom }: { left: number; right: number; bottom: number }) {
  const games = useProgress((s) => s.data.games + s.data.puzzles.length);
  const show = useGame((s) => s.screen === 'game' && s.active && s.history.length === 0 && !s.result && s.battle === null);
  if (games > 0 || !show) return null;
  return (
    <div className="coach-wrap" style={{ left, right, bottom: bottom + 14 }}>
      <div className="coach">{tr('Tippe eine deiner Figuren an – dann ihr Zielfeld.')}</div>
    </div>
  );
}

/** Goldregen beim Sieg */
export function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        dur: 2.2 + Math.random() * 1.6,
        size: 5 + Math.random() * 7,
        hue: ['#f7dc93', '#e2b85c', '#fff1c4', '#c9963f', '#ffffff'][i % 5],
        spin: Math.random() * 720 - 360,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          style={
            {
              left: `${b.left}%`,
              width: b.size,
              height: b.size * 0.45,
              background: b.hue,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
              '--spin': `${b.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Belohnung im Ergebnisfenster: Gegner-Spruch, Sterne, Erfahrung, Stufenaufstieg, Erfolge, neuer Gegner */
export function RewardPanel({ reward }: { reward: Reward }) {
  const ctx = useGame((s) => s.settings.context);
  const before = levelInfo(reward.xpBefore);
  const after = levelInfo(reward.xpAfter);
  const [fill, setFill] = useState(reward.xpBefore >= after.from ? before.progress : 0);
  useEffect(() => {
    const t = setTimeout(() => setFill(after.progress), 450);
    return () => clearTimeout(t);
  }, [after.progress]);
  // Klang zu jedem Stern (im Takt der Einblendung) und zum Aufstieg
  useEffect(() => {
    if (!gameStore.getState().prefs.sound) return;
    reward.starFlags.forEach((on, i) => on && playChime('star', 0.3 + i * 0.28));
    if (levelInfo(reward.xpAfter).level > levelInfo(reward.xpBefore).level) playChime('levelup', 1.0);
  }, [reward]);
  const opp = ctx?.kind === 'campaign' ? getOpponent(ctx.opponent) : undefined;
  const unlocked = reward.unlocked ? getOpponent(reward.unlocked) : undefined;
  const gained = reward.xpAfter - reward.xpBefore;
  return (
    <div className="reward">
      {opp && reward.quote && (
        <div className="reward-quote">
          <Avatar opp={opp} size="sm" />
          <span>„{say(reward.quote)}“</span>
        </div>
      )}
      {reward.kind === 'campaign' && (
        <div className="reward-stars">
          {reward.starFlags.map((on, i) => (
            <span key={i} className={`reward-star${on ? ' on' : ''}`} style={{ animationDelay: `${0.25 + i * 0.28}s` }}>
              <b>★</b>
              <small>{[tr('Sieg'), tr('ohne Zurücknehmen'), tr('in höchstens {n} Zügen', { n: FAST_WIN_MOVES })][i]}</small>
            </span>
          ))}
        </div>
      )}
      {reward.kind === 'puzzle' && reward.streak !== undefined && reward.streak > 0 && (
        <p className="reward-line">{tr('Serie: {n} Rätsel hintereinander', { n: reward.streak })}</p>
      )}
      <div className="reward-xp">
        <span className="lvl-badge">{after.level}</span>
        <span className="lvl-text">
          <strong>
            {after.rank}
            {gained > 0 && <em> +{gained} {tr('EP')}</em>}
          </strong>
          <span className="xp-bar">
            <span style={{ width: `${Math.round(fill * 100)}%` }} />
          </span>
        </span>
      </div>
      {after.level > before.level && <p className="reward-levelup">{tr('Aufgestiegen: Stufe {n} – {rank}!', { n: after.level, rank: after.rank })}</p>}
      {unlocked && (
        <p className="reward-unlock">
          <Avatar opp={unlocked} size="sm" /> {tr('Neuer Gegner freigeschaltet: {name}', { name: say(unlocked.name) })}
        </p>
      )}
      {reward.achievements.length > 0 && (
        <div className="reward-ach">
          {reward.achievements.map((id) => {
            const a = ACHIEVEMENTS.find((x) => x.id === id);
            return a ? (
              <span key={id} className="ach-chip">
                <IconTrophy /> {tr(a.name)}
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

/** Erster Zug der Lösung als Tipp (Figurine-Notation) */
export function puzzleTip(id: string): string | null {
  const p = getPuzzle(id);
  if (!p || !p.sol.length) return null;
  try {
    const c = new Chess(p.fen);
    const m = c.move({ from: p.sol[0].slice(0, 2), to: p.sol[0].slice(2, 4), promotion: p.sol[0][4] });
    return figurineSan(m.san);
  } catch {
    return null;
  }
}

/** Menü auf einer bestimmten Seite öffnen (z. B. nach der Partie zurück zum Feldzug) */
export function openMenuAt(panel: 'campaign' | 'puzzles') {
  useUi.getState().setMenuPanel(panel);
  gameStore.getState().openMenu();
}
