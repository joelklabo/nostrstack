import './utils/mock-relay-init';
import './web.css';

import { ToastProvider } from '@nostrstack/ui';
import { ensureNsEmbedStyles } from '@nostrstack/widgets';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { reportWebVitals } from './analytics/web-vitals';
import App from './App';
import { startCacheManager } from './cache/cacheManager';

if ('serviceWorker' in navigator) {
  const isLocalDev =
    import.meta.env.DEV &&
    (location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '::1');

  if (!isLocalDev) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('SW registered: ', registration);
        },
        (registrationError) => {
          console.log('SW registration failed: ', registrationError);
        }
      );
    });
  }
}

ensureNsEmbedStyles();

// Start cache manager for periodic cleanup and stats
startCacheManager();
reportWebVitals();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
