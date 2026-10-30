# Übergabe für einen neuen Chat – Rebell Chess 3D

Stand: 29.10.2026 · Version 0.10.0 · live: https://rebellmitherz.github.io/rebell-chess/ · alles committet und gepusht (`main`, Tags bis v0.7.0, danach nur Versionen in `package.json`).

## Prompt zum Kopieren

```
Wir arbeiten weiter an „Rebell Chess 3D“ (Emilios 3D-Schachspiel im Browser). Projektordner: C:\Users\micha\Desktop\Rebellchees.
Antworte immer auf Deutsch, knapp und ehrlich (was fertig, geprüft, ungeprüft ist).

ZUERST LESEN (in dieser Reihenfolge):
1. C:\Users\micha\Desktop\OPERATOR_SYSTEM\SPIELREGELN_ALLE_KIS.md und OPERATOR_STATE\ACTIVE_MAIN_TASK.md („STAND HEUTE“). Regeln: vor jeder Änderung an fremden/bestehenden Dateien dort eine Sicherung <datei>.bak-<grund>-<JJJJMMTT>; nichts löschen oder verschieben; nach der Arbeit Eintrag in UPDATE_REGEL.md, eine Zeile in ACTIVE_MAIN_TASK.md und ein Ereignis per OPERATOR_SYSTEM\EREIGNISSE\ereignis.py (schreibe --wer claude-code --art bau --welt rebell ...). Gesperrt ohne Emilio: Versand, Käufe, Löschen, Zugangsdaten, neue Cronjobs. Keine Passwörter/Keys in Dateien.
2. C:\Users\micha\Desktop\Rebellchees\docs\UEBERGABE_NEUER_CHAT.md (diese Datei), dann docs\FORTSCHRITT.md, docs\ARCHITEKTUR.md, docs\LIZENZEN.md, crazygames\EINREICHUNG.md.
3. Memory: C:\Users\micha\.claude\projects\C--Users-micha-Desktop-Rebellchees\memory\ (MEMORY.md, rebell-chess-projekt.md).

TECHNIK: Vite 8, React 19, TypeScript, three.js/React Three Fiber, zustand, chess.js, eigene Schach-KI (src/engine/rebell, Web Worker), Vitest (147 Tests grün: `npx vitest run`, Typen: `npx tsc --noEmit`). Dev-Server `npm run dev` (Port 5173; per preview_start „rebell-chess-dev“). Veröffentlichen: `npm run deploy` (GitHub Pages, Konto rebellmitherz; gh-Zugang nur pro Befehl: git -c credential.helper= -c "credential.helper=!gh auth git-credential" push). Danach auf `curl .../sw.js` den neuen Cache-Namen (`rebellchess-vNN` in public/sw.js, bei jedem Release hochzählen) abwarten. Pro Release: package.json-Version erhöhen, Tests, Commit mit „Co-Authored-By“-Zeile, push, deploy.
Prüfbilder: unsichtbares Edge per puppeteer-core (userDataDir im TEMP, sonst startet es nicht, wenn Edge offen ist): `node scripts/battle-shots.mjs`, `node scripts/store-shots.mjs`; Bilder im Dev-Modus von Hand rechnen mit window.__r3f.advance(…). Der Browser-Pane drosselt Animationen stark.

WAS DAS SPIEL KANN: alle Schachregeln, eigene Rebell-KI (7 Stufen), Zwei-Spieler mit Brettdrehen, Training/Analyse, Uhren, Undo, Speichern, PGN, PWA offline, Drag & Drop, Ansicht „gerade von oben“ (Standard) oder 3D schräg, 3 Stile (Echt = Marmor/Holz mit Originaltexturen, Edel = Gold/Schwarz auf grünem Brett, Rebell = Elfenbein/Schwarz auf rotem Brett), Kriegerkampf bei wichtigen Schlägen (Mixamo-Paladine, 8 zufällige Szenarien, Kameraschnitte, überspringbar, Uhr steht), sonst schneller Schlag mit Mini-Explosion (Einstellung Wichtige/Immer/Kurz/Aus), Schachmatt-Finale (Stempel, Blitz, Beben, Wums-Klang), Seitenleiste ausblendbar (S), Vollbild (V), Handy: Brett randlos, Koordinaten in den Feldern, 8 % in die Höhe gezogen, zweisprachig Deutsch/Englisch (Standard nach Browsersprache; Texte mit tr('deutscher Text') und src/i18n/en.ts, Test prüft die Vollständigkeit), Portal-Build für CrazyGames (`npm run build:crazygames` → crazygames\rebell-chess-crazygames.zip, SDK-Start/Stopp geprüft).

WICHTIGE ENTSCHEIDUNGEN / ERFAHRUNGEN:
- Emilio will Optik echt, kräftig, nicht blendend; Schwarz wirklich schwarz; Figuren schwarz/hell, Farbe nur am Brett (Edel grün, Rebell rot), helle Felder weiß. Er erwartet deutlich mehr als das Minimum; Wiederholung ist „langweilig“ (daher Zufall in den Kämpfen).
- Mixamo-Dateien (assets-src/mixamo, public/models/warrior_*.glb, crazygames/*.zip) sind per .gitignore aus Git draußen (Adobe erlaubt keine Weitergabe der Einzeldateien). Neu erzeugen: `npm run assets:warriors`.
- Bei Python mit Umlauten/Backslashes in Heredocs: Skript als Datei schreiben und mit `python -I` und PYTHONIOENCODING=utf-8 ausführen.

OFFEN (Vorschlag der Reihenfolge):
1. Lizenzliste/Klärung: Mixamo-Weitergabe im Paket (Grauzone); Stockfish ist seit 0.13.0 entfernt. Ohne Klärung nichts bei CrazyGames einreichen (das Einreichen und das Konto macht Emilio selbst).
2. Operator-Protokoll nachtragen: Einträge für 0.7.1 bis 0.10.0 fehlen in UPDATE_REGEL.md / ACTIVE_MAIN_TASK.md / Ereignisbuch (zuletzt eingetragen: 0.7.0). Vorher Sicherungen anlegen.
3. Echter Handy-Test durch Emilio (Brettgröße, Flüssigkeit der Kämpfe), Sounds hat noch niemand angehört, Englisch-Texte sollte ein Muttersprachler lesen.
4. Online-Spiel gegen Freunde (Weg B: kleiner Cloudflare-Server, braucht Emilios kostenloses Konto; Weg A: WebRTC ohne Server). CrazyGames hostet nur Dateien.
5. Falls CrazyGames zusagt: SDK-Module für den Full Launch (Werbung, Speicher).
6. Lizenz für den eigenen Code ist nicht festgelegt.

Beginne mit einer kurzen Zusammenfassung des Stands in 5 Zeilen und frage Emilio, womit er weitermachen will.
```

## Dateien, die man kennen sollte

| Datei | Zweck |
|---|---|
| `src/game/store.ts` | gesamter Spielzustand und alle Aktionen (Züge, KI, Uhr, Kampf-Zustand, Matt) |
| `src/game/battleRules.ts` | wann es einen Kriegerkampf gibt |
| `src/scene/battleScript.ts` | Drehbuch der Kämpfe (Szenarien, Kamera), rein und getestet |
| `src/scene/Battle.tsx` | spielt Kämpfe ab (Krieger, Effekte, Klänge) |
| `src/scene/materials.ts`, `realAssets.ts` | Farbwelten der Stile |
| `src/i18n/` | Sprachsystem und englische Texte |
| `src/portal.ts`, `vite.config.ts` | Portal-Build für CrazyGames |
| `scripts/build-warriors.mjs` | Mixamo-FBX → Krieger-Dateien + `warriorMoves.json` |
| `crazygames/EINREICHUNG.md` | Ablauf, Texte, rechtliche Punkte für CrazyGames |
