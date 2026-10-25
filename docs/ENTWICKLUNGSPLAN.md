# Rebell Chess 3D – Entwicklungsplan

Nach jeder Phase ist die Anwendung startbar (`npm run dev`) und testbar (`npm test`).
Der aktuelle Stand jeder Funktion steht in `FORTSCHRITT.md`.

| Phase | Inhalt | Ergebnis |
|---|---|---|
| 1 | Architektur, Plan, Projektgerüst | Diese Dokumente, Ordnerstruktur, Build läuft |
| 2 | 3D-Prototyp mit korrekt funktionierendem Brett | Brett, Figuren, Klick-Züge nach echten Regeln |
| 3 | Vollständig spielbare Partie + Tests | Alle Sonderregeln, Uhr, Zugliste, Rückgängig, Neustart, Speichern, Tests |
| 4 | Stockfish-KI, Stufen, Training | KI-Gegner 7 Stufen, Hinweise, Zugbewertung, Erklärungen |
| 5 | Grafik, Assets, Animation, Sound, Performance | Feinschliff Modelle/Material, Effekte, bessere Sounds |
| 6 | Produktions-Build | `npm run build` → statischer Ordner `dist/`, offline lauffähig |

## Phase 5 – Stand

Erledigt (0.2.0): Drag & Drop, Läuferkerbe per CSG, modellierter Springer, neue synthetische Sounds mit Hall und
Lautstärkeregler, Leistungsmessung und -optimierung (Dreiecke −79 %, Bildrate nach Bedarf, Schatten nur bei Bewegung,
adaptive Pixeldichte, Bundle-Aufteilung).

Noch offen / optional:
- Test auf echten Smartphones (Touch-Drag, Bildrate, Akku).
- Optional CC0-Modellsatz (z. B. Poly Haven „Chess Set“) oder aufgenommene CC0-Sounds – nur nach Freigabe des Downloads.
- Bloom/Postprocessing nur in Qualitätsstufe „Hoch“.
