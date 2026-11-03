# Rebell Chess 3D – Update bei CrazyGames einspielen

Stand 03.11.2026, aktuelle Version 0.14.2. Die Menünamen im Portal können sich ändern – im Zweifel dem, was du dort siehst, folgen.

## Ablauf bei jedem Update

1. **Paket bekommen.** Ich (Claude) baue es und lege es als Ordner auf den Desktop: `rebell-chess-upload-<Version>` (z. B. `rebell-chess-upload-0.14.2`). Das Portal nimmt **keine Zip-Datei**, nur einen Ordner.
2. Auf https://developer.crazygames.com/ anmelden, dein Spiel **Rebell Chess 3D** öffnen.
3. Beim Reiter für die Spieldatei (**Upload / Game files / Build**) eine **neue Version hochladen**: „Ordner auswählen“ → den Ordner `rebell-chess-upload-<Version>` wählen (nicht einen Unterordner; `index.html` muss direkt darin liegen).
4. Im Test (**QA**) einmal spielen: Spiel startet, Zug geht, 2D/3D-Knopf geht. Das SDK-Protokoll zeigt wie beim ersten Mal „Loading start/stop“ und „Gameplay start/stop“.
5. Änderst du Texte oder Bilder, geht das im Reiter **Details** bzw. **Art**.
6. Abschicken / **Submit** (bei einem laufenden Spiel kann der Knopf „Submit new version“ oder „Update“ heißen).

## Wichtig

- **Solange das Spiel „Awaiting review“ ist**, lässt sich die Datei eventuell nicht tauschen. Dann: über **Support** im Portal fragen, ob du die Dateien vor der Prüfung austauschen darfst, oder das Update nach der Prüfung hochladen.
- Das Spiel **nicht löschen / „Remove game“** wählen und neu anlegen – sonst geht die Prüfung von vorn los.
- Jede Version hat eine eigene Nummer in `package.json`; gib mir die Versionsnummer, die du hochgeladen hast, damit wir den Stand kennen.
- Spielstände und Einstellungen der Spieler bleiben beim Update erhalten (liegen im Browser). Wer 2D/3D schon gewählt hat, behält seine Wahl; neue Spieler starten in 2D.

## Was du mir sagst, damit ich ein neues Paket baue

„Baue das Update“ – ich erzeuge `npm run build:crazygames`, entpacke das Ergebnis in einen neuen Desktop-Ordner mit Versionsnummer und prüfe es lokal (Start, Zug, Fehler). Den Upload im Portal machst du selbst.
