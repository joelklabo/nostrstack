import './utils/mock-relay-init';
import './gallery.css';

import { ensureNostrstackEmbedStyles } from '@nostrstack/embed';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { reportWebVitals } from './analytics/web-vitals';
import App from './App';
import { startCacheManager } from './cache/cacheManager';
import { ToastProvider } from './ui/toast';

if ('serviceWorker' in navigator) {
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

ensureNostrstackEmbedStyles();

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
