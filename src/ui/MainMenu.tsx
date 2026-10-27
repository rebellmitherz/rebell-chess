import { useEffect, useState } from 'react';
import { canInstall, onInstallAvailable, promptInstall } from '../pwa';
import { playSfx } from '../audio/sound';
import type { Color } from '../core/types';
import { DIFFICULTY_LEVELS } from '../engine/difficulty';
import { gameStore, useGame } from '../game/instance';
import { TIME_CONTROLS, type GameMode, type GameSettings, type BattleMode, type GraphicsQuality, type PieceStyle, type ViewMode } from '../game/settings';
import { FIGURINE } from './format';

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
      <h2 className="panel-title">Neue Partie</h2>
      <div className="field">
        <span className="field-label">Gegner</span>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'ai', label: 'Stockfish-KI' },
            { value: 'local', label: 'Zwei Spieler' },
          ]}
        />
      </div>
      {mode === 'ai' && (
        <>
          <div className="field">
            <span className="field-label">Deine Farbe</span>
            <Segmented
              value={color}
              onChange={setColor}
              options={[
                { value: 'w', label: `${FIGURINE.k} Weiß` },
                { value: 'random', label: 'Zufall' },
                { value: 'b', label: `${FIGURINE.k} Schwarz` },
              ]}
            />
          </div>
          <div className="field">
            <span className="field-label">Spielstärke</span>
            <div className="level-grid">
              {DIFFICULTY_LEVELS.map((l) => (
                <button key={l.id} className={`level${level === l.id ? ' active' : ''}`} onClick={() => setLevel(l.id)} title={l.description}>
                  <span className="level-no">{l.id}</span>
                  <span className="level-name">{l.name}</span>
                  <span className="level-elo">{l.strength}</span>
                </button>
              ))}
            </div>
            <p className="field-hint">{DIFFICULTY_LEVELS.find((l) => l.id === level)?.description}</p>
          </div>
        </>
      )}
      <div className="field">
        <span className="field-label">Bedenkzeit</span>
        <div className="chip-grid">
          {TIME_CONTROLS.map((t) => (
            <button key={t.id} className={`chip${tc === t.id ? ' active' : ''}`} onClick={() => setTc(t.id)}>
              <strong>{t.label}</strong>
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      </div>
      <Toggle
        checked={training}
        onChange={setTraining}
        label="Trainingsmodus"
        hint="Hinweise per Knopfdruck, Bewertung und Erklärung jedes Zuges"
      />
      <div className="menu-actions">
        <button className="btn primary big" onClick={start}>
          Partie starten
        </button>
        <button className="btn ghost" onClick={onBack}>
          Zurück
        </button>
      </div>
    </div>
  );
}

function SettingsPanel({ onBack }: { onBack: () => void }) {
  const prefs = useGame((s) => s.prefs);
  const set = actions().setPrefs;
  return (
    <div className="menu-panel">
      <h2 className="panel-title">Einstellungen</h2>
      <div className="field">
        <span className="field-label">Grafikqualität</span>
        <Segmented<GraphicsQuality>
          value={prefs.graphics}
          onChange={(graphics) => set({ graphics })}
          options={[
            { value: 'high', label: 'Hoch' },
            { value: 'medium', label: 'Mittel' },
            { value: 'low', label: 'Niedrig' },
          ]}
        />
        <p className="field-hint">Niedrig schaltet Schatten und Partikel ab – für ältere Smartphones.</p>
      </div>
      <div className="field">
        <span className="field-label">Ansicht</span>
        <Segmented<ViewMode>
          value={prefs.viewMode}
          onChange={(viewMode) => set({ viewMode })}
          options={[
            { value: 'top', label: 'Gerade von oben' },
            { value: 'perspective', label: '3D schräg' },
          ]}
        />
        <p className="field-hint">Gerade: Brett von oben, Figuren zu dir geneigt – angetippt wird das Feld.</p>
      </div>
      <div className="field">
        <span className="field-label">Figurenstil</span>
        <Segmented<PieceStyle>
          value={prefs.pieceStyle}
          onChange={(pieceStyle) => set({ pieceStyle })}
          options={[
            { value: 'real', label: 'Echt' },
            { value: 'classic', label: 'Edel' },
            { value: 'rebell', label: 'Rebell' },
          ]}
        />
        <p className="field-hint">
          Echt: Marmorfiguren auf tiefschwarzem Brett im Wohnzimmerlicht. Edel: goldene und schwarze Figuren auf Smaragdgrün. Rebell: Elfenbein und Schwarz auf Rot, eigene
          Figuren.
        </p>
      </div>
      <div className="field">
        <span className="field-label">Beim Schlagen</span>
        <Segmented<BattleMode>
          value={prefs.battleMode}
          onChange={(battleMode) => set({ battleMode })}
          options={[
            { value: 'warriors', label: 'Wichtige' },
            { value: 'always', label: 'Immer' },
            { value: 'quick', label: 'Kurz' },
            { value: 'off', label: 'Aus' },
          ]}
        />
        <p className="field-hint">
          Wichtige: Nur bei großen Momenten (Dame, Turm, Matt, Bauer schlägt Figur …) kämpfen die Figuren als Krieger,
          sonst gibt es einen schnellen Schlag mit Mini-Explosion. Immer: bei jedem Schlag ein Kriegerkampf. Kurz: immer
          der schnelle Schlag. Aus: schlicht. Ein Kampf lässt sich durch Tippen überspringen, die Uhr steht so lange.
        </p>
      </div>
      <Toggle checked={prefs.sound} onChange={(sound) => set({ sound })} label="Soundeffekte" />
      {prefs.sound && (
        <label className="slider-row">
          <span className="toggle-label">Lautstärke</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(prefs.volume * 100)}
            onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
            onPointerUp={() => playSfx('move')}
            aria-label="Lautstärke"
          />
          <span className="slider-value">{Math.round(prefs.volume * 100)} %</span>
        </label>
      )}
      <Toggle checked={prefs.showLegalMoves} onChange={(showLegalMoves) => set({ showLegalMoves })} label="Legale Züge anzeigen" />
      <Toggle checked={prefs.showLastMove} onChange={(showLastMove) => set({ showLastMove })} label="Letzten Zug markieren" />
      <Toggle checked={prefs.showCoordinates} onChange={(showCoordinates) => set({ showCoordinates })} label="Koordinaten am Brettrand" />
      <Toggle
        checked={prefs.turnBoard}
        onChange={(turnBoard) => set({ turnBoard })}
        label="Brett zum Spieler am Zug drehen"
        hint="Zwei Spieler an einem Gerät: Nach jedem Zug dreht sich das Brett zum anderen Spieler"
      />
      <div className="menu-actions">
        <button className="btn ghost" onClick={onBack}>
          Zurück
        </button>
      </div>
    </div>
  );
}

function HelpPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="menu-panel help">
      <h2 className="panel-title">Anleitung</h2>
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
        Stockfish jede Stellung (Balken, Zahl, bester Zug). „Zur Partie“ führt zurück.
      </p>
      <h3>Speichern</h3>
      <p>Die Partie wird nach jedem Zug automatisch im Browser gespeichert. Über „PGN“ lässt sie sich exportieren und auf anderen Geräten laden.</p>
      <h3>Als App</h3>
      <p>
        Android, Chrome, Edge: „Als App installieren“ im Hauptmenü oder im Browsermenü. iPhone/iPad (Safari): Teilen →
        „Zum Home-Bildschirm“. Nach dem ersten Laden läuft das Spiel auch ohne Internet.
      </p>
      <h3>Lizenzen</h3>
      <p>
        Schach-KI: Stockfish 19 (GPL-3.0, <a href="engine/STOCKFISH-LICENSE-GPL-3.0.txt" target="_blank" rel="noreferrer">Lizenztext</a>,
        Quelltext: github.com/official-stockfish/Stockfish und github.com/nmrugg/stockfish.js). Regeln: chess.js (BSD-2-Clause).
        3D: three.js, React Three Fiber, three-bvh-csg (MIT). Schriften Cinzel und Inter (OFL-1.1).
        Figuren und Brett: „Chess Set“ von Riley Queen, Raumlicht „Lebombo“, Tisch „Wood Table 001“ (alle Poly Haven,
        CC0). Krieger und Kampfbewegungen: Adobe Mixamo („Paladin“, „Pro Sword and Shield Pack“). Aufnahmen: „Impact Sounds“ von Kenney (CC0). Stil „Rebell“, Texturen und Glockentöne sind im Code erzeugt.
      </p>
      <div className="menu-actions">
        <button className="btn ghost" onClick={onBack}>
          Zurück
        </button>
      </div>
    </div>
  );
}

export function MainMenu() {
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
          <p className="tagline">3D-Schach, in dem die Figuren kämpfen</p>
        </header>
        {panel === 'home' && (
          <nav className="menu-list">
            {active && (
              <button className="btn primary big" onClick={() => actions().closeMenu()}>
                {result ? 'Zurück zum Brett' : 'Zurück zur Partie'}
              </button>
            )}
            {!active && hasSave && (
              <button className="btn primary big" onClick={() => actions().continueSaved()}>
                Gespeicherte Partie fortsetzen
              </button>
            )}
            <button className={`btn big${!active && !hasSave ? ' primary' : ''}`} onClick={() => setPanel('new')}>
              Neue Partie
            </button>
            <button className="btn" onClick={() => setPanel('settings')}>
              Einstellungen
            </button>
            <button className="btn" onClick={() => setPanel('help')}>
              Anleitung
            </button>
            {installable && (
              <button className="btn" onClick={() => void promptInstall()}>
                Als App installieren
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
