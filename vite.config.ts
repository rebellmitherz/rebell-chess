import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative Pfade: der Build läuft in jedem Unterordner und von jedem statischen Webspace.
  base: './',
  plugins: [react()],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // Große, selten geänderte Bibliotheken in eigene Dateien: nach einem App-Update
        // bleiben sie im Browser-Cache, nur der kleine App-Teil wird neu geladen.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/](three|three-mesh-bvh|three-bvh-csg|three-stdlib)[\\/]/ },
            { name: 'r3f', test: /node_modules[\\/](@react-three|camera-controls|maath|troika-[a-z-]+|zustand)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'chess', test: /node_modules[\\/]chess\.js[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
  },
});
