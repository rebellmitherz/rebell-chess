import { useEffect, useState, type ReactNode } from 'react';
import { PIECE_NAMES } from '../core/explain';
import { opposite, PROMOTION_PIECES } from '../core/types';
import { gameStore, useGame } from '../game/instance';
import { COLOR_NAME, FIGURINE, resultReason, resultScore, resultTitle } from './format';
import { useUi } from './uiState';

const actions = () => gameStore.getState();

function Modal({ children, onClose, wide = false }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function PromotionDialog() {
  const pending = useGame((s) => s.pendingPromotion);
  const turn = useGame((s) => s.status.turn);
  if (!pending) return null;
  return (
    <Modal onClose={() => actions().choosePromotion(null)}>
      <h2 className="modal-title">Bauernumwandlung</h2>
      <p className="modal-text">Wähle die neue Figur für das Feld {pending.to}.</p>
      <div className="promo-grid">
        {PROMOTION_PIECES.map((p) => (
          <button key={p} className={`promo-btn promo-${turn}`} onClick={() => actions().choosePromotion(p)} autoFocus={p === 'q'}>
            <span className="promo-glyph">{FIGURINE[p]}</span>
            <span>{PIECE_NAMES[p]}</span>
          </button>
        ))}
      </div>
      <button className="btn ghost full" onClick={() => actions().choosePromotion(null)}>
        Abbrechen
      </button>
    </Modal>
  );
}

export function GameOverDialog() {
  const result = useGame((s) => s.result);
  const settings = useGame((s) => s.settings);
  const gameId = useGame((s) => s.gameId);
  const plies = useGame((s) => s.history.length);
  const screen = useGame((s) => s.screen);
  const dismissed = useUi((s) => s.dismissedResultKey);
  const dismiss = useUi((s) => s.dismissResult);
  const openDialog = useUi((s) => s.openDialog);
  if (!result || screen !== 'game') return null;
  const key = `${gameId}-${plies}-${result.reason}`;
  if (dismissed === key) return null;
  const won = settings.mode === 'ai' && result.winner === settings.humanColor;
  return (
    <Modal onClose={() => dismiss(key)}>
      <div className={`result-crest${result.winner === null ? ' draw' : won || settings.mode === 'local' ? ' win' : ' loss'}`}>{resultScore(result)}</div>
      <h2 className="modal-title">{resultTitle(result, settings)}</h2>
      <p className="modal-text">{resultReason(result)}</p>
      <div className="modal-actions">
        <button className="btn primary" onClick={() => actions().restart()}>
          Neue Partie
        </button>
        <button className="btn" onClick={() => actions().undo()}>
          Zug zurücknehmen
        </button>
        <button className="btn" onClick={() => dismiss(key)}>
          Brett ansehen
        </button>
        <button
          className="btn"
          onClick={() => {
            dismiss(key);
            openDialog('pgn');
          }}
        >
          PGN speichern
        </button>
        <button className="btn ghost" onClick={() => actions().openMenu()}>
          Hauptmenü
        </button>
      </div>
    </Modal>
  );
}

export function DrawOfferDialog() {
  const offer = useGame((s) => s.drawOffer);
  if (!offer) return null;
  return (
    <Modal>
      <h2 className="modal-title">Remisangebot</h2>
      <p className="modal-text">
        {COLOR_NAME[offer.by]} bietet Remis an. Nimmt {COLOR_NAME[opposite(offer.by)]} an?
      </p>
      <div className="modal-actions row">
        <button className="btn primary" onClick={() => actions().answerDraw(true)}>
          Annehmen
        </button>
        <button className="btn" onClick={() => actions().answerDraw(false)}>
          Ablehnen
        </button>
      </div>
    </Modal>
  );
}

export function PauseOverlay() {
  const paused = useGame((s) => s.paused);
  const screen = useGame((s) => s.screen);
  const result = useGame((s) => s.result);
  if (!paused || screen !== 'game' || result) return null;
  return (
    <Modal>
      <h2 className="modal-title">Partie pausiert</h2>
      <p className="modal-text">Die Uhren sind angehalten.</p>
      <button className="btn primary full" onClick={() => actions().setPaused(false)} autoFocus>
        Fortsetzen
      </button>
    </Modal>
  );
}

export function ConfirmDialogs() {
  const dialog = useUi((s) => s.dialog);
  const openDialog = useUi((s) => s.openDialog);
  const close = () => openDialog(null);
  if (dialog === 'resign') {
    return (
      <Modal onClose={close}>
        <h2 className="modal-title">Aufgeben?</h2>
        <p className="modal-text">Die Partie wird als verloren gewertet.</p>
        <div className="modal-actions row">
          <button
            className="btn danger"
            onClick={() => {
              actions().resign();
              close();
            }}
          >
            Aufgeben
          </button>
          <button className="btn" onClick={close} autoFocus>
            Weiterspielen
          </button>
        </div>
      </Modal>
    );
  }
  if (dialog === 'restart') {
    return (
      <Modal onClose={close}>
        <h2 className="modal-title">Neue Partie starten?</h2>
        <p className="modal-text">Die aktuelle Partie wird beendet. Modus, Stärke und Bedenkzeit bleiben gleich.</p>
        <div className="modal-actions row">
          <button
            className="btn primary"
            onClick={() => {
              actions().restart();
              close();
            }}
          >
            Neu starten
          </button>
          <button className="btn" onClick={close}>
            Abbrechen
          </button>
        </div>
      </Modal>
    );
  }
  if (dialog === 'pgn') return <PgnDialog onClose={close} />;
  return null;
}

function PgnDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [pgn] = useState(() => actions().exportPgn());
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pgn);
      setCopied(true);
    } catch {
      actions().showToast('Kopieren nicht möglich – bitte den Text markieren und kopieren.');
    }
  };
  const download = () => {
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rebell-chess-${new Date().toISOString().slice(0, 10)}.pgn`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Modal onClose={onClose} wide>
      <h2 className="modal-title">PGN</h2>
      <div className="tabs">
        <button className={tab === 'export' ? 'active' : ''} onClick={() => setTab('export')}>
          Exportieren
        </button>
        <button className={tab === 'import' ? 'active' : ''} onClick={() => setTab('import')}>
          Importieren
        </button>
      </div>
      {tab === 'export' ? (
        <>
          <textarea className="pgn-text" readOnly value={pgn} rows={8} onFocus={(e) => e.currentTarget.select()} />
          <div className="modal-actions row">
            <button className="btn primary" onClick={copy}>
              {copied ? 'Kopiert ✓' : 'Kopieren'}
            </button>
            <button className="btn" onClick={download}>
              Als Datei speichern
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="modal-text">PGN einer Partie einfügen. Sie wird geprüft und als lokale Partie geladen.</p>
          <textarea className="pgn-text" value={input} onChange={(e) => setInput(e.target.value)} rows={8} placeholder='[Event "…"]&#10;1. e4 e5 2. Nf3 …' />
          <div className="modal-actions row">
            <button
              className="btn primary"
              disabled={!input.trim()}
              onClick={() => {
                if (actions().importPgn(input)) onClose();
              }}
            >
              Partie laden
            </button>
          </div>
        </>
      )}
      <button className="btn ghost full" onClick={onClose}>
        Schließen
      </button>
    </Modal>
  );
}

export function Toast() {
  const toast = useGame((s) => s.toast);
  const [visible, setVisible] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    setVisible(toast.id);
    const t = window.setTimeout(() => setVisible((v) => (v === toast.id ? null : v)), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);
  if (!toast || visible !== toast.id) return null;
  return (
    <div className="toast" role="status">
      {toast.text}
    </div>
  );
}
