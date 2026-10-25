import { useEffect, useLayoutEffect, useRef } from 'react';
import { formatClock, timeLeft } from '../core/clock';
import { materialScore } from '../core/material';
import { opposite, PIECE_VALUES, type Color } from '../core/types';
import { gameStore, useGame } from '../game/instance';
import { COLOR_NAME, FIGURINE, figurineSan, playerName, resultTitle } from './format';
import {
  IconClose,
  IconFlag,
  IconFlip,
  IconHandshake,
  IconHint,
  IconList,
  IconMenu,
  IconMore,
  IconPause,
  IconPgn,
  IconPlay,
  IconRestart,
  IconSave,
  IconSound,
  IconUndo,
} from './icons';
import type { Layout } from './useLayout';
import { useNow } from './useLayout';
import { useUi } from './uiState';

const actions = () => gameStore.getState();

function ClockFace({ color }: { color: Color }) {
  const clock = useGame((s) => s.clock);
  const running = clock.running === color && clock.since !== null;
  const now = useNow(100, running);
  if (!clock.enabled) return null;
  const ms = timeLeft(clock, color, now);
  return (
    <div className={`clock${running ? ' running' : ''}${ms < 20_000 ? ' low' : ''}`} aria-label={`Restzeit ${COLOR_NAME[color]}`}>
      {formatClock(ms)}
    </div>
  );
}

function CapturedRow({ color }: { color: Color }) {
  const captured = useGame((s) => s.captured);
  const pieces = useGame((s) => s.pieces);
  const taken = captured.filter((p) => p.color !== color).sort((a, b) => PIECE_VALUES[b.type] - PIECE_VALUES[a.type]);
  const advantage = materialScore(pieces, color) - materialScore(pieces, opposite(color));
  return (
    <div className="captured">
      {taken.map((p) => (
        <span key={p.id} className={`cap cap-${p.color}`}>
          {FIGURINE[p.type]}
        </span>
      ))}
      {advantage > 0 && <span className="advantage">+{advantage}</span>}
    </div>
  );
}

function PlayerCard({ color }: { color: Color }) {
  const settings = useGame((s) => s.settings);
  const turn = useGame((s) => s.status.turn);
  const result = useGame((s) => s.result);
  const thinking = useGame((s) => s.engineThinking);
  const active = !result && turn === color;
  const isAi = settings.mode === 'ai' && color !== settings.humanColor;
  return (
    <div className={`player-card${active ? ' active' : ''}`}>
      <div className={`piece-chip chip-${color}`}>{FIGURINE.k}</div>
      <div className="player-info">
        <div className="player-name">{playerName(settings, color)}</div>
        <CapturedRow color={color} />
      </div>
      {isAi && thinking && (
        <div className="thinking" aria-label="Stockfish denkt">
          <span />
          <span />
          <span />
        </div>
      )}
      <ClockFace color={color} />
    </div>
  );
}

function StatusLine() {
  const status = useGame((s) => s.status);
  const result = useGame((s) => s.result);
  const settings = useGame((s) => s.settings);
  const thinking = useGame((s) => s.engineThinking);
  const paused = useGame((s) => s.paused);
  let text: string;
  let tone = '';
  if (result) {
    text = resultTitle(result, settings);
    tone = 'over';
  } else if (paused) text = 'Partie pausiert';
  else if (settings.mode === 'ai' && thinking) text = 'Stockfish denkt …';
  else {
    const who =
      settings.mode === 'ai'
        ? status.turn === settings.humanColor
          ? 'Du bist am Zug'
          : 'Stockfish ist am Zug'
        : `${COLOR_NAME[status.turn]} ist am Zug`;
    text = status.inCheck ? `Schach! ${who}` : who;
    if (status.inCheck) tone = 'check';
  }
  return (
    <div className={`status-line ${tone}`} role="status" aria-live="polite">
      {text}
    </div>
  );
}

export function MoveList() {
  const history = useGame((s) => s.history);
  const startFen = useGame((s) => s.startFen);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [history.length]);

  const firstNumber = Number(startFen.split(' ')[5] ?? '1') || 1;
  const offset = history[0]?.color === 'b' ? 1 : 0;
  const rows: Array<{ n: number; w?: string; b?: string; wi?: number; bi?: number }> = [];
  history.forEach((m, i) => {
    const slot = i + offset;
    const row = Math.floor(slot / 2);
    rows[row] ??= { n: firstNumber + row };
    if (slot % 2 === 0) {
      rows[row].w = figurineSan(m.san);
      rows[row].wi = i;
    } else {
      rows[row].b = figurineSan(m.san);
      rows[row].bi = i;
    }
  });
  const last = history.length - 1;

  return (
    <div className="move-list" ref={ref}>
      {rows.length === 0 && <div className="move-empty">Noch keine Züge</div>}
      {rows.map((r) => (
        <div className="move-row" key={r.n}>
          <span className="move-no">{r.n}.</span>
          <span className={`move${r.wi === last ? ' current' : ''}`}>{r.w ?? '…'}</span>
          <span className={`move${r.bi === last ? ' current' : ''}`}>{r.b ?? ''}</span>
        </div>
      ))}
    </div>
  );
}

const QUALITY_CLASS: Record<string, string> = {
  best: 'q-best',
  good: 'q-good',
  inaccuracy: 'q-inacc',
  mistake: 'q-mistake',
  blunder: 'q-blunder',
};

export function TrainingPanel({ compact = false }: { compact?: boolean }) {
  const training = useGame((s) => s.settings.training);
  const hint = useGame((s) => s.hint);
  const feedback = useGame((s) => s.feedback);
  if (!training) return null;

  if (hint) {
    return (
      <div className="training-card hint">
        <div className="training-head">
          <span className="badge b-hint">Hinweis</span>
          <button className="icon-btn small" onClick={() => actions().clearHint()} aria-label="Hinweis schließen">
            <IconClose />
          </button>
        </div>
        {hint.status === 'loading' && <p className="muted">Stockfish sucht den besten Zug …</p>}
        {hint.status === 'error' && <p className="muted">Die Schach-KI ist gerade nicht erreichbar.</p>}
        {hint.status === 'ready' && (
          <>
            <p className="training-title">{hint.title}</p>
            {!compact && hint.points?.map((p) => <p key={p} className="training-point">{p}</p>)}
            {compact && hint.points?.[0] && <p className="training-point">{hint.points[0]}</p>}
            {hint.evalText && <p className="muted small">Bewertung: {hint.evalText}</p>}
          </>
        )}
      </div>
    );
  }

  if (feedback) {
    const c = feedback.classification;
    return (
      <div className="training-card">
        <div className="training-head">
          {c ? <span className={`badge ${QUALITY_CLASS[c.quality]}`}>{c.label}</span> : <span className="badge">Analyse …</span>}
          <span className="training-move">{feedback.moveTitle}</span>
          <button className="icon-btn small" onClick={() => actions().dismissFeedback()} aria-label="Bewertung schließen">
            <IconClose />
          </button>
        </div>
        {(compact ? feedback.points.slice(0, 1) : feedback.points).map((p) => (
          <p key={p} className="training-point">
            {p}
          </p>
        ))}
        {feedback.better && (
          <div className="better">
            <p className="training-title">Besser war: {figurineSan(feedback.better.san)}</p>
            {!compact && feedback.better.points.slice(0, 2).map((p) => <p key={p} className="training-point">{p}</p>)}
          </div>
        )}
        {feedback.status === 'error' && <p className="muted small">Bewertung nicht verfügbar.</p>}
        {feedback.evalText && !compact && <p className="muted small">Stellung: {feedback.evalText}</p>}
      </div>
    );
  }

  return (
    <div className="training-card intro">
      <span className="badge b-hint">Training</span>
      <p className="training-point">
        Nach jedem deiner Züge bewertet Stockfish ihn und erklärt die Idee. Mit <strong>Hinweis</strong> siehst du den besten Zug als Pfeil.
      </p>
    </div>
  );
}

function useControls() {
  const active = useGame((s) => s.active);
  const result = useGame((s) => s.result);
  const historyLength = useGame((s) => s.history.length);
  const training = useGame((s) => s.settings.training);
  const mode = useGame((s) => s.settings.mode);
  const turn = useGame((s) => s.status.turn);
  const human = useGame((s) => s.settings.humanColor);
  const thinking = useGame((s) => s.engineThinking);
  const paused = useGame((s) => s.paused);
  const clockOn = useGame((s) => s.clock.enabled);
  const myTurn = mode === 'local' || turn === human;
  return {
    canUndo: active && (historyLength > 0 || result !== null),
    canHint: training && !result && myTurn && !thinking && !paused,
    canDraw: !result && !paused && (mode === 'local' || (myTurn && !thinking)),
    canResign: !result && active,
    canPause: clockOn && !result && historyLength > 0,
    training,
    paused,
  };
}

function ActionGrid() {
  const c = useControls();
  const openDialog = useUi((s) => s.openDialog);
  const a = actions();
  return (
    <div className="action-grid">
      <button className="action" onClick={() => a.undo()} disabled={!c.canUndo} title="Zug zurücknehmen (U)">
        <IconUndo />
        <span>Zurück</span>
      </button>
      {c.training && (
        <button className="action accent" onClick={() => a.requestHint()} disabled={!c.canHint} title="Hinweis (H)">
          <IconHint />
          <span>Hinweis</span>
        </button>
      )}
      <button className="action" onClick={() => a.flipView()} title="Brett drehen (F)">
        <IconFlip />
        <span>Drehen</span>
      </button>
      {c.canPause || c.paused ? (
        <button className="action" onClick={() => a.setPaused(!c.paused)} title="Pause (P)">
          {c.paused ? <IconPlay /> : <IconPause />}
          <span>{c.paused ? 'Weiter' : 'Pause'}</span>
        </button>
      ) : null}
      <button className="action" onClick={() => a.offerDraw()} disabled={!c.canDraw}>
        <IconHandshake />
        <span>Remis</span>
      </button>
      <button className="action" onClick={() => openDialog('resign')} disabled={!c.canResign}>
        <IconFlag />
        <span>Aufgeben</span>
      </button>
      <button className="action" onClick={() => openDialog('restart')}>
        <IconRestart />
        <span>Neu</span>
      </button>
      <button className="action" onClick={() => a.saveNow()}>
        <IconSave />
        <span>Speichern</span>
      </button>
      <button className="action" onClick={() => openDialog('pgn')}>
        <IconPgn />
        <span>PGN</span>
      </button>
    </div>
  );
}

function SoundToggle() {
  const sound = useGame((s) => s.prefs.sound);
  return (
    <button className="icon-btn" onClick={() => actions().setPrefs({ sound: !sound })} aria-label={sound ? 'Ton aus' : 'Ton an'} title={sound ? 'Ton aus' : 'Ton an'}>
      <IconSound on={sound} />
    </button>
  );
}

function DesktopHud({ sidebar }: { sidebar: number }) {
  const viewSide = useGame((s) => s.viewSide);
  return (
    <>
      <div className="brand-corner">
        <span className="brand-mark">REBELL</span>
        <span className="brand-sub">CHESS 3D</span>
      </div>
      <aside className="sidebar" style={{ width: sidebar }}>
        <div className="sidebar-head">
          <SoundToggle />
          <button className="icon-btn" onClick={() => actions().openMenu()} aria-label="Menü" title="Menü (Esc)">
            <IconMenu />
          </button>
        </div>
        <PlayerCard color={opposite(viewSide)} />
        <StatusLine />
        <MoveList />
        <TrainingPanel />
        <PlayerCard color={viewSide} />
        <ActionGrid />
      </aside>
    </>
  );
}

function MobileHud() {
  const viewSide = useGame((s) => s.viewSide);
  const sheet = useUi((s) => s.sheet);
  const openSheet = useUi((s) => s.openSheet);
  const openDialog = useUi((s) => s.openDialog);
  const c = useControls();
  const showTraining = useGame((s) => s.settings.training && (s.hint !== null || s.feedback !== null));
  const sound = useGame((s) => s.prefs.sound);
  const a = actions();
  const statusRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Tatsächliche Höhe der Leisten messen, damit die Kamera das Brett in den freien Bereich legt
  useLayoutEffect(() => {
    const measure = () => {
      const top = statusRef.current?.getBoundingClientRect().bottom ?? 0;
      const bottomTop = bottomRef.current?.getBoundingClientRect().top ?? window.innerHeight;
      useUi.getState().setInsets({ top: Math.round(top + 6), bottom: Math.round(window.innerHeight - bottomTop + 6) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (statusRef.current) ro.observe(statusRef.current);
    if (bottomRef.current) ro.observe(bottomRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      useUi.getState().setInsets(null);
    };
  }, []);

  return (
    <>
      <div className="mobile-top">
        <PlayerCard color={opposite(viewSide)} />
        <button className="icon-btn" onClick={() => a.openMenu()} aria-label="Menü">
          <IconMenu />
        </button>
      </div>
      <div className="mobile-status" ref={statusRef}>
        <StatusLine />
      </div>
      <div className="mobile-bottom" ref={bottomRef}>
        {showTraining && <TrainingPanel compact />}
        <PlayerCard color={viewSide} />
        <nav className="mobile-bar">
          <button onClick={() => a.undo()} disabled={!c.canUndo}>
            <IconUndo />
            <span>Zurück</span>
          </button>
          {c.training && (
            <button onClick={() => a.requestHint()} disabled={!c.canHint} className="accent">
              <IconHint />
              <span>Hinweis</span>
            </button>
          )}
          <button onClick={() => a.flipView()}>
            <IconFlip />
            <span>Drehen</span>
          </button>
          <button onClick={() => openSheet(sheet === 'moves' ? null : 'moves')}>
            <IconList />
            <span>Züge</span>
          </button>
          <button onClick={() => openSheet(sheet === 'more' ? null : 'more')}>
            <IconMore />
            <span>Mehr</span>
          </button>
        </nav>
      </div>
      {sheet && (
        <div className="sheet-backdrop" onClick={() => openSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span>{sheet === 'moves' ? 'Zugliste' : 'Partie'}</span>
              <button className="icon-btn small" onClick={() => openSheet(null)} aria-label="Schließen">
                <IconClose />
              </button>
            </div>
            {sheet === 'moves' ? (
              <MoveList />
            ) : (
              <div className="sheet-actions">
                {(c.canPause || c.paused) && (
                  <button onClick={() => { a.setPaused(!c.paused); openSheet(null); }}>
                    {c.paused ? <IconPlay /> : <IconPause />} {c.paused ? 'Fortsetzen' : 'Pause'}
                  </button>
                )}
                <button onClick={() => { a.offerDraw(); openSheet(null); }} disabled={!c.canDraw}>
                  <IconHandshake /> Remis anbieten
                </button>
                <button onClick={() => openDialog('resign')} disabled={!c.canResign}>
                  <IconFlag /> Aufgeben
                </button>
                <button onClick={() => openDialog('restart')}>
                  <IconRestart /> Neue Partie (gleiche Einstellungen)
                </button>
                <button onClick={() => { a.saveNow(); openSheet(null); }}>
                  <IconSave /> Speichern
                </button>
                <button onClick={() => openDialog('pgn')}>
                  <IconPgn /> PGN exportieren / importieren
                </button>
                <button onClick={() => a.setPrefs({ sound: !sound })}>
                  <IconSound on={sound} /> Ton {sound ? 'aus' : 'an'}
                </button>
                {c.training && <TrainingPanel />}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function Hud({ layout }: { layout: Layout }) {
  return layout.desktop ? <DesktopHud sidebar={layout.sidebar} /> : <MobileHud />;
}
