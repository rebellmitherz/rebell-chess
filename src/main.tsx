import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { gameStore } from './game/instance';
import { bindPortalToGame, initPortal, isPortal, portalLoadingDone } from './portal';
import { registerPwa } from './pwa';
import { App } from './ui/App';

if (isPortal) {
  // Portal (CrazyGames): kein Service Worker, keine App-Installation – das Portal bringt beides selbst mit
  void initPortal().then(() => {
    bindPortalToGame(gameStore);
    window.addEventListener('load', portalLoadingDone);
    if (document.readyState === 'complete') portalLoadingDone();
  });
} else registerPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
