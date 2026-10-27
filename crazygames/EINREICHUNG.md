# Rebell Chess 3D bei CrazyGames einreichen

Stand: 27.10.2026 · Version 0.10.0. Alles hier ist vorbereitet; **hochgeladen und abgeschickt hast du es erst, wenn du es im Portal tust.**
Angaben zu CrazyGames stammen aus deren öffentlichen Seiten (docs.crazygames.com) und können sich ändern – im Portal gegenprüfen.

## 1. Was hochgeladen wird

| Was | Wo liegt es |
|---|---|
| Das Spiel als Zip (Portal-Build mit CrazyGames-SDK) | `crazygames/rebell-chess-crazygames.zip` (7,2 MB, 130 Dateien) |
| Bilder (quer 1920×1080, quadratisch 800×800, hoch 800×1200), je 5 Motive | `crazygames/images/<größe>/` |
| Texte (Titel, Beschreibung, Anleitung) | unten, Abschnitt 3 |

Neu erzeugen: `npm run build:crazygames` (Zip) und `node scripts/store-shots.mjs` (Bilder, braucht `npm run dev`).
Das Zip enthält die Mixamo-Dateien und liegt deshalb **nicht in Git** (siehe Abschnitt 4).

## 2. Ablauf bei CrazyGames

1. Entwicklerportal öffnen: https://developer.crazygames.com/ und anmelden (ein Konto anlegen musst du selbst).
2. „Submit a game“ wählen, das Zip hochladen (index.html liegt im Wurzelordner, alle Pfade sind relativ).
3. Titel, Beschreibung, Anleitung, Bilder und Tags eintragen (Abschnitt 3).
4. Unterstützte Geräte angeben: **Desktop (Quer)** und **Handy (Hoch)**. Das Portal fragt die Ausrichtung selbst ab, das Spiel hat keine eigene Sperre.
5. Abschicken. Erst „Basic Launch“ (nur das Signal „Gameplay start“, keine Werbung) – gefällt es, folgt „Full Launch“ mit Werbung und Einnahmen.
   Für den Full Launch fehlt noch: Zusatzmodule des SDK (Speicher/Nutzer, Werbung). Das baue ich auf Wunsch ein, wenn CrazyGames zusagt.

## 3. Texte

**Titel:** Rebell Chess 3D

**Kurzbeschreibung (EN):** 3D chess where captures turn into epic warrior duels. Play Stockfish or a friend.

**Beschreibung (EN):**
Rebell Chess 3D is a premium 3D chess game that plays by every rule – castling, en passant, promotion, draws – and then does something no chess game does: when it matters, the pieces become armoured warriors and fight it out. Every duel plays out differently, with its own moves, camera cuts and slow-motion finishing blow. Minor captures are quick and punchy, and a checkmate slams down a huge stamp with a boom.
Play against Stockfish (7 levels from beginner to master), against a friend on one device, or in training mode with hints and move explanations. Three looks: real marble on black, emerald and gold, or red and ivory. Works on desktop and phone.

**Beschreibung (DE):**
Rebell Chess 3D ist ein 3D-Schachspiel mit allen Regeln (Rochade, en passant, Umwandlung, Remis) und einer Besonderheit: Bei wichtigen Schlägen werden die Figuren zu gepanzerten Kriegern und kämpfen. Jeder Kampf läuft anders ab, mit eigenen Bewegungen, Kameraschnitten und Zeitlupe beim Todesstoß. Kleine Schläge sind kurz und knallen mit einer Mini-Explosion, Schachmatt kommt mit einem riesigen Stempel. Spiele gegen Stockfish (7 Stufen), zu zweit an einem Gerät oder im Trainingsmodus mit Hinweisen und Erklärungen. Drei Looks: Marmor auf Schwarz, Smaragd und Gold, Rot und Elfenbein.

**Anleitung (EN):**
Tap or click a piece, then its target square (or drag it). Dots show legal moves, rings show captures. Mouse wheel / two fingers to zoom. Keys: U undo · F flip board · H hint (training) · P pause · S sidebar · Esc menu · ←/→ browse moves. Tap a warrior duel to skip it.

**Tags:** chess, 3d, board game, strategy, ai, two player, puzzle, brain
**Kategorie:** Brettspiele / Strategie
**Sprachen:** Englisch und Deutsch (die Oberfläche wählt nach der Browser-Sprache: deutsche Browser Deutsch, alle anderen Englisch; Umschalter im Menü und in den Einstellungen)

## 4. Rechtliche Punkte – vor dem Abschicken klären

1. **Stockfish (GPL-3.0).** Die Engine steckt im Spiel. Die GPL verlangt, dass das Gesamtwerk offen bleibt, wenn man Stockfish mitliefert. Der Quellcode ist öffentlich (github.com/rebellmitherz/rebell-chess), Lizenztext und Quellverweis liegen im Spiel. **Ob das mit einem Portal vereinbar ist, das Einnahmen teilt, ist nicht geklärt – rechtlich prüfen lassen.** Alternative: KI-Gegner weglassen oder eine nicht-GPL-Engine nehmen.
2. **Mixamo (Adobe).** Die Krieger (Paladin + Bewegungen) dürfen in Spielen genutzt werden, aber nicht als Einzeldateien weitergegeben werden. Im Zip liegen sie umgewandelt und komprimiert (`models/warrior_*.glb`). Das ist eine Grauzone – Adobe-Bedingungen prüfen oder die Krieger später ersetzen.
3. **Frei nutzbar (CC0):** Figuren/Brett (Poly Haven, Riley Queen), Raumlicht, Tisch, Klänge (Kenney). Namensnennung steht in der Spielanleitung.
4. **Originalität:** CrazyGames lehnt Klone ab. Die Krieger-Kämpfe, das Matt-Finale und der Look sind das Alleinstellungsmerkmal.

## 5. Technischer Stand (gemessen)

- Gesamtgröße 10,3 MB (Grenze 250 MB, Mobile-Startseite ab ≤ 20 MB Startdownload), 130 Dateien (Grenze 1500).
- Relative Pfade, kein Service Worker, keine App-Installation, kein eigener Vollbild-Knopf im Portal.
- SDK: Initialisierung, Laden (Start/Ende) und „Gameplay Start/Stop“ geprüft mit dem echten SDK von sdk.crazygames.com (lokal): Start beim Beginn einer Partie, Stop bei Menü, Pause, Ergebnis.
- Getestet in Edge (Chromium). **Nicht getestet:** Safari/iPhone, echtes Handy, Ton.

## 6. Offene Punkte

- Online-Spiel gegen Freunde (braucht einen eigenen Server, CrazyGames hostet nur Dateien).
- Full-Launch-Module des SDK (Werbung, Speicher), falls das Spiel ausgewählt wird.
- Titelbild/Trailer von Hand prüfen: Die vorgegebenen Bildgrößen im Portal gegenprüfen.
