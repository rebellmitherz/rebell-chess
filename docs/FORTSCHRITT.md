# Rebell Chess 3D – Fortschritt

Stand: 25.10.2026 · Version 0.2.0

Legende: **getestet** = automatischer Test vorhanden und grün · **im Browser geprüft** = von Hand in der laufenden App
ausprobiert (Chromium, Desktop- und Smartphone-Ansicht emuliert) · **offen** = noch nicht vorhanden.

## Phasenstand

| Phase | Stand |
|---|---|
| 1 Architektur & Plan | fertig (`ARCHITEKTUR.md`, `ENTWICKLUNGSPLAN.md`) |
| 2 3D-Prototyp mit funktionierendem Brett | fertig |
| 3 Vollständig spielbare Partie + Tests | fertig |
| 4 Stockfish, Stufen, Training | fertig (Grundumfang) |
| 5 Grafik/Sound/Performance-Feinschliff | fertig für 0.2.0: Drag & Drop, Läuferkerbe, modellierter Springer, neue Sounds, Lautstärke, Leistungsoptimierung – offen siehe unten |
| 6 Produktions-Build | Build läuft (`npm run build`), Vorschau im Browser geprüft; kein Hosting eingerichtet |

## Funktionen

| Funktion | Stand |
|---|---|
| Alle Schachregeln (inkl. Fesselung, Schachabwehr) | getestet (chess.js + 21 Regeltests) |
| Rochade kurz/lang, Verbote (Schach, bedrohtes Feld, König gezogen) | getestet |
| En passant (nur direkt nach Doppelschritt) | getestet |
| Bauernumwandlung mit Auswahl Dame/Turm/Läufer/Springer | getestet, Dialog im Browser geprüft |
| Schach / Schachmatt / Patt erkennen und anzeigen | getestet; Schach-Anzeige (rotes Leuchten) im Browser geprüft |
| Remis: ungenügendes Material, dreifache Wiederholung, 50-Züge-Regel, Einigung | getestet (automatisch, wie bei Online-Plattformen) |
| Lokaler Zwei-Spieler-Modus | getestet, im Browser geprüft |
| Gegner Stockfish 19 (Lite, WASM) in 7 Stufen | Engine-Tests gegen die echte Engine; Stufe 3 und 4 im Browser geprüft |
| **Ziehen per Drag & Drop** (zusätzlich zu Antippen/Klicken) | getestet (Ablage-Logik, Store); im Browser mit Maus geprüft: legaler Zug, illegales Feld (Figur springt zurück), Kamera dreht beim Ziehen nicht mit, Ziehen neben dem Brett dreht weiter die Kamera; auch im Produktions-Build |
| Legale Züge hervorheben, letzter Zug, Auswahl, Zielfeld beim Ziehen | im Browser geprüft |
| Schachuhren (7 Bedenkzeiten, Inkrement, Pause, Zeitüberschreitung inkl. FIDE-Remisregel) | getestet; laufende Uhr im Browser geprüft |
| Zugliste (Figurinen-Notation) | im Browser geprüft |
| Rückgängig (lokal 1 Halbzug, gegen KI bis zum eigenen Zug) | getestet, im Browser geprüft |
| Neustart, Aufgeben (mit Rückfrage), Ergebnisfenster | getestet; Aufgabe + Ergebnisfenster im Browser geprüft |
| Remisangebot (lokal: Gegner entscheidet; KI: nimmt an, wenn sie schlechter steht) | getestet |
| Trainingsmodus: Hinweis mit Pfeil, Bewertung jedes Zuges, Erklärung, besserer Zug | getestet, im Browser mit echter Engine geprüft |
| Autospeichern + „Gespeicherte Partie fortsetzen“ (Zugfolge wird beim Laden regelgeprüft) | getestet, im Browser geprüft |
| PGN exportieren (Kopieren/Datei) und importieren | getestet; Export-Dialog im Browser geprüft |
| Einstellungen: Grafik Hoch/Mittel/Niedrig, Ton, **Lautstärke**, Hilfen, Koordinaten, Auto-Drehen | gespeichert und getestet; alle drei Grafikstufen im Browser durchgeschaltet (fehlerfrei) |
| **Figuren**: Läufer mit echter, durchgehender Kerbe (CSG); Springer modelliert (schmales Maul, Wangen, Maulspalte, Nüstern, Augen, Mähne, weich schattiert) | getestet (Geometrie: Höhe, keine Fehlwerte, Kerbe per Strahltest, Maul schmaler als Hals); im Browser aus der Nähe geprüft |
| Kamera: drehen, zoomen, Seitenwechsel, Anpassung an Bildschirm und HUD | im Browser geprüft (Desktop 1100×700, Smartphone 375×812, 766×646) |
| Animationen: Zug (Springer springt), Ziehen, Schlagen (versinken + Funken), Umwandlung | sichtbar im Browser; nicht automatisch testbar |
| **Soundeffekte** (Modal-Synthese: Holz/Lack-Resonanzen, Brettkörper, Raumhall, Glockentöne; jede Wiedergabe leicht variiert) | technisch geprüft (Offline-Rendering aller 11 Effekte: kein Übersteuern, Spitzenpegel −10 bis −20 dB, keine Fehlwerte); **nicht hörbar geprüft** (Testumgebung ohne Ton) |
| Produktions-Build | geprüft: Build läuft, Drag & Drop, Klick-Zug und KI-Antwort in der gebauten Version |

## Leistung (gemessen 25.10.2026, Chromium im Desktop-PC, 766×646, Partie in Grundstellung)

| Messgröße | vorher (0.1.0) | jetzt (0.2.0) |
|---|---|---|
| Dreiecke pro Bild (inkl. Schatten) | 1 131 260 | 235 240 (−79 %) |
| Draw Calls pro Bild | 114 | 80 |
| Bilder pro Sekunde in Ruhe (Hoch/Mittel/Niedrig) | 60 / 60 / – | 30 / 20 / 15 |
| Bilder pro Sekunde bei Kamerabewegung | 60 | 60 / 60 / 59 |
| Schatten-Neuberechnung in Ruhe | jedes Bild | keine (nur während Zügen, gemessen 36× beim Springerzug, danach 0) |
| CPU-Zeit pro Bild | ~2 ms | ~1,3–1,6 ms |
| Figuren-Aufbau beim Start | ~470 ms (Node) | 161 ms (Browser), davon Springer 100 ms, Läufer 41 ms |
| JS-Bundle (gzip) | 1 Datei, 383 kB | App 32 kB + Bibliotheken (three 220, R3F 81, React 64, chess.js 12 kB) – Bibliotheken bleiben bei Updates im Cache |

Maßnahmen: Profilkurven nach Länge statt gleichmäßig abgetastet, 48 statt 64 Segmente, gröbere Unterteilung beim
Springer; Bildrate nach Bedarf (volle Rate nur bei Interaktion/Animation); Schattenkarte nur bei Figurenbewegung;
Pixeldichte passt sich automatisch an, wenn das Gerät bei Bewegung unter ~40 fps fällt (nie über die Bildschirmauflösung).

Dabei gefunden und behoben: Die Grafikstufe **„Niedrig“** zeigte seit 0.1.0 ein schwarzes Bild (Fehler in jedem Bild,
weil der Goldstaub mit 0 Partikeln trotzdem animiert wurde).

**Grenze der Messung:** gemessen auf der Grafikkarte dieses PCs. Echte Smartphones wurden nicht gemessen – die Werte
zeigen die Last (Dreiecke, Draw Calls, Bildrate in Ruhe), nicht die tatsächliche Bildrate auf einem Handy.

## Offen / bekannte Grenzen

- **Echtes Smartphone** wurde noch nicht getestet (nur emulierte Größen im Desktop-Browser). Insbesondere
  **Drag & Drop per Finger** ist nur mit Maus geprüft – die Touch-Logik nutzt dieselben Pointer-Events, ist aber
  ungetestet.
- **Sounds** wurden nur technisch gemessen, nicht angehört. Aufgenommene CC0-Samples wären eine Alternative
  (nur nach Freigabe eines Downloads).
- **Figuren**: weiterhin prozedural; ein hochwertiger CC0-Modellsatz (z. B. Poly Haven) bleibt möglich – nur nach Freigabe.
- **Elo-Angaben** der Stufen sind Richtwerte (Stockfish-Kalibrierung gilt für das volle Netz, hier läuft das Lite-Netz).
- Remis durch Wiederholung/50 Züge wird automatisch gewertet (keine „Reklamation“ wie im Turnier).
- Zugliste: Zurückspringen zu einer früheren Stellung (Analyse-Modus) fehlt.
- Kein Hosting/Deployment eingerichtet (nur lokaler Build).
