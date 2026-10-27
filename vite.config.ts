import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Portal-Build (CrazyGames): SDK-Skript einbinden, App-Installation (Manifest) weglassen */
function portalHtml(): Plugin {
  return {
    name: 'portal-html',
    transformIndexHtml(html) {
      return html
        .replace(/\s*<link rel="manifest"[^>]*>/, '')
        .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
        .replace('<script type="module"', '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n    <script type="module"');
    },
  };
}

export default defineConfig(({ mode }) => {
  const portal = mode === 'crazygames';
  return {
  define: { __PORTAL__: JSON.stringify(portal) },
  // Relative Pfade: der Build läuft in jedem Unterordner und von jedem statischen Webspace.
  base: './',
  plugins: portal ? [react(), portalHtml()] : [react()],
  server: { port: 5173 },
  build: {
    outDir: portal ? 'dist-crazygames' : 'dist',
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
  };
});
