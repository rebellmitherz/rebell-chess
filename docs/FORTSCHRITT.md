# Rebell Chess 3D – Fortschritt

Stand: 25.10.2026 · Version 0.1.0

Legende: **getestet** = automatischer Test vorhanden und grün · **im Browser geprüft** = von Hand in der laufenden App
ausprobiert (Chromium, Desktop- und Smartphone-Ansicht emuliert) · **offen** = noch nicht vorhanden.

## Phasenstand

| Phase | Stand |
|---|---|
| 1 Architektur & Plan | fertig (`ARCHITEKTUR.md`, `ENTWICKLUNGSPLAN.md`) |
| 2 3D-Prototyp mit funktionierendem Brett | fertig |
| 3 Vollständig spielbare Partie + Tests | fertig |
| 4 Stockfish, Stufen, Training | fertig (Grundumfang) |
| 5 Grafik/Sound/Performance-Feinschliff | teilweise – siehe „Offen“ |
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
| Legale Züge hervorheben, letzter Zug, Auswahl | im Browser geprüft |
| Schachuhren (7 Bedenkzeiten, Inkrement, Pause, Zeitüberschreitung inkl. FIDE-Remisregel) | getestet; laufende Uhr im Browser geprüft |
| Zugliste (Figurinen-Notation) | im Browser geprüft |
| Rückgängig (lokal 1 Halbzug, gegen KI bis zum eigenen Zug) | getestet, im Browser geprüft |
| Neustart, Aufgeben (mit Rückfrage), Ergebnisfenster | getestet; Aufgabe + Ergebnisfenster im Browser geprüft |
| Remisangebot (lokal: Gegner entscheidet; KI: nimmt an, wenn sie schlechter steht) | getestet |
| Trainingsmodus: Hinweis mit Pfeil, Bewertung jedes Zuges, Erklärung, besserer Zug | getestet, im Browser mit echter Engine geprüft |
| Autospeichern + „Gespeicherte Partie fortsetzen“ (Zugfolge wird beim Laden regelgeprüft) | getestet, im Browser geprüft |
| PGN exportieren (Kopieren/Datei) und importieren | getestet; Export-Dialog im Browser geprüft |
| Einstellungen: Grafik Hoch/Mittel/Niedrig, Ton, Hilfen, Koordinaten, Auto-Drehen | gespeichert und getestet; Umschalten der Grafikstufe nicht einzeln im Browser durchgeklickt |
| Kamera: drehen, zoomen, Seitenwechsel, Anpassung an Bildschirm und HUD | im Browser geprüft (Desktop 1100×700, Smartphone 375×812, 766×646) |
| Animationen: Zug (Springer springt), Schlagen (versinken + Funken), Umwandlung, Auswahl | sichtbar im Browser; nicht automatisch testbar |
| Soundeffekte (synthetisch) | eingebaut; **nicht hörbar geprüft** (Testumgebung ohne Ton) |
| Produktions-Build | geprüft: Build läuft, KI antwortet in der gebauten Version |

## Offen / bekannte Grenzen

- **Echtes Smartphone** wurde noch nicht getestet (nur emulierte Größen im Desktop-Browser). Leistung auf älteren
  Geräten unbekannt → ggf. Grafik „Mittel/Niedrig“.
- **Ziehen per Drag & Drop** fehlt – nur Antippen/Anklicken.
- **Figuren**: prozedural erzeugte Staunton-Formen. Der Springer ist eine stilisierte Extrusion, der Läufer hat nur
  eine angedeutete Kerbe. Ein hochwertiger CC0-Modellsatz (z. B. Poly Haven) wäre möglich – nur nach Freigabe des Downloads.
- **Sounds** sind synthetisch; aufgenommene CC0-Samples wären hochwertiger.
- **Elo-Angaben** der Stufen sind Richtwerte (Stockfish-Kalibrierung gilt für das volle Netz, hier läuft das Lite-Netz).
- Remis durch Wiederholung/50 Züge wird automatisch gewertet (keine „Reklamation“ wie im Turnier).
- Zugliste: Zurückspringen zu einer früheren Stellung (Analyse-Modus) fehlt.
- Bundle-Größe ~1,4 MB JS (383 kB gzip) + 1,8 MB Engine – noch kein Code-Splitting.
- Kein Hosting/Deployment eingerichtet (nur lokaler Build).
