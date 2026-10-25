# Rebell Chess 3D – Entwicklungsplan

Nach jeder Phase ist die Anwendung startbar (`npm run dev`) und testbar (`npm test`).
Der aktuelle Stand jeder Funktion steht in `FORTSCHRITT.md`.

| Phase | Inhalt | Ergebnis |
|---|---|---|
| 1 | Architektur, Plan, Projektgerüst | Diese Dokumente, Ordnerstruktur, Build läuft |
| 2 | 3D-Prototyp mit korrekt funktionierendem Brett | Brett, Figuren, Klick-Züge nach echten Regeln |
| 3 | Vollständig spielbare Partie + Tests | Alle Sonderregeln, Uhr, Zugliste, Rückgängig, Neustart, Speichern, Tests |
| 4 | Stockfish-KI, Stufen, Training | KI-Gegner 6 Stufen, Hinweise, Zugbewertung, Erklärungen |
| 5 | Grafik, Assets, Animation, Sound, Performance | Feinschliff Modelle/Material, Effekte, bessere Sounds |
| 6 | Produktions-Build | `npm run build` → statischer Ordner `dist/`, offline lauffähig |

## Phase 5 – geplante Verbesserungen (noch offen)

- Figuren: Läufer-Kerbe per CSG, feinere Springer-Form, optional CC0-Modellsatz
  (z. B. Poly Haven „Chess Set“, CC0) – nur nach Freigabe des Downloads.
- Aufgenommene Soundeffekte (CC0) statt synthetischer Klänge.
- Bloom/Postprocessing nur in Qualitätsstufe „Hoch“.
- Ziehen per Drag & Drop zusätzlich zum Klicken.
