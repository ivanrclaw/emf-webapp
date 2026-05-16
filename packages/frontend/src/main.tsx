import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// Suppress benign ResizeObserver loop warnings (triggered by React Flow during resize)
const resizeObserverErr = (e: ErrorEvent) => {
  if (e.message?.includes('ResizeObserver loop')) {
    e.stopImmediatePropagation();
  }
};
window.addEventListener('error', resizeObserverErr);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
