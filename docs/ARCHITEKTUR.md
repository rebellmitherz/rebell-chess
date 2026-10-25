# Rebell Chess 3D – Technische Architektur

Stand: 25.10.2026 · nach Phase 4 aktualisiert

## Ziel

Ein vollständig spielbares 3D-Schachspiel im Browser (Windows-PC und moderne Smartphones).
Regelkonform, mit lokalem Zwei-Spieler-Modus, Stockfish-Gegner, Schachuhren, Training,
Speichern/Laden und einem hochwertigen Schwarz-Gold-Silber-Look.

## Technologie

| Bereich | Bibliothek | Lizenz | Zweck |
|---|---|---|---|
| Sprache | TypeScript | Apache-2.0 | Typsicherheit |
| UI | React 19 | MIT | Menüs, HUD, Dialoge |
| Build | Vite 8 | MIT | Dev-Server, Produktions-Build |
| 3D | three.js, @react-three/fiber, @react-three/drei | MIT | Szene, Licht, Kamera, Material |
| Regeln | chess.js 1.x | BSD-2-Clause | Zuggenerierung, Matt/Patt/Remis, FEN/PGN |
| Zustand | zustand 5 | MIT | Spielfluss-Store |
| KI | stockfish (Stockfish.js 19, Lite, single-threaded) | GPL-3.0 | Gegner, Hinweise, Zugbewertung |
| Schrift | @fontsource/cinzel, @fontsource/inter | OFL-1.1 | Lokal gebündelt, kein Netz nötig |
| CSG | three-bvh-csg, three-mesh-bvh | MIT | Läuferkerbe (Geometrie-Subtraktion) |
| Tests | Vitest | MIT | Regeln, Uhr, Speichern, Engine, Spielfluss |

Keine kostenpflichtigen Dienste, kein Server, keine Laufzeit-Downloads von fremden CDNs.
Alles läuft offline aus dem Build-Ordner.

Stockfish läuft als **eigenes Programm in einem Web Worker** und spricht nur das
UCI-Textprotokoll. Die GPL-Lizenzdatei wird mit ausgeliefert (`public/engine/`), siehe `LIZENZEN.md`.
Die Lite-Single-Thread-Variante braucht keine Sonder-Header (kein `SharedArrayBuffer`) und
läuft deshalb auf jedem statischen Webspace und auf Smartphones.

## Schichten

```
src/
  core/      Reine Schachlogik – kein React, kein DOM, voll getestet
    chessGame.ts      Hülle um chess.js: Züge, Rückgängig, Status, Remisgründe, PGN
    clock.ts          Schachuhr als reine Funktionen (Bedenkzeit, Inkrement, Zeitüberschreitung)
    pieceTracking.ts  Stabile Figuren-IDs über die Zugfolge (für 3D-Animationen)
    explain.ts        Verständliche Zugerklärungen + Zugbewertung für den Trainingsmodus
    material.ts       Materialzählung, „genug Material zum Mattsetzen?“
  engine/    Engine-Anbindung – unabhängig von UI und 3D
    uci.ts            Parser für UCI-Ausgaben (info, bestmove)
    StockfishEngine.ts  Promise-API über ein austauschbares Transport-Objekt
    workerTransport.ts  Browser-Transport (Web Worker)
    difficulty.ts     Schwierigkeitsstufen (Skill Level / UCI_Elo / Zeit)
  game/      Spielfluss – verbindet core + engine
    store.ts          zustand-Store: Modus, Auswahl, Züge, Uhr, Ergebnis, KI-Züge, Training
    engineService.ts  Zwei Stockfish-Instanzen (Spielen / Analysieren) hinter einer kleinen Schnittstelle
    persistence.ts    Spielstand serialisieren, prüfen, wiederherstellen (localStorage)
    settings.ts       Einstellungen + Zeitkontrollen
    drop.ts           Regel für das Loslassen einer gezogenen Figur (Drag & Drop)
    instance.ts       Die eine Store-Instanz der App (echte Engine + Browser-Speicher)
  scene/     3D-Darstellung – liest nur den Store, schreibt nur über Actions
    ChessScene.tsx    Canvas, Licht, Umgebung, Schatten, Kamera
    Board.tsx         Brett, Rahmen, Koordinaten, Feld-Klicks
    Pieces.tsx        Figuren mit Bewegungs- und Schlag-Animation
    pieceGeometry.ts  Prozedurale Staunton-Figuren (Lathe + Extrude, gemergt)
    materials.ts      PBR-Materialien (Gold, Onyx, Silber)
    Highlights.tsx    Legale Züge, letzter Zug, Schach, Hinweis-Pfeil, Zielfeld beim Ziehen
    DragController.tsx  Drag & Drop: Zeiger → Brettebene, Ablegen über store.dropPiece
    interaction.ts    Gemeinsamer Zieh-/Aktivitätszustand, Zugriff auf die Kamerasteuerung
    Performance.tsx   Bildrate nach Bedarf, Schatten nur bei Bewegung, adaptive Pixeldichte
  ui/        React-Oberfläche – Menüs, HUD, Dialoge
  audio/     Soundeffekte (Web Audio, synthetisch erzeugt – keine Fremdlizenz)
```

**Abhängigkeitsrichtung:** `ui`/`scene` → `game` → `core` + `engine`.
`core` und `engine` kennen weder React noch three.js.

## Datenfluss

1. Spieler klickt ein Feld in der 3D-Szene → `store.selectSquare(square)`.
2. Store fragt `ChessGame.legalMovesFrom()` → Zielfelder werden hervorgehoben.
3. Klick aufs Zielfeld → `store.tryMove()`; bei Bauernumwandlung öffnet sich erst der Auswahldialog.
4. `ChessGame.move()` prüft und führt aus; Store aktualisiert Uhr, Figuren-IDs, Status, Autospeicherung.
5. Ist danach die KI am Zug, ruft der Store `engineService.playMove(fen, stufe)` auf und führt den Zug aus
   (veraltete Antworten nach Rückgängig/Neustart werden verworfen).
6. Szene und HUD rendern aus dem Store neu; Figuren animieren über stabile IDs.

## Regeln und Entscheidungen

- **Remis automatisch** bei Patt, ungenügendem Material, dreifacher Stellungswiederholung und
  50-Züge-Regel (wie bei den großen Online-Plattformen). Remis durch Einigung im lokalen Modus.
- **Zeitüberschreitung:** Verlust, außer der Gegner kann gar nicht mehr mattsetzen → Remis (FIDE 6.9).
- **Uhrstart:** Die Uhr startet nach dem ersten Zug von Weiß (dann läuft Schwarz). Inkrement nach jedem Zug.
- **Rückgängig:** lokal ein Halbzug, gegen die KI bis zum letzten eigenen Zug (zwei Halbzüge).
- **Speichern:** Autospeicherung nach jedem Zug in `localStorage`; beim Start „Partie fortsetzen“.
  Gespeichert wird die Zugfolge (UCI), beim Laden wird jeder Zug erneut regelgeprüft.
- **Engine-Stärke:** Stufen 1–2 Skill Level + gelegentliche Zufallszüge, Stufen 3–5 `UCI_Elo`,
  Stufe 6 volle Stärke mit Zeitlimit. Elo-Angaben sind Richtwerte („ca.“).

## Testbarkeit

- `core` vollständig mit Vitest getestet (Rochade, en passant, Umwandlung, Matt, Patt, Remisregeln,
  Uhr, Speichern, Figuren-IDs, Erklärungen).
- `StockfishEngine` hängt an einem Transport-Interface: im Browser Web Worker, im Test die echte
  Stockfish-WASM in Node.js. Der Engine-Test spielt also gegen die echte Engine.
- Der Spielfluss-Store wird mit einer Test-Engine geprüft (KI-Zug, Rückgängig gegen KI, Zeitablauf).

## Grafik-Leistung

- Figuren-Geometrie einmal pro Figurtyp erzeugt und geteilt; Materialien geteilt.
- Qualitätsstufen Hoch/Mittel/Niedrig (Pixeldichte, Schattenauflösung, weiche Schatten, Partikel, Ruhe-Bildrate).
- `frameloop="demand"`: volle Bildrate nur bei Interaktion, Animation und Kamerafahrt, sonst 15–30 fps.
- Schattenkarte wird nur neu berechnet, während sich Figuren bewegen.
- Pixeldichte sinkt automatisch, wenn das Gerät in aktiven Phasen unter ~40 fps fällt.
- Bibliotheken als eigene Build-Dateien (three, R3F, React, chess.js) – bleiben bei App-Updates im Cache.
- Messwerte: `docs/FORTSCHRITT.md` → Abschnitt „Leistung“.
- Automatische Voreinstellung „Mittel“ auf Touch-Geräten.
- Effekte (Partikel, Glanz) liegen außerhalb des Bretts oder sind dezent – Lesbarkeit hat Vorrang.
