# Rebell Chess 3D

Premium-3D-Schach im Browser – für Windows-PC und Smartphone. Gegen Stockfish (7 Stufen) oder zu zweit an einem Gerät,
mit Schachuhren, Training, Analyse-Modus, Zugliste, Rückgängig und automatischem Speichern. Installierbar als App und
nach dem ersten Laden offline spielbar.

**Online spielen:** https://rebellmitherz.github.io/rebell-chess/

## Starten

Voraussetzung: [Node.js](https://nodejs.org) 20 oder neuer (getestet mit Node 24).

```bash
npm install
```

```bash
npm run dev
```

Dann im Browser **http://localhost:5173** öffnen.

### Auf dem Smartphone testen (gleiches WLAN)

```bash
npm run dev:lan
```

Vite zeigt eine Adresse wie `http://192.168.x.x:5173` – diese auf dem Smartphone öffnen.
Beim ersten Mal fragt Windows evtl. nach einer Firewall-Freigabe für Node.js (privates Netzwerk erlauben).

## Testen

```bash
npm test
```

93 automatische Tests: Schachregeln, Uhr, Figuren-IDs, Erklärungen, Speichern/Laden, Drag & Drop, Analyse-Modus,
Figurengeometrie, Figurenmodell, Spielfluss gegen eine Test-Engine und die **echte Stockfish-Engine** (WASM in Node.js).

```bash
npm run typecheck
```

## Fertige Browser-Version bauen

```bash
npm run build
```

Ergebnis: Ordner `dist/` – statische Dateien, die auf jedem Webspace laufen (auch in einem Unterordner).
Lokal ansehen:

```bash
npm run preview
```

→ **http://localhost:4173**

Hinweis: `dist/index.html` per Doppelklick (file://) öffnen funktioniert nicht, weil Browser Web Worker und WASM nur
über http(s) laden. Immer über `npm run preview` oder einen Webserver öffnen.

## Veröffentlichen (GitHub Pages)

```bash
npm run deploy
```

Baut das Spiel und lädt den Ordner `dist/` in den Zweig `gh-pages` von `rebellmitherz/rebell-chess`
(Voraussetzung: einmal `gh auth login`). Nach 1–2 Minuten ist die neue Fassung online.

## Bedienung

- Figur anklicken/antippen, dann Zielfeld – oder die Figur direkt aufs Zielfeld ziehen (Drag & Drop).
  Punkte = legale Züge, Ringe = Schlagzüge.
- Ziehen auf freier Fläche dreht die Kamera, Mausrad/zwei Finger zoomen.
- Ist das Spiel auf einem Gerät zu langsam: Menü → Einstellungen → Grafikqualität „Mittel“ oder „Niedrig“.
- Tasten: `U` Zug zurück · `F` Brett drehen · `H` Hinweis (Training) · `P` Pause · `Esc` Menü · `←` `→` blättern.
- Analyse: Klick auf einen Zug in der Zugliste zeigt die Stellung danach (mit Stockfish-Bewertung im Training und
  nach Partieende).
- Als App: Android/Chrome/Edge „Als App installieren“, iPhone Safari: Teilen → „Zum Home-Bildschirm“.

## Dokumentation

- [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md) – Aufbau, Schichten, Entscheidungen
- [docs/ENTWICKLUNGSPLAN.md](docs/ENTWICKLUNGSPLAN.md) – Phasen 1–6
- [docs/FORTSCHRITT.md](docs/FORTSCHRITT.md) – was fertig, getestet oder noch offen ist
- [docs/LIZENZEN.md](docs/LIZENZEN.md) – verwendete Bibliotheken und Lizenzen
