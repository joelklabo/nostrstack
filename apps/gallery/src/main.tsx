import './gallery.css';

import { ensureNostrstackEmbedStyles } from '@nostrstack/embed';
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { ToastProvider } from './ui/toast';

ensureNostrstackEmbedStyles();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
