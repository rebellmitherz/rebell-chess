import { useEffect, useState } from 'react';
import { canInstall, onInstallAvailable, promptInstall } from '../pwa';
import { playSfx } from '../audio/sound';
import type { Color } from '../core/types';
import { DIFFICULTY_LEVELS } from '../engine/difficulty';
import { gameStore, useGame } from '../game/instance';
import { TIME_CONTROLS, type GameMode, type GameSettings, type BattleMode, type GraphicsQuality, type PieceStyle, type ViewMode } from '../game/settings';
import { FIGURINE } from './format';
import type { Lang } from '../i18n';
import { getLang, tr } from '../i18n';
import { isPortal } from '../portal';

type Panel = 'home' | 'new' | 'settings' | 'help';
type ColorChoice = Color | 'random';

const actions = () => gameStore.getState();

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        {hint && <span className="toggle-hint">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-switch" aria-hidden="true" />
    </label>
  );
}

function NewGamePanel({ onBack }: { onBack: () => void }) {
  useGame((s) => s.prefs.lang); // bei Sprachwechsel neu zeichnen
  const last = useGame((s) => s.settings);
  const [mode, setMode] = useState<GameMode>(last.mode);
  const [color, setColor] = useState<ColorChoice>(last.humanColor);
  const [level, setLevel] = useState(last.aiLevel);
  const [tc, setTc] = useState(last.timeControlId);
  const [training, setTraining] = useState(last.training);

  const start = () => {
    const humanColor: Color = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
    const settings: GameSettings = { mode, humanColor, aiLevel: level, timeControlId: tc, training };
    actions().startGame(settings);
  };

  return (
    <div className="menu-panel">
      <h2 className="panel-title">{tr('Neue Partie')}</h2>
      <div className="field">
        <span className="field-label">{tr('Gegner')}</span>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'ai', label: tr('Rebell-KI') },
            { value: 'local', label: tr('Zwei Spieler') },
          ]}
        />
      </div>
      {mode === 'ai' && (
        <>
          <div className="field">
            <span className="field-label">{tr('Deine Farbe')}</span>
            <Segmented
              value={color}
              onChange={setColor}
              options={[
                { value: 'w', label: `${FIGURINE.k} ${tr('Weiß')}` },
                { value: 'random', label: tr('Zufall') },
                { value: 'b', label: `${FIGURINE.k} ${tr('Schwarz')}` },
              ]}
            />
          </div>
          <div className="field">
            <span className="field-label">{tr('Spielstärke')}</span>
            <div className="level-grid">
              {DIFFICULTY_LEVELS.map((l) => (
                <button key={l.id} className={`level${level === l.id ? ' active' : ''}`} onClick={() => setLevel(l.id)} title={tr(l.description)}>
                  <span className="level-no">{l.id}</span>
                  <span className="level-name">{tr(l.name)}</span>
                  <span className="level-elo">{tr(l.strength)}</span>
                </button>
              ))}
            </div>
            <p className="field-hint">{tr(DIFFICULTY_LEVELS.find((l) => l.id === level)?.description ?? '')}</p>
          </div>
        </>
      )}
      <div className="field">
        <span className="field-label">{tr('Bedenkzeit')}</span>
        <div className="chip-grid">
          {TIME_CONTROLS.map((t) => (
            <button key={t.id} className={`chip${tc === t.id ? ' active' : ''}`} onClick={() => setTc(t.id)}>
              <strong>{t.label}</strong>
              <span>{tr(t.name)}</span>
            </button>
          ))}
        </div>
      </div>
      <Toggle
        checked={training}
        onChange={setTraining}
        label={tr('Trainingsmodus')}
        hint={tr('Hinweise per Knopfdruck, Bewertung und Erklärung jedes Zuges')}
      />
      <div className="menu-actions">
        <button className="btn primary big" onClick={start}>
          {tr('Partie starten')}
        </button>
        <button className="btn ghost" onClick={onBack}>
          {tr('Zurück')}
        </button>
      </div>
    </div>
  );
}

function SettingsPanel({ onBack }: { onBack: () => void }) {
  useGame((s) => s.prefs.lang); // bei Sprachwechsel neu zeichnen
  const prefs = useGame((s) => s.prefs);
  const set = actions().setPrefs;
  return (
    <div className="menu-panel">
      <h2 className="panel-title">{tr('Einstellungen')}</h2>
      <div className="field">
        <span className="field-label">Sprache / Language</span>
        <Segmented<Lang>
          value={prefs.lang}
          onChange={(lang) => set({ lang })}
          options={[
            { value: 'de', label: 'Deutsch' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>
      <div className="field">
        <span className="field-label">{tr('Grafikqualität')}</span>
        <Segmented<GraphicsQuality>
          value={prefs.graphics}
          onChange={(graphics) => set({ graphics })}
          options={[
            { value: 'high', label: tr('Hoch') },
            { value: 'medium', label: tr('Mittel') },
            { value: 'low', label: tr('Niedrig') },
          ]}
        />
        <p className="field-hint">{tr('Niedrig schaltet Schatten und Partikel ab – für ältere Smartphones.')}</p>
      </div>
      <div className="field">
        <span className="field-label">{tr('Ansicht')}</span>
        <Segmented<ViewMode>
          value={prefs.viewMode}
          onChange={(viewMode) => set({ viewMode })}
          options={[
            { value: 'top', label: tr('Gerade von oben') },
            { value: 'perspective', label: tr('3D schräg') },
          ]}
        />
        <p className="field-hint">{tr('Gerade: Brett von oben, Figuren zu dir geneigt – angetippt wird das Feld.')}</p>
      </div>
      <div className="field">
        <span className="field-label">{tr('Figurenstil')}</span>
        <Segmented<PieceStyle>
          value={prefs.pieceStyle}
          onChange={(pieceStyle) => set({ pieceStyle })}
          options={[
            { value: 'real', label: tr('Echt') },
            { value: 'classic', label: tr('Edel') },
            { value: 'rebell', label: tr('Rebell') },
          ]}
        />
        <p className="field-hint">
          {tr('Echt: Marmorfiguren auf tiefschwarzem Brett im Wohnzimmerlicht. Edel: goldene und schwarze Figuren auf Smaragdgrün. Rebell: Elfenbein und Schwarz auf Rot, eigene Figuren.')}
        </p>
      </div>
      <div className="field">
        <span className="field-label">{tr('Beim Schlagen')}</span>
        <Segmented<BattleMode>
          value={prefs.battleMode}
          onChange={(battleMode) => set({ battleMode })}
          options={[
            { value: 'warriors', label: tr('Wichtige') },
            { value: 'always', label: tr('Immer') },
            { value: 'quick', label: tr('Kurz') },
            { value: 'off', label: tr('Aus') },
          ]}
        />
        <p className="field-hint">
          {tr('Wichtige: Nur bei großen Momenten (Dame, Turm, Matt, Bauer schlägt Figur …) kämpfen die Figuren als Krieger, sonst gibt es einen schnellen Schlag mit Mini-Explosion. Immer: bei jedem Schlag ein Kriegerkampf. Kurz: immer der schnelle Schlag. Aus: schlicht. Ein Kampf lässt sich durch Tippen überspringen, die Uhr steht so lange.')}
        </p>
      </div>
      <Toggle checked={prefs.sound} onChange={(sound) => set({ sound })} label={tr('Soundeffekte')} />
      {prefs.sound && (
        <label className="slider-row">
          <span className="toggle-label">{tr('Lautstärke')}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(prefs.volume * 100)}
            onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
            onPointerUp={() => playSfx('move')}
            aria-label={tr('Lautstärke')}
          />
          <span className="slider-value">{Math.round(prefs.volume * 100)} %</span>
        </label>
      )}
      <Toggle checked={prefs.showLegalMoves} onChange={(showLegalMoves) => set({ showLegalMoves })} label={tr('Legale Züge anzeigen')} />
      <Toggle checked={prefs.showLastMove} onChange={(showLastMove) => set({ showLastMove })} label={tr('Letzten Zug markieren')} />
      <Toggle checked={prefs.showCoordinates} onChange={(showCoordinates) => set({ showCoordinates })} label={tr('Koordinaten am Brettrand')} />
      <Toggle
        checked={prefs.turnBoard}
        onChange={(turnBoard) => set({ turnBoard })}
        label={tr('Brett zum Spieler am Zug drehen')}
        hint={tr('Zwei Spieler an einem Gerät: Nach jedem Zug dreht sich das Brett zum anderen Spieler')}
      />
      <div className="menu-actions">
        <button className="btn ghost" onClick={onBack}>
          {tr('Zurück')}
        </button>
      </div>
    </div>
  );
}

function HelpPanel({ onBack }: { onBack: () => void }) {
  useGame((s) => s.prefs.lang); // bei Sprachwechsel neu zeichnen
  const en = getLang() === 'en';
  return (
    <div className="menu-panel help">
      <h2 className="panel-title">{tr('Anleitung')}</h2>
      {en ? (
        <>
          <h3>Moving</h3>
          <p>Tap or click a piece, then its target square – or drag the piece onto the target square. Dots show legal moves, rings show captures.</p>
          <h3>Capturing</h3>
          <p>
            On important captures (queen, rook, checkmate …) both pieces turn into warriors – paladins, and every fight plays out differently. All other captures are quick and go off with a small explosion. The clock stops until the fight is over.
            Tapping, clicking, <kbd>Space</kbd> or <kbd>Esc</kbd> skips it; under Settings → “On captures” there are also “Quick” and “Off”.
          </p>
          <h3>Camera</h3>
          <p>Mouse wheel or two fingers zoom, right mouse button or two fingers move the view. In the “3D angled” view, dragging on empty space turns the board. “Flip” switches sides.</p>
          <h3>Keyboard</h3>
          <p>
            <kbd>U</kbd> undo · <kbd>F</kbd> flip board · <kbd>H</kbd> hint · <kbd>P</kbd> pause · <kbd>S</kbd> sidebar on/off · <kbd>V</kbd> full screen · <kbd>Esc</kbd> menu · <kbd>←</kbd> <kbd>→</kbd> browse through the game
          </p>
          <h3>Rules</h3>
          <p>
            All chess rules including castling, en passant and promotion. Draws by stalemate, insufficient material, threefold repetition and the 50-move rule. If time runs out the opponent wins – unless they can no longer checkmate, then it is a draw.
          </p>
          <h3>Analysis</h3>
          <p>
            Clicking a move in the move list shows the position after it. In training mode and after the game, the Rebell AI rates every position (bar, number, best move). “Back to game” takes you back.
          </p>
          <h3>Saving</h3>
          <p>The game is saved automatically in your browser after every move. With “PGN” you can export it and load it on other devices.</p>
          {!isPortal && (
            <>
              <h3>As an app</h3>
              <p>
                Android, Chrome, Edge: “Install as app” in the main menu or the browser menu. iPhone/iPad (Safari): Share → “Add to Home Screen”. After the first load the game also runs offline.
              </p>
            </>
          )}
          <h3>Licences</h3>
          <p>
            Chess engine: Stockfish 19 (GPL-3.0, <a href="engine/STOCKFISH-LICENSE-GPL-3.0.txt" target="_blank" rel="noreferrer">licence text</a>, source: github.com/official-stockfish/Stockfish and github.com/nmrugg/stockfish.js). Rules: chess.js (BSD-2-Clause).
            3D: three.js, React Three Fiber, three-bvh-csg (MIT). Fonts Cinzel and Inter (OFL-1.1).
            Pieces and board: “Chess Set” by Riley Queen, room light “Lebombo”, table “Wood Table 001” (all Poly Haven, CC0). Warriors and fight moves: Adobe Mixamo (“Paladin”, “Pro Sword and Shield Pack”). Recordings: “Impact Sounds” by Kenney (CC0). The “Rebel” style, textures and bell tones are generated in code.
          </p>
        </>
      ) : (
        <>
          <h3>Ziehen</h3>
          <p>
            Figur antippen oder anklicken, dann das Zielfeld – oder die Figur direkt aufs Zielfeld ziehen. Punkte zeigen legale
            Züge, Ringe zeigen Schlagzüge.
          </p>
          <h3>Schlagen</h3>
          <p>
            Bei wichtigen Schlägen (Dame, Turm, Matt …) werden beide Figuren zu Kriegern – Paladine, jeder Kampf läuft anders ab. Alle anderen Schläge sind kurz und knallen mit einer kleinen Explosion. Die Uhr steht, bis
            der Kampf vorbei ist. Antippen, Klick, Leertaste oder <kbd>Esc</kbd> überspringen ihn; unter Einstellungen →
            „Beim Schlagen“ gibt es auch „Kurz“ und „Aus“.
          </p>
          <h3>Kamera</h3>
          <p>
            Mausrad oder zwei Finger zoomen, rechte Maustaste oder zwei Finger verschieben. In der Ansicht „3D schräg“ dreht
            Ziehen auf freier Fläche das Brett. „Drehen“ wechselt die Seite.
          </p>
          <h3>Tastatur</h3>
          <p>
            <kbd>U</kbd> Zug zurück · <kbd>F</kbd> Brett drehen · <kbd>H</kbd> Hinweis · <kbd>P</kbd> Pause · <kbd>S</kbd> Seitenleiste ein/aus · <kbd>V</kbd> Vollbild · <kbd>Esc</kbd> Menü ·
            <kbd>←</kbd> <kbd>→</kbd> durch die Partie blättern
          </p>
          <h3>Regeln</h3>
          <p>
            Alle Schachregeln inklusive Rochade, en passant und Bauernumwandlung. Remis bei Patt, ungenügendem Material,
            dreifacher Stellungswiederholung und nach der 50-Züge-Regel. Bei Zeitüberschreitung gewinnt der Gegner – außer er
            kann gar nicht mehr mattsetzen, dann ist es Remis.
          </p>
          <h3>Analyse</h3>
          <p>
            Ein Klick auf einen Zug in der Zugliste zeigt die Stellung danach. Im Trainingsmodus und nach Partieende bewertet
            die Rebell-KI jede Stellung (Balken, Zahl, bester Zug). „Zur Partie“ führt zurück.
          </p>
          <h3>Speichern</h3>
          <p>Die Partie wird nach jedem Zug automatisch im Browser gespeichert. Über „PGN“ lässt sie sich exportieren und auf anderen Geräten laden.</p>
          {!isPortal && (
            <>
              <h3>Als App</h3>
              <p>
                Android, Chrome, Edge: „Als App installieren“ im Hauptmenü oder im Browsermenü. iPhone/iPad (Safari): Teilen →
                „Zum Home-Bildschirm“. Nach dem ersten Laden läuft das Spiel auch ohne Internet.
              </p>
            </>
          )}
          <h3>Lizenzen</h3>
          <p>
            Schach-KI: Stockfish 19 (GPL-3.0, <a href="engine/STOCKFISH-LICENSE-GPL-3.0.txt" target="_blank" rel="noreferrer">Lizenztext</a>,
            Quelltext: github.com/official-stockfish/Stockfish und github.com/nmrugg/stockfish.js). Regeln: chess.js (BSD-2-Clause).
            3D: three.js, React Three Fiber, three-bvh-csg (MIT). Schriften Cinzel und Inter (OFL-1.1).
            Figuren und Brett: „Chess Set“ von Riley Queen, Raumlicht „Lebombo“, Tisch „Wood Table 001“ (alle Poly Haven,
            CC0). Krieger und Kampfbewegungen: Adobe Mixamo („Paladin“, „Pro Sword and Shield Pack“). Aufnahmen: „Impact Sounds“ von Kenney (CC0). Stil „Rebell“, Texturen und Glockentöne sind im Code erzeugt.
          </p>
        </>
      )}
      <div className="menu-actions">
        <button className="btn ghost" onClick={onBack}>
          {tr('Zurück')}
        </button>
      </div>
    </div>
  );
}

/** Kleine Sprachwahl oben im Menü */
function LangSwitch() {
  const lang = useGame((s) => s.prefs.lang);
  return (
    <div className="lang-switch" role="radiogroup" aria-label="Language">
      {(['de', 'en'] as const).map((l) => (
        <button key={l} role="radio" aria-checked={lang === l} className={lang === l ? 'active' : ''} onClick={() => actions().setPrefs({ lang: l })}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function MainMenu() {
  useGame((s) => s.prefs.lang); // bei Sprachwechsel neu zeichnen
  const [panel, setPanel] = useState<Panel>('home');
  const active = useGame((s) => s.active);
  const hasSave = useGame((s) => s.hasSave);
  const result = useGame((s) => s.result);
  const [installable, setInstallable] = useState(canInstall);
  useEffect(() => onInstallAvailable(() => setInstallable(canInstall())), []);
  const back = () => setPanel('home');

  return (
    <div className="menu-overlay">
      <div className="menu-card">
        <header className="menu-brand">
          <div className="crest">{FIGURINE.n}</div>
          <h1>
            <span className="brand-mark">REBELL</span> <span className="brand-chess">CHESS</span>
          </h1>
          <p className="tagline">{tr('3D-Schach, in dem die Figuren kämpfen')}</p>
          <LangSwitch />
        </header>
        {panel === 'home' && (
          <nav className="menu-list">
            {active && (
              <button className="btn primary big" onClick={() => actions().closeMenu()}>
                {result ? tr('Zurück zum Brett') : tr('Zurück zur Partie')}
              </button>
            )}
            {!active && hasSave && (
              <button className="btn primary big" onClick={() => actions().continueSaved()}>
                {tr('Gespeicherte Partie fortsetzen')}
              </button>
            )}
            <button className={`btn big${!active && !hasSave ? ' primary' : ''}`} onClick={() => setPanel('new')}>
              {tr('Neue Partie')}
            </button>
            <button className="btn" onClick={() => setPanel('settings')}>
              {tr('Einstellungen')}
            </button>
            <button className="btn" onClick={() => setPanel('help')}>
              {tr('Anleitung')}
            </button>
            {installable && (
              <button className="btn" onClick={() => void promptInstall()}>
                {tr('Als App installieren')}
              </button>
            )}
          </nav>
        )}
        {panel === 'new' && <NewGamePanel onBack={back} />}
        {panel === 'settings' && <SettingsPanel onBack={back} />}
        {panel === 'help' && <HelpPanel onBack={back} />}
      </div>
    </div>
  );
}
