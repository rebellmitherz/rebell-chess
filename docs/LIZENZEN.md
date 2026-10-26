# Lizenzen der verwendeten Bausteine

Alle Bausteine sind Open Source und kostenlos. Keine kostenpflichtigen Dienste, keine Laufzeit-Downloads.

| Paket | Lizenz | Verwendung |
|---|---|---|
| stockfish (Stockfish.js 19, Nathan Rugg / Stockfish-Team) | **GPL-3.0** | Schach-KI, läuft als eigenes Programm im Web Worker |
| chess.js | BSD-2-Clause | Regeln, Zuggenerierung, PGN |
| three | MIT | 3D-Grafik |
| @react-three/fiber, @react-three/drei | MIT | React-Anbindung, Kamera, Umgebungslicht |
| camera-controls (über drei) | MIT | Kamerasteuerung |
| three-bvh-csg, three-mesh-bvh | MIT | Läuferkerbe (Stil „Rebell“), schneller Treffertest |
| @react-three/postprocessing, postprocessing, n8ao | MIT / Zlib / ISC | Kinoeffekte (Umgebungsverdeckung, Bloom, Vignette) |
| @gltf-transform/*, meshoptimizer | MIT | nur Entwicklung: Aufbereitung des Figurenmodells |
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

## Fremde Inhalte (alle CC0 – gemeinfrei, frei nutzbar auch kommerziell)

| Inhalt | Quelle | Lizenz | Verwendung |
|---|---|---|---|
| „Chess Set“ von **Riley Queen** | [Poly Haven](https://polyhaven.com/a/chess_set) | CC0 | Formen der klassischen Figuren + Verdeckungskarte (`public/models/`) |
| „Impact Sounds“ von **Kenney** | [kenney.nl](https://kenney.nl/assets/impact-sounds) | CC0 | Aufnahmen für Ziehen/Schlagen (`public/sounds/`, 20 von 130 Dateien) |
| Marmor-/Brett-Texturen aus „Chess Set“ (**Riley Queen**) | [Poly Haven](https://polyhaven.com/a/chess_set) | CC0 | Stil „Echt“: Figuren, Brett (`public/textures/`, `public/models/board.glb`) |
| Raumlicht „Lebombo“ (**Greg Zaal**) | [Poly Haven](https://polyhaven.com/a/lebombo) | CC0 | Beleuchtung/Hintergrund im Stil „Echt“ (`public/env/`) |
| Tischplatte „Wood Table 001“ (**Dimitrios Savva, Rico Cilliers**) | [Poly Haven](https://polyhaven.com/a/wood_table_001) | CC0 | Tisch unter dem Brett (`public/textures/table_*`) |

Rohdaten liegen nicht in Git; sie werden mit `npm run assets:pieces` (mit Prüfsummen) und `npm run assets:sounds`
neu erzeugt. Eine Namensnennung ist nicht vorgeschrieben – sie steht trotzdem hier und in der Spielanleitung.

## Eigene Inhalte

- Figurenstil „Rebell“: prozedural im Code erzeugt (Drehkörper, Extrusion, CSG).
- Materialien Gold/Onyx/Silber, Texturen (Marmor, gebürstetes Metall, Koordinaten): im Code erzeugt.
- Glockentöne und Bedienklänge: mit der Web Audio API synthetisiert.
- App-Symbole: mit `scripts/build-icons.py` erzeugt.
