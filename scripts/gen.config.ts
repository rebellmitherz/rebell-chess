import { defineConfig } from 'vitest/config';

/** Nur für Hilfsskripte, die TypeScript-Code des Spiels brauchen (z. B. Rätsel erzeugen) */
export default defineConfig({
  test: { environment: 'node', include: ['scripts/*.gen.ts'], testTimeout: 6 * 3600_000 },
});
