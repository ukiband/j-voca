import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import { initializeTheme } from './lib/theme';
import { startUpdateChecks } from './lib/app-update';

const cleanupTheme = initializeTheme();
if (import.meta.hot) import.meta.hot.dispose(cleanupTheme);

// Apply saved font size
const savedSize = localStorage.getItem('font-size') || 'base';
document.documentElement.className = `font-${savedSize}`;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/j-voca/sw.js').catch(() => {});
  });
}

const stopUpdateChecks = startUpdateChecks();
if (import.meta.hot) import.meta.hot.dispose(stopUpdateChecks);
