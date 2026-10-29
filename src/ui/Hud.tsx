import { useEffect, useLayoutEffect, useRef } from 'react';
import { formatClock, timeLeft } from '../core/clock';
import { materialScore } from '../core/material';
import { opposite, PIECE_VALUES, type Color } from '../core/types';
import { gameStore, useGame } from '../game/instance';
import { displayPly } from '../game/store';
import { COLOR_NAME, FIGURINE, figurineSan, playerName, resultTitle } from './format';
import {
  IconClock,
  IconClose,
  IconExpand,
  IconFlag,
  IconFlip,
  IconHandshake,
  IconHint,
  IconList,
  IconMenu,
  IconMore,
  IconPanel,
  IconPause,
  IconPgn,
  IconPlay,
  IconRestart,
  IconSave,
  IconShrink,
  IconSound,
  IconUndo,
} from './icons';
import type { Layout } from './useLayout';
import { useNow } from './useLayout';
import { useUi } from './uiState';
import { fullscreenAvailable, toggleFullscreen, useFullscreen } from './fullscreen';
import { tr } from '../i18n';
import { BoardClocks, type ClockPadMode } from './BoardClocks';

const actions = () => gameStore.getState();

function ClockFace({ color }: { color: Color }) {
  const clock = useGame((s) => s.clock);
  const running = clock.running === color && clock.since !== null;
  const now = useNow(100, running);
  if (!clock.enabled) return null;
  const ms = timeLeft(clock, color, now);
  return (
    <div className={`clock${running ? ' running' : ''}${ms < 20_000 ? ' low' : ''}`} aria-label={`${tr('Restzeit')} ${COLOR_NAME[color]}`}>
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
        <div className="thinking" aria-label={tr('Stockfish denkt')}>
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
  } else if (paused) text = tr('Partie pausiert');
  else if (settings.mode === 'ai' && thinking) text = tr('Stockfish denkt …');
  else {
    const who =
      settings.mode === 'ai'
        ? status.turn === settings.humanColor
          ? tr('Du bist am Zug')
          : tr('Stockfish ist am Zug')
        : tr('{color} ist am Zug', { color: COLOR_NAME[status.turn] });
    text = status.inCheck ? `${tr('Schach!')} ${who}` : who;
    if (status.inCheck) tone = 'check';
  }
  return (
    <div className={`status-line ${tone}`} role="status" aria-live="polite">
      {text}
    </div>
  );
}

/** Bewertungsbalken: weißer Anteil nach Engine-Bewertung (aus Sicht von Weiß) */
export function EvalBar() {
  const analysis = useGame((s) => s.analysis);
  if (!analysis) return null;
  let share = 50;
  let label = '…';
  if (analysis.status === 'ready') {
    if (analysis.mate !== undefined) {
      share = analysis.mate > 0 ? 100 : 0;
      label = analysis.mate > 0 ? `${tr('Weiß setzt matt')}${analysis.mate > 1 ? ` ${tr('in')} ${analysis.mate}` : ''}` : `${tr('Schwarz setzt matt')}${analysis.mate < -1 ? ` ${tr('in')} ${-analysis.mate}` : ''}`;
    } else if (analysis.cp !== undefined) {
      share = 100 / (1 + Math.exp(-analysis.cp / 250));
      label = `${analysis.cp > 0 ? '+' : ''}${(analysis.cp / 100).toFixed(1)}`;
    }
  } else if (analysis.status === 'error') label = 'keine Bewertung';
  return (
    <div className="eval" aria-label={`${tr('Bewertung')} ${label}`}>
      <div className="eval-bar">
        <div className="eval-white" style={{ width: `${share}%` }} />
      </div>
      <div className="eval-text">
        <strong>{label}</strong>
        {analysis.best && <span> · bester Zug {figurineSan(analysis.best)}</span>}
      </div>
    </div>
  );
}

/** Hinweisleiste in der Analyse-Ansicht */
export function AnalysisBar({ compact = false }: { compact?: boolean }) {
  const viewPly = useGame((s) => s.viewPly);
  const history = useGame((s) => s.history);
  if (viewPly === null) return null;
  const move = viewPly > 0 ? history[viewPly - 1] : null;
  const number = move ? `${Math.ceil(viewPly / 2)}.${move.color === 'b' ? '..' : ''} ${figurineSan(move.san)}` : tr('Grundstellung');
  return (
    <div className={`analysis-bar${compact ? ' compact' : ''}`}>
      <span className="analysis-label">{tr('Analyse:')} {move ? `${tr('nach')} ${number}` : number}</span>
      {compact && (
        <>
          <button className="icon-btn small" onClick={() => actions().stepView(-1)} aria-label={tr('Zug zurück')}>
            ‹
          </button>
          <button className="icon-btn small" onClick={() => actions().stepView(1)} aria-label={tr('Zug vor')}>
            ›
          </button>
        </>
      )}
      <button className="btn small-btn" onClick={() => actions().viewMove(null)}>
        Zur Partie
      </button>
    </div>
  );
}

function MoveNav() {
  const total = useGame((s) => s.history.length);
  const shown = useGame(displayPly);
  if (total === 0) return null;
  const a = actions();
  return (
    <div className="move-nav">
      <button onClick={() => a.viewMove(0)} disabled={shown === 0} aria-label={tr('Zum Anfang')} title={tr('Anfang (Pos1)')}>
        ⏮
      </button>
      <button onClick={() => a.stepView(-1)} disabled={shown === 0} aria-label={tr('Zug zurück')} title={tr('Zurück (←)')}>
        ◀
      </button>
      <button onClick={() => a.stepView(1)} disabled={shown === total} aria-label={tr('Zug vor')} title={tr('Vor (→)')}>
        ▶
      </button>
      <button onClick={() => a.viewMove(null)} disabled={shown === total} aria-label={tr('Zur aktuellen Stellung')} title={tr('Ende (Ende)')}>
        ⏭
      </button>
    </div>
  );
}

export function MoveList() {
  const history = useGame((s) => s.history);
  const startFen = useGame((s) => s.startFen);
  const viewPly = useGame((s) => s.viewPly);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && viewPly === null) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [history.length, viewPly]);

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
  const current = (viewPly ?? history.length) - 1;
  const cell = (san: string | undefined, index: number | undefined, empty: string) =>
    san === undefined || index === undefined ? (
      <span className="move">{empty}</span>
    ) : (
      <button
        className={`move${index === current ? ' current' : ''}`}
        onClick={() => actions().viewMove(index + 1)}
        title={tr('Stellung nach diesem Zug ansehen')}
      >
        {san}
      </button>
    );

  return (
    <>
      <div className="move-list" ref={ref}>
        {rows.length === 0 && <div className="move-empty">{tr('Noch keine Züge')}</div>}
        {rows.map((r) => (
          <div className="move-row" key={r.n}>
            <span className="move-no">{r.n}.</span>
            {cell(r.w, r.wi, '…')}
            {cell(r.b, r.bi, '')}
          </div>
        ))}
      </div>
      <MoveNav />
    </>
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
          <span className="badge b-hint">{tr('Hinweis')}</span>
          <button className="icon-btn small" onClick={() => actions().clearHint()} aria-label={tr('Hinweis schließen')}>
            <IconClose />
          </button>
        </div>
        {hint.status === 'loading' && <p className="muted">{tr('Stockfish sucht den besten Zug …')}</p>}
        {hint.status === 'error' && <p className="muted">{tr('Die Schach-KI ist gerade nicht erreichbar.')}</p>}
        {hint.status === 'ready' && (
          <>
            <p className="training-title">{hint.title}</p>
            {!compact && hint.points?.map((p) => <p key={p} className="training-point">{p}</p>)}
            {compact && hint.points?.[0] && <p className="training-point">{hint.points[0]}</p>}
            {hint.evalText && <p className="muted small">{tr('Bewertung:')} {hint.evalText}</p>}
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
          {c ? <span className={`badge ${QUALITY_CLASS[c.quality]}`}>{c.label}</span> : <span className="badge">{tr('Analyse …')}</span>}
          <span className="training-move">{feedback.moveTitle}</span>
          <button className="icon-btn small" onClick={() => actions().dismissFeedback()} aria-label={tr('Bewertung schließen')}>
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
            <p className="training-title">{tr('Besser war:')} {figurineSan(feedback.better.san)}</p>
            {!compact && feedback.better.points.slice(0, 2).map((p) => <p key={p} className="training-point">{p}</p>)}
          </div>
        )}
        {feedback.status === 'error' && <p className="muted small">{tr('Bewertung nicht verfügbar.')}</p>}
        {feedback.evalText && !compact && <p className="muted small">{tr('Stellung:')} {feedback.evalText}</p>}
      </div>
    );
  }

  return (
    <div className="training-card intro">
      <span className="badge b-hint">{tr('Training')}</span>
      <p className="training-point">
        {tr('Nach jedem deiner Züge bewertet Stockfish ihn und erklärt die Idee. Mit')} <strong>{tr('Hinweis')}</strong> {tr('siehst du den besten Zug als Pfeil.')}
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
  const viewing = useGame((s) => s.viewPly !== null);
  const myTurn = (mode === 'local' || turn === human) && !viewing;
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
      <button className="action" onClick={() => a.undo()} disabled={!c.canUndo} title={tr('Zug zurücknehmen (U)')}>
        <IconUndo />
        <span>{tr('Zurück|undo')}</span>
      </button>
      {c.training && (
        <button className="action accent" onClick={() => a.requestHint()} disabled={!c.canHint} title={tr('Hinweis (H)')}>
          <IconHint />
          <span>{tr('Hinweis')}</span>
        </button>
      )}
      <button className="action" onClick={() => a.flipView()} title={tr('Brett drehen (F)')}>
        <IconFlip />
        <span>{tr('Drehen')}</span>
      </button>
      {c.canPause || c.paused ? (
        <button className="action" onClick={() => a.setPaused(!c.paused)} title={tr('Pause (P)')}>
          {c.paused ? <IconPlay /> : <IconPause />}
          <span>{c.paused ? tr('Weiter') : tr('Pause')}</span>
        </button>
      ) : null}
      <button className="action" onClick={() => a.offerDraw()} disabled={!c.canDraw}>
        <IconHandshake />
        <span>{tr('Remis')}</span>
      </button>
      <button className="action" onClick={() => openDialog('resign')} disabled={!c.canResign}>
        <IconFlag />
        <span>{tr('Aufgeben')}</span>
      </button>
      <button className="action" onClick={() => openDialog('restart')}>
        <IconRestart />
        <span>{tr('Neu')}</span>
      </button>
      <button className="action" onClick={() => a.saveNow()}>
        <IconSave />
        <span>{tr('Speichern')}</span>
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
    <button className="icon-btn" onClick={() => actions().setPrefs({ sound: !sound })} aria-label={sound ? tr('Ton aus') : tr('Ton an')} title={sound ? tr('Ton aus') : tr('Ton an')}>
      <IconSound on={sound} />
    </button>
  );
}

function FullscreenButton() {
  const on = useFullscreen();
  if (!fullscreenAvailable()) return null;
  return (
    <button className="icon-btn" onClick={toggleFullscreen} aria-label={on ? tr('Vollbild beenden') : tr('Vollbild')} title={on ? tr('Vollbild beenden (V)') : tr('Vollbild (V)')}>
      {on ? <IconShrink /> : <IconExpand />}
    </button>
  );
}

function ClocksToggle() {
  const on = useGame((s) => s.prefs.boardClocks);
  return (
    <button className={`icon-btn${on ? ' on' : ''}`} onClick={() => actions().setPrefs({ boardClocks: !on })} aria-pressed={on} aria-label={tr('Uhren am Brett ein/aus')} title={tr('Uhren am Brett ein/aus')}>
      <IconClock />
    </button>
  );
}

function PanelButton({ open }: { open: boolean }) {
  return (
    <button
      className="icon-btn"
      onClick={() => actions().setPrefs({ hideSidebar: open })}
      aria-label={open ? tr('Seitenleiste ausblenden') : tr('Seitenleiste zeigen')}
      title={open ? tr('Seitenleiste ausblenden (S)') : tr('Seitenleiste zeigen (S)')}
    >
      <IconPanel open={open} />
    </button>
  );
}

/** Kleine Uhr mit Name – für die schlanke Anzeige ohne Seitenleiste */
function MiniPlayer({ color }: { color: Color }) {
  const settings = useGame((s) => s.settings);
  const turn = useGame((s) => s.status.turn);
  const result = useGame((s) => s.result);
  const active = !result && turn === color;
  return (
    <div className={`mini-player${active ? ' active' : ''}`}>
      <span className={`piece-chip small chip-${color}`}>{FIGURINE.k}</span>
      <span className="mini-name">{playerName(settings, color)}</span>
      <ClockFace color={color} />
    </div>
  );
}

/** Ohne Seitenleiste: nur das Nötigste schwebt am Rand, das Brett nutzt die ganze Breite */
function FocusHud() {
  const viewSide = useGame((s) => s.viewSide);
  const c = useControls();
  return (
    <div className="focus-hud">
      <div className="focus-buttons">
        <PanelButton open={false} />
        <FullscreenButton />
        <ClocksToggle />
        <SoundToggle />
        <button className="icon-btn" onClick={() => actions().openMenu()} aria-label={tr('Menü')} title={tr('Menü (Esc)')}>
          <IconMenu />
        </button>
      </div>
      <MiniPlayer color={opposite(viewSide)} />
      <StatusLine />
      <MiniPlayer color={viewSide} />
      <div className="focus-buttons">
        <button className="icon-btn" onClick={() => actions().undo()} disabled={!c.canUndo} aria-label={tr('Zug zurücknehmen')} title={tr('Zug zurücknehmen (U)')}>
          <IconUndo />
        </button>
        <button className="icon-btn" onClick={() => actions().flipView()} aria-label={tr('Brett drehen')} title={tr('Brett drehen (F)')}>
          <IconFlip />
        </button>
      </div>
    </div>
  );
}

function DesktopHud({ sidebar, layout, padMode }: { sidebar: number; layout: Layout; padMode: ClockPadMode | null }) {
  const viewSide = useGame((s) => s.viewSide);
  const pads = padMode && <BoardClocks mode={padMode} sidebar={sidebar} areaWidth={layout.width - sidebar} areaHeight={layout.height} />;
  if (sidebar === 0)
    return (
      <>
        {pads}
        <FocusHud />
      </>
    );
  return (
    <>
      {pads}
      <div className="brand-corner">
        <span className="brand-mark">REBELL</span>
        <span className="brand-sub">CHESS 3D</span>
      </div>
      <aside className="sidebar" style={{ width: sidebar }}>
        <div className="sidebar-head">
          <PanelButton open />
          <FullscreenButton />
          <ClocksToggle />
          <SoundToggle />
          <button className="icon-btn" onClick={() => actions().openMenu()} aria-label={tr('Menü')} title={tr('Menü (Esc)')}>
            <IconMenu />
          </button>
        </div>
        <PlayerCard color={opposite(viewSide)} />
        <StatusLine />
        <AnalysisBar />
        <EvalBar />
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
  const viewing = useGame((s) => s.viewPly !== null);
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
        <button className="icon-btn" onClick={() => a.openMenu()} aria-label={tr('Menü')}>
          <IconMenu />
        </button>
      </div>
      <div className="mobile-status" ref={statusRef}>
        {viewing ? <AnalysisBar compact /> : <StatusLine />}
        <EvalBar />
      </div>
      <div className="mobile-bottom" ref={bottomRef}>
        {showTraining && <TrainingPanel compact />}
        <PlayerCard color={viewSide} />
        <nav className="mobile-bar">
          <button onClick={() => a.undo()} disabled={!c.canUndo}>
            <IconUndo />
            <span>{tr('Zurück|undo')}</span>
          </button>
          {c.training && (
            <button onClick={() => a.requestHint()} disabled={!c.canHint} className="accent">
              <IconHint />
              <span>{tr('Hinweis')}</span>
            </button>
          )}
          <button onClick={() => a.flipView()}>
            <IconFlip />
            <span>{tr('Drehen')}</span>
          </button>
          <button onClick={() => openSheet(sheet === 'moves' ? null : 'moves')}>
            <IconList />
            <span>{tr('Züge')}</span>
          </button>
          <button onClick={() => openSheet(sheet === 'more' ? null : 'more')}>
            <IconMore />
            <span>{tr('Mehr')}</span>
          </button>
        </nav>
      </div>
      {sheet && (
        <div className="sheet-backdrop" onClick={() => openSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span>{sheet === 'moves' ? tr('Zugliste') : tr('Partie')}</span>
              <button className="icon-btn small" onClick={() => openSheet(null)} aria-label={tr('Schließen')}>
                <IconClose />
              </button>
            </div>
            {sheet === 'moves' ? (
              <MoveList />
            ) : (
              <div className="sheet-actions">
                {(c.canPause || c.paused) && (
                  <button onClick={() => { a.setPaused(!c.paused); openSheet(null); }}>
                    {c.paused ? <IconPlay /> : <IconPause />} {c.paused ? tr('Fortsetzen') : tr('Pause')}
                  </button>
                )}
                <button onClick={() => { a.offerDraw(); openSheet(null); }} disabled={!c.canDraw}>
                  <IconHandshake /> {tr('Remis anbieten')}
                </button>
                <button onClick={() => openDialog('resign')} disabled={!c.canResign}>
                  <IconFlag /> {tr('Aufgeben')}
                </button>
                <button onClick={() => openDialog('restart')}>
                  <IconRestart /> {tr('Neue Partie (gleiche Einstellungen)')}
                </button>
                <button onClick={() => { a.saveNow(); openSheet(null); }}>
                  <IconSave /> {tr('Speichern')}
                </button>
                <button onClick={() => openDialog('pgn')}>
                  <IconPgn /> {tr('PGN exportieren / importieren')}
                </button>
                <button onClick={() => a.setPrefs({ sound: !sound })}>
                  <IconSound on={sound} /> {sound ? tr('Ton aus') : tr('Ton an')}
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

export function Hud({ layout, padMode }: { layout: Layout; padMode: ClockPadMode | null }) {
  const hidden = useGame((s) => s.prefs.hideSidebar);
  return layout.desktop ? <DesktopHud sidebar={hidden ? 0 : layout.sidebar} layout={layout} padMode={padMode} /> : <MobileHud />;
}
