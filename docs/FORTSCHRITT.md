# Rebell Chess 3D – Fortschritt

Stand: 05.11.2026 · Version 0.15.0 · online: https://rebellmitherz.github.io/rebell-chess/

Legende: **getestet** = automatischer Test vorhanden und grün · **im Browser geprüft** = von Hand in der laufenden App
ausprobiert (Chromium, Desktop- und Smartphone-Ansicht emuliert) · **offen** = noch nicht vorhanden.

## Phasenstand

| Phase | Stand |
|---|---|
| 1 Architektur & Plan | fertig (`ARCHITEKTUR.md`, `ENTWICKLUNGSPLAN.md`) |
| 2 3D-Prototyp mit funktionierendem Brett | fertig |
| 3 Vollständig spielbare Partie + Tests | fertig |
| 4 Stockfish, Stufen, Training | fertig (Grundumfang) |
| 5 Grafik/Sound/Performance-Feinschliff | fertig: CC0-Figurenmodell, Kinoeffekte, CC0-Aufnahmen, Drag & Drop, Leistung |
| 6 Produktions-Build | fertig: GitHub Pages (`npm run deploy`), installierbar (PWA), offline geprüft |

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
| **Klassische Figuren** (CC0-Modell „Chess Set“, Poly Haven) mit Gold/Onyx und Verdeckungskarte; Stil „Rebell“ wählbar | getestet (Modelldatei: alle Typen, Maße, Größe); im Browser aus der Nähe geprüft |
| **Kinoeffekte** (Stufe Hoch): Umgebungsverdeckung, Bloom, ACES, Vignette | im Browser geprüft (31 zusätzliche Render-Durchgänge gemessen = Effekte aktiv) |
| **Echte Aufnahmen** für Ziehen/Schlagen/Rochade (CC0, Kenney), Synthese als Rückfall | technisch geprüft (Dekodierung im Browser, Pegel −9 bis −12 dB, kein Übersteuern); **nicht angehört** |
| **Analyse-Modus**: Zugliste anklickbar, ⏮ ◀ ▶ ⏭, Pfeiltasten, Stockfish-Bewertung mit Balken + bestem Zug (nur Training/Partieende) | getestet (4 Tests); im Browser mit echter Engine geprüft |
| **Als App installierbar + offline** (Manifest, Symbole, Service Worker) | im Browser geprüft: Server gestoppt → Spiel lädt, Stockfish rechnet aus dem Speicher |
| **Veröffentlichung** GitHub Pages | live geprüft: Seite, Engine (application/wasm), Modell, Sounds, Service Worker; Partie gegen Stockfish gespielt |
| **Kampf-Animation beim Schlagen**: Ausholen, Ansturm, Einschlag (Lichtblitz, Druckwelle, Funken, Beben, Metallklang), Gegner fliegt zurück und zerspringt in Splitter | getestet (Bewegungskurven: 6 Tests); im Browser als Bildfolge aufgenommen und geprüft; abschaltbar |
| **Lebendige Züge**: Neigen in Zugrichtung, federnde Landung; Auswahl schwebt; Schach: König zittert; Matt: König kippt um | im Browser geprüft (Matt-Umkippen nur im Code geprüft, nicht gefilmt) |
| **Kamera wie am echten Brett**: flacher Blick (≈56° PC, ≈50° Handy), so nah wie möglich, Figuren von der Seite erkennbar | im Browser geprüft (PC-Fenster und Smartphone 375×812) |
| **Zwei Spieler**: Brett dreht sich nach jedem Zug zum Spieler am Zug (nach der Landung) | getestet (2 Tests); Standard an |
| **Stil „Echt“ (Standard)**: polierte Marmorfiguren und Marmorbrett mit echten Texturen, Holztisch, Wohnraum-Licht (HDRI), unscharfer Raum im Hintergrund; „Edel“ (Gold/Onyx) und „Rebell“ wählbar | im Browser geprüft (PC und Smartphone 375×812) |
| **Größeres Brett**: längere Brennweite (28°), knappe Einpassung, schmale Handy-Leisten, Hochformat steiler | im Browser geprüft; im Hochformat begrenzt die Bildschirmbreite die Größe |
| **Ansicht „Gerade von oben“ (Standard)**: Brett exakt von oben, jede Figur zum Spieler geneigt (Form erkennbar), angetippt/gezogen wird das Feld; „3D schräg“ wählbar | im Browser geprüft (PC und Smartphone 375×812) |
| **Kriegerkampf nur bei wichtigen Schlägen (Standard)** – Dame/Turm geschlagen, Matt, Bauer schlägt Figur, Schach mit Beute, sonst schneller Schlag mit Mini-Explosion (0,6 s); nach 4 schnellen Schlägen bekommt die nächste Beute einen Kampf, direkt nach einem Kampf keiner (Regeln in `src/game/battleRules.ts`, 9 Tests); Einstellung Wichtige / Immer / Kurz / Aus. Der Kampf selbst: beide Figuren werden zu realistischen Paladinen (Mixamo, Weiß in goldener, Schwarz in schwarzer Rüstung, Schwert und Schild) mit 28 Motion-Capture-Bewegungen. Jeder Kampf wird neu gewürfelt: 8 Szenarien (Duell, Blitzangriff, Schlaghagel, Comeback, Tritt, Schlagabtausch, Konter, Verhöhnen), passend zu den Figuren (Bauer gegen Dame kämpft sich zurück, Dame macht kurzen Prozess), zufällige Bewegungen und Tempo, die letzten Szenarien werden gemieden. Kamera mit Schnitten (Totale, über die Schulter, Froschperspektive, von oben, Todesstoß, Siegerpose), Zeitlupe, Trefferstopp, Schwertspuren, Ausfallschritte treiben den Gegner zurück, Schachfiguren im Bild tauchen weg | getestet (Drehbuch 17 Tests inkl. Vielfalt: von 30 gleichen Schlagzügen ≥ 26 verschieden; Store 7; Bewegungsbibliothek 4); als Bildfolge in Edge geprüft (PC 1280×720, Handy 412×860) |
| **Zwei Sprachen: Deutsch und Englisch** – Oberfläche, Anleitung, Meldungen, Zugerklärungen, Ergebnisse, Kampftitel; Standard nach Browser-Sprache, Umschalter im Menü und in den Einstellungen, gespeichert | getestet (7 Tests: jeder Text im Code hat eine englische Übersetzung, Platzhalter stimmen, Zugerklärungen und Ergebnisse auf Englisch); im Browser auf Englisch durchgespielt (Menü, Partie, Einstellungen, Anleitung, Matt-Finale, Ergebnisfenster) |
| Kampf überspringen (Tippen, Klick, Leertaste, Enter, Esc), Einstellung „Beim Schlagen: Kriegerkampf / Kurz / Aus“ | im Browser geprüft (Tippen beendet den Kampf, Uhr läuft weiter, Brett dreht sich) |

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

## Leistung mit klassischen Figuren (26.10.2026, gleicher PC)

| Stufe | Dreiecke/Bild | Draw Calls | Render-CPU | Bildrate bei Kamerabewegung |
|---|---|---|---|---|
| Hoch (mit Effekten) | ~119 000 | ~111 | 1,2 ms | 60 fps |
| Mittel | ~118 000 | ~80 | 1,0 ms | 60 fps |
| Niedrig | ~118 000 | ~79 | 0,9 ms | 60 fps |

## Offen / bekannte Grenzen

- **Echtes Smartphone** wurde noch nicht getestet (nur emulierte Größen im Desktop-Browser). Insbesondere
  **Drag & Drop per Finger** ist nur mit Maus geprüft – die Touch-Logik nutzt dieselben Pointer-Events, ist aber
  ungetestet.
- **Sounds** wurden nur technisch gemessen, nicht angehört – das gilt auch für die neuen Kampfklänge.
- **Kriegerkampf**: Beide Seiten sind derselbe Paladin (Weiß aufgehellt) – für eine zweite Figur müsste bei Mixamo eine weitere Figur *mit Skin* geladen werden. Geprüft als Bildfolge in unsichtbarem Edge, nicht in Echtzeit auf einem echten Gerät; Kampfklänge nicht angehört.
- **Offline im WLAN-Test** (http://192.168…) gibt es keinen Service Worker (Browser verlangt https) – online über
  GitHub Pages (https) funktioniert er.
- **Elo-Angaben** der Stufen sind Richtwerte (Stockfish-Kalibrierung gilt für das volle Netz, hier läuft das Lite-Netz).
- Remis durch Wiederholung/50 Züge wird automatisch gewertet (keine „Reklamation“ wie im Turnier).
- Lizenz für den eigenen Code ist nicht festgelegt (Repository öffentlich, aber ohne LICENSE-Datei = alle Rechte
  vorbehalten). Stockfish bleibt GPL-3.0 mit Lizenztext und Quellverweis.

## 0.10.1 – gleiche Sicht für Schwarz und Weiß, Figuren besser erkennbar (29.10.2026)
- Licht (Hauptlicht, Gegenlicht, Raumlicht, Schatten) dreht mit dem Spieler mit: Schwarz sieht seine Figuren genauso beleuchtet wie Weiß, nicht mehr im Gegenlicht.
- Randsaum an allen Figuren (`src/scene/rim.ts`): schwarze Figuren bekommen einen hellen, weiße/goldene einen dunklen Rand – Springer, Läufer und Türme bleiben auf jedem Feld lesbar.
- Neues Prüfskript `scripts/side-shots.mjs`: gleiche Stellung aus Sicht von Weiß und Schwarz in allen Stilen und Ansichten.
- Geprüft: Typen, 147 Tests, Vergleichsbilder (vorher/nachher). Nicht geprüft: Handy, Kampf-Szenen mit dem neuen Licht, Leistung auf schwachen Geräten.

## 0.11.0 – Uhren am Brett und Gegenüber-Modus (29.10.2026)
- **Gegenüber-Modus** (Einstellungen, nur „2 Spieler“): Gerät liegt flach zwischen zwei Spielern. Schwarz sitzt gegenüber – seine Figuren neigen sich zu ihm (so wie Weiß seine von unten sieht), die Spielerkarte oben ist für ihn gedreht. Schließt „Brett drehen“ aus. Am besten in der Ansicht „von oben“.
- **Schachuhr-Tafeln am Brett** (PC, ein/aus per Uhr-Knopf in der Seitenleiste oder in den Einstellungen): eine Tafel pro Spieler, links neben dem Brett oben/unten – oder als schmale Leiste über/unter dem Brett, wenn der Platz fehlt. Der Spieler am Zug ist „gedrückt“ und leuchtet, unter 20 s rot. Antippen = Pause/Weiter. Ohne Zeitlimit zählt die Tafel die verbrauchte Zeit mit. Im Gegenüber-Modus steht die obere Tafel für Schwarz richtig herum.
- Geprüft: Typen, 147 Tests, Bilder (Handy-Gegenüber, PC mit Seitenleiste, ohne Seitenleiste mit Zeitlimit, schmales Fenster). Nicht geprüft: echtes Handy, Tippen auf die Tafel/Pause im Browser, Gegenüber-Modus in der 3D-Schrägansicht (dort nicht sinnvoll).

## 0.11.1 – Gegenüber-Modus flacher (29.10.2026)
- Im Gegenüber-Modus neigen sich die Figuren nur noch halb so stark (0,5 statt 1,0 rad): kompakter, weniger Überdeckung, für beide Spieler gut lesbar. Jeder sieht die Figuren des anderen kopfüber – wie an einem echten Brett.

## 0.12.0 – Symbol-Plättchen im Gegenüber-Modus (29.10.2026)
- Neu: Im Gegenüber-Modus liegt oben auf jeder Figur ein Plättchen mit dem Figurensymbol (♚ ♛ ♜ ♝ ♞ ♟). Weiße Figuren haben ein dunkles Plättchen, schwarze ein helles. Das Symbol steht für den Besitzer richtig herum, der Gegenüber erkennt es auch kopfstehend sofort.
- Ein/aus in den Einstellungen („Symbole auf den Figuren“, Standard: an). Wirkt nur im Gegenüber-Modus, in der Ansicht „von oben“ und nicht im Kriegerkampf.
- Geprüft: Typen, 147 Tests, Bilder (Handy-Format, Marmor und Rebell-Stil). Nicht geprüft: echtes Handy (Schrift der Symbole hängt vom Gerät ab, der Bauer ist mit Textwähler gegen Emoji-Darstellung abgesichert), Leistung auf schwachen Geräten.

## 0.12.1 – Gegenüber-Modus: größere Figuren, Plättchen aus (29.10.2026)
- Die Figuren sind im Gegenüber-Modus 20 % größer (1,3 statt 1,08): die flachere Neigung hatte sie kleiner wirken lassen, jetzt füllen sie ihr Feld wieder.
- Die Symbol-Plättchen sind jetzt standardmäßig aus (Emilio: sah schlecht aus); weiter einschaltbar unter „Symbole auf den Figuren“. Die Einstellung heißt intern neu (`faceMarks`), damit sie bei allen aus ist.
- Geprüft: Typen, 147 Tests, Bilder (Marmor und Rebell-Stil, Handy-Format). Nicht geprüft: echtes Handy.

## 0.13.0 – Eigene Schach-KI statt Stockfish (30.10.2026)
- **Neue Rebell-KI** (`src/engine/rebell/`), komplett eigener Code: Zuggenerator (0x88), Bewertung mit Material, Feldtabellen, Bauernstruktur, Beweglichkeit und Königssicherheit, Alpha-Beta-Suche mit Transpositionstabelle, kleines Eröffnungsbuch. Läuft im Web Worker, kennt Wiederholungen aus dem Partieverlauf.
- **Stockfish ist entfernt** (Paket, Dateien, Lizenzhinweis im Spiel). Damit ist die GPL-Frage für Portale erledigt. Spiel und KI stehen jetzt unter eigener Lizenz „alle Rechte vorbehalten“ (`LICENSE`).
- Stufen neu eingestellt und mit je 12 Testpartien gemessen (100 ms pro Zug gegen Stockfish mit Elo-Bremse, untereinander): Stufe 3 etwa 1300, Stufe 4 etwa 1600, Stufe 5 etwa 1900–2200, Stufe 6 um 2400 und mehr, Stufe 7 nochmals stärker. Stufen 1–2 nur im Vergleich untereinander gemessen. Das sind grobe Richtwerte, keine geprüften Wertungszahlen. Auf langsamen Handys sind die Stufen 6–7 schwächer, weil sie nach Bedenkzeit rechnen.
- Hinweise und Zugbewertung rechnen höchstens 0,9 Sekunden pro Stellung.
- Geprüft: Typen, 163 Tests (u. a. Perft-Referenzwerte, 30 Zufallspartien gegen chess.js, Matt-Aufgaben, König+Turm matt setzen), KI-Züge und Hinweis im Browser (Entwicklungsmodus), Worker im fertigen Build. Nicht geprüft: echtes Handy, eine komplette Partie im fertigen Build von Hand.

## 0.14.0 – 2D-Ansicht (02.11.2026)
- Neu: **2D-Ansicht** – flaches Brett von oben als HTML (`src/ui/Board2D.tsx`), klar lesbar und schnell. Die Figuren sind Bilder der echten Marmorfiguren (`public/pieces2d/`, erzeugt mit `node scripts/build-sprites.mjs`, braucht `npm run dev`). Antippen oder Ziehen, Punkte/Ringe für Züge, letzter Zug, Schach, Hinweispfeil, Koordinaten, Brett drehen, Gegenüber-Modus, Analyse. Brettfarben je Stil (Holz, Smaragd, Rot).
- Kriegerkämpfe laufen auch in 2D: Das 2D-Brett blendet sich aus, der Kampf läuft in 3D, danach geht es flach weiter. Solange 2D sichtbar ist, ruht die 3D-Szene (spart Akku).
- Umschalten: Knopf „2D/3D“ oben (PC und Handy), Taste D, oder Einstellungen → Ansicht. Standard bleibt „Gerade von oben“ (3D).
- Geprüft: Typen, Tests (neu: gespeicherte Ansicht), im Browser per Chrome ohne Fenster: Klick-Zug, Zieh-Zug, Kampf blendet 2D aus und wieder ein, Hinweispfeil, Gegenüber-Modus, PC- und Handy-Format. Nicht geprüft: echtes Handy/Touch, Safari.

## 0.14.1 – 2D-Ansicht wie in 3D (03.11.2026)
- Das 2D-Brett ist jetzt das **echte Marmorbrett aus der 3D-Szene** (Draufsicht, `public/pieces2d/board.webp`), die Figuren sind frontal gerenderte Marmorfiguren, größer und lesbarer (Idee: Schachdiagramm wie auf Lichess, aber mit der 3D-Qualität). Beides erzeugt `node scripts/build-sprites.mjs`.
- **Alle Effekte bleiben:** Zugbewegung mit Abheben/Sprung (gleiche Bewegungsfunktionen wie in 3D), Ansturm beim Schlagen, geschlagene Figur wird zurückgeschleudert und überschlägt sich, Einschlagblitz, Druckwelle, Glutball, Funkenregen, Beben des Bretts, Schach-Zittern des Königs, Matt-Umkippen des Königs mit rotem Glühen, Umwandlungs-Funken und der Matt-Stempel. Kriegerkämpfe laufen unverändert in 3D.
- Auswahl hebt die Figur an (schwebt), schwarze Figuren haben einen feinen hellen Saum auf dunklen Feldern.
- Geprüft (Chrome ohne Fenster, PC und Handy-Format): Brett und Figuren, Springer-Sprung, Schlag mit Effekten, Matt in 7 Zügen mit Stempel, Klick- und Zieh-Zug, Kampf blendet 2D aus und ein. Nicht geprüft: echtes Handy, Safari; die anderen Brettstile (Edel/Rebell) behalten in 2D einfarbige Felder.

## 0.14.2 – Start in 2D (03.11.2026)
- Neue Spieler starten in der 2D-Ansicht (Standard `viewMode: 'flat'`). Wer schon eine Ansicht gespeichert hat, behält sie; Umschalten mit Knopf 2D/3D oder Taste D.

## 0.15.0 – Vom Schachprogramm zum Spiel (05.11.2026)
Anlass: CrazyGames lehnte 0.13.0 am 04.11. wegen der Gesamtqualität ab. Befund und Plan: `docs/QUALITAET_PLAN.md`.
- **Startbildschirm neu:** Stufe mit Erfahrungsbalken, großer Knopf „Spielen“ (sofort gegen den nächsten Gegner), Kacheln Feldzug / Rätsel / Freie Partie / Zu zweit, unten Erfolge, Einstellungen, Anleitung. Ladebildschirm im `index.html` statt schwarzer Seite.
- **Feldzug:** sieben Gegner mit Namen, Wappen (Marmorfigur auf farbigem Ring), Beinamen und Sprüchen, Stufen 1–7 der Rebell-KI, Benno der Bauer bis Der Rebell (`src/game/opponents.ts`). Freischalten der Reihe nach, bis zu drei Sterne (Sieg · ohne Zurücknehmen/Hinweise · in höchstens 30 Zügen). Vor der Partie ein kurzer Auftritt des Gegners, in der Partie eine Sprechblase (Begrüßung, Schach, Schlag, Kampf).
- **Rätsel:** Matt in 1, 2 und 3, mit der eigenen KI erzeugt (`scripts/puzzles.gen.ts`, `scripts/merge-puzzles.mjs`, Daten `src/game/puzzles.json`), nur Stellungen mit genau einem Lösungszug. Die KI verteidigt; nach der erlaubten Zugzahl ohne Matt ist das Rätsel nicht gelöst, mit Tipp (erster Zug), Nochmal, Überspringen. Serie und Rekord.
- **Fortschritt** (`src/game/progress.ts`, eigener Speicher `rebellchess.progress.v1`): Erfahrungspunkte, Stufe und Rang (Rekrut bis Rebellenkönig), 12 Erfolge mit goldener Einblendung. Nach „Zug zurücknehmen“ und neuem Ende gibt es nur den Unterschied an Erfahrung.
- **Ergebnisfenster:** Spruch des Gegners, Sterne mit Klang, Erfahrungsbalken, Aufstieg, neuer Gegner, Erfolge, Goldregen beim Sieg; Knöpfe je nach Lage (Nächster Gegner, Nächstes Rätsel, Nochmal …).
- **Erster Schlag jeder Partie ist ein Kriegerkampf** (`isFirstCapture`), damit jeder sofort das Besondere sieht.
- **Ton:** Hintergrundmusik, im Code erzeugt (`src/audio/music.ts`, d-Moll, leise, Schalter „Musik“, schweigt im Hintergrund-Tab); Fanfaren für Sterne, Aufstieg, Erfolge.
- **Technik:** unbehandelter Fehler beim Laden der Schrift behoben; Portal-Signal „happytime“ bei Sieg; Anleitung ergänzt.
- Geprüft: Typen, Tests (neu: Fortschritt, erster Kampf), Bilder von Startseite, Feldzug, Rätsel, Erfolgen, Partie mit Sprechblase und Kampf, Siegerfenster, Rätsel gelöst/nicht gelöst (PC und Handy), Ladezeit des Baus, Musikpegel gemessen. Nicht geprüft: echtes Handy, Safari, Musik angehört.
