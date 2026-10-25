# Lizenzen der verwendeten Bausteine

Alle Bausteine sind Open Source und kostenlos. Keine kostenpflichtigen Dienste, keine Laufzeit-Downloads.

| Paket | Lizenz | Verwendung |
|---|---|---|
| stockfish (Stockfish.js 19, Nathan Rugg / Stockfish-Team) | **GPL-3.0** | Schach-KI, läuft als eigenes Programm im Web Worker |
| chess.js | BSD-2-Clause | Regeln, Zuggenerierung, PGN |
| three | MIT | 3D-Grafik |
| @react-three/fiber, @react-three/drei | MIT | React-Anbindung, Kamera, Umgebungslicht |
| camera-controls (über drei) | MIT | Kamerasteuerung |
| react, react-dom | MIT | Oberfläche |
| zustand | MIT | Spielzustand |
| @fontsource/cinzel, @fontsource/inter | OFL-1.1 | Schriften (lokal gebündelt) |
| vite, vitest, typescript | MIT / Apache-2.0 | Entwicklung, Build, Tests |

## Stockfish (GPL-3.0) – was das bedeutet

- Stockfish wird **unverändert** als eigene Datei (`engine/stockfish-19-lite-single.js` + `.wasm`) ausgeliefert und
  nur über das UCI-Textprotokoll angesprochen.
- Der vollständige Lizenztext liegt im Build unter `engine/STOCKFISH-LICENSE-GPL-3.0.txt` und ist im Spiel unter
  *Anleitung → Lizenzen* verlinkt.
- Quelltext der Engine: https://github.com/official-stockfish/Stockfish und https://github.com/nmrugg/stockfish.js
- **Bei einer öffentlichen Veröffentlichung** muss der Quelltext von Stockfish (bzw. ein Hinweis, wo er erhältlich ist)
  mitgegeben werden – das ist durch Lizenzdatei und Links erfüllt. Ob das gesamte Spiel unter GPL gestellt werden muss,
  hängt von der rechtlichen Bewertung ab (eigenständiges Programm im Worker vs. „kombiniertes Werk“). Für die private
  Nutzung spielt das keine Rolle; vor einem kommerziellen Vertrieb bitte rechtlich prüfen lassen.

## Eigene Inhalte

- Figuren: prozedural im Code erzeugt (Drehkörper und Extrusion) – keine fremden 3D-Modelle.
- Texturen (Marmor, gebürstetes Metall, Koordinaten): zur Laufzeit im Canvas gezeichnet.
- Soundeffekte: mit der Web Audio API synthetisiert – keine Audiodateien.
