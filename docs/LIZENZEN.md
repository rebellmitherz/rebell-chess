# Lizenzen der verwendeten Bausteine

Alle fremden Bausteine sind Open Source und kostenlos, ihre Lizenzen erlauben auch kommerzielle Nutzung. Keine kostenpflichtigen Dienste, keine Laufzeit-Downloads.

| Paket | Lizenz | Verwendung |
|---|---|---|
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

## Schach-KI

Die KI (`src/engine/rebell/`) ist eigener Code: Zuggenerator, Bewertung mit von Hand gesetzten Tabellen, Suche und
Eröffnungsbuch (allgemein bekannte Zugfolgen). Stockfish (GPL-3.0) wurde bis Version 0.12.1 mitgeliefert und ist seit
0.13.0 vollständig entfernt. Für die Stärkemessung der Stufen lief es einmalig lokal als Gegner, es ist nicht Teil des Spiels.

## Mixamo (Adobe) – Krieger und Kampfbewegungen

- Figur „Paladin W/Prop J Nordstrom“ und das „Pro Sword and Shield Pack“ von [mixamo.com](https://www.mixamo.com), von Emilio mit seinem Adobe-Konto heruntergeladen.
- Nutzung in Spielen (auch veröffentlicht, auch kommerziell) ist erlaubt und lizenzfrei; die Dateien dürfen aber **nicht als Einzeldateien weitergegeben** werden. Deshalb liegen `public/models/warrior_*.glb` **nicht in Git** (`.gitignore`) und werden nur umgewandelt und komprimiert in die fertige Seite gebaut. Neu erzeugen: Rohdaten nach `assets-src/mixamo/` legen, dann `npm run assets:warriors`.
- Nicht gemeinfrei: vor einem kommerziellen Vertrieb die Adobe-Bedingungen prüfen.

## Fremde Inhalte (alle CC0 – gemeinfrei, frei nutzbar auch kommerziell)

| Inhalt | Quelle | Lizenz | Verwendung |
|---|---|---|---|
| „Chess Set“ von **Riley Queen** | [Poly Haven](https://polyhaven.com/a/chess_set) | CC0 | Formen der klassischen Figuren + Verdeckungskarte (`public/models/`) |
| „Impact Sounds“ von **Kenney** | [kenney.nl](https://kenney.nl/assets/impact-sounds) | CC0 | Aufnahmen für Ziehen/Schlagen und den Kriegerkampf (`public/sounds/`, 45 von 130 Dateien) |
| Marmor-/Brett-Texturen aus „Chess Set“ (**Riley Queen**) | [Poly Haven](https://polyhaven.com/a/chess_set) | CC0 | Stil „Echt“: Figuren, Brett (`public/textures/`, `public/models/board.glb`) |
| Raumlicht „Lebombo“ (**Greg Zaal**) | [Poly Haven](https://polyhaven.com/a/lebombo) | CC0 | Beleuchtung/Hintergrund im Stil „Echt“ (`public/env/`) |
| Tischplatte „Wood Table 001“ (**Dimitrios Savva, Rico Cilliers**) | [Poly Haven](https://polyhaven.com/a/wood_table_001) | CC0 | Tisch unter dem Brett (`public/textures/table_*`) |

Rohdaten liegen nicht in Git; sie werden mit `npm run assets:pieces`, `npm run assets:real`, (alle mit Prüfsummen) und `npm run assets:sounds` neu erzeugt. Eine Namensnennung ist nicht vorgeschrieben – sie steht trotzdem hier und in der Spielanleitung.

## Eigene Inhalte

- Spielcode und Schach-KI: © rebellmitherz, alle Rechte vorbehalten (siehe `LICENSE`).
- Figurenstil „Rebell“: prozedural im Code erzeugt (Drehkörper, Extrusion, CSG).
- Materialien Gold/Onyx/Silber, Texturen (Marmor, gebürstetes Metall, Koordinaten): im Code erzeugt.
- Glockentöne und Bedienklänge: mit der Web Audio API synthetisiert.
- App-Symbole: mit `scripts/build-icons.py` erzeugt.
