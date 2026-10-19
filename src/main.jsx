import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support. Registered after load so it never competes with first paint.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      // A standalone iOS app is resumed rather than reloaded, so a single visit
      // can span days and the usual on-navigation update check may never fire.
      // Re-checking as the app comes forward is what lets a new build land
      // during the brief window the serving machine is actually reachable.
      const checkForUpdate = () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      };

      document.addEventListener('visibilitychange', checkForUpdate);
      checkForUpdate();
    } catch {
      /* offline support is a bonus, not a requirement */
    }
  });
}

// iOS fires a second tap as a zoom gesture; standalone apps never zoom.
document.addEventListener(
  'gesturestart',
  (event) => event.preventDefault(),
  { passive: false },
);
