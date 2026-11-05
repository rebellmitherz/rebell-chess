# Qualitäts-Offensive nach der CrazyGames-Absage (05.11.2026)

CrazyGames lehnte 0.13.0 ab: „Gesamtqualität entspricht noch nicht den Erwartungen“ (keine Einzelheiten).
Emilio: „alles komplett durchgehen, analysieren und auf das Maximum verbessern“.

## Befund (Rundgang als Erstspieler, PC 1366×768 und Handy 390×844)

- Technik läuft, Brett/Figuren sehen gut aus. **Es wirkt wie eine Schach-App, nicht wie ein Spiel.**
- Einstieg: schlichtes Menü, bis zur ersten Partie zwei Klicks durch Elo-Stufen und Bedenkzeiten.
- Kein Ziel, kein Fortschritt, keine Belohnung, keine Gegner mit Charakter; Ergebnisfenster nüchtern.
- Viel leerer Platz neben/über dem Brett; der Gegner ist nur „Rebell-KI · Hobbyspieler“.
- Kriegerkampf (Alleinstellung) sieht ein Prüfer evtl. nie, weil er nur bei wichtigen Schlägen kommt.
- Fehlermeldung „NetworkError“ im Hintergrund (Seitenfehler beim Laden).

## Plan (in dieser Reihenfolge)

1. Fortschritt-Grundlage: Spielerstufe (EP), Sterne, Erfolge, gespeichert (`src/game/progress.ts`).
2. Feldzug: 7 Gegner mit Namen, Wappen, Sprüchen, steigender Stärke, freischalten, 3 Sterne je Gegner.
3. Rätsel: eigene Matt-in-1/2/3-Aufgaben (mit der Rebell-KI erzeugt), Serie, Fortschritt.
4. Startbildschirm neu: großer „Spielen“-Knopf (nächster Gegner sofort), Kacheln Feldzug/Rätsel/Freie Partie/Zu zweit, Stufe+EP.
5. In der Partie: Gegnerkarte mit Wappen und Sprechblase (reagiert auf Schach, Schlag, Matt), Hinweis beim ersten Spiel.
6. Siegerbildschirm: Sterne, EP-Balken, Stufenaufstieg, Erfolge, Goldregen, „Nächster Gegner“.
7. Erster Schlag jeder Partie ist ein Kriegerkampf (Wow-Moment sofort).
8. Technik: NetworkError beheben, Ladezeit/Leistung prüfen.
9. Tests, Bau, Bilder, Paket, Doku, Logs.

## Stand (05.11.2026)

Alles aus dem Plan ist umgesetzt (Version 0.15.0), dazu:
- **Ladeverhalten** (gemessen mit Chrome ohne Fenster, Rechner dabei durch die Rätsel-Erzeugung voll ausgelastet):
  vorher blockierte der Start den Hauptthread insgesamt 12,6 s (längster Block 4,5 s), jetzt etwa 4,2 s (längster 2,2 s).
  Ursachen: Farbkorrektur der Texturen lief bei jedem Start Pixel für Pixel → jetzt in die Dateien eingebacken
  (`scripts/build-real-textures.py`); Shader wurden in mehreren Wellen synchron übersetzt → jetzt erst alles laden, dann
  alle Varianten im Hintergrund übersetzen (`Warmup` in `ChessScene.tsx`), die 3D-Szene blendet danach ein.
  Rest: die Bildeffekte (AO, Bloom) übersetzen ihre Shader beim ersten Bild (etwa 14 Programme).
- Ladebildschirm in `index.html`, Menü nach 0,3 s bedienbar.
- Rätsel: Erzeugung mit drei parallelen Läufen (`PUZZLE_SEED`, `PUZZLE_OUT`, `PUZZLE_MINUTES`), Zusammenführen ohne
  Beinahe-Doppelte (`scripts/merge-puzzles.mjs`), Prüfung jedes Rätsels in `tests/game/puzzles.test.ts`.

Nicht geprüft: echtes Handy, Safari, Musik und Klänge angehört. Ob CrazyGames eine erneute Einreichung annimmt, ist offen.
