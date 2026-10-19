import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// In AI Studio preview iframe, HMR is disabled. Intercept any lingering WebSocket reconnect noise.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event.reason || '');
    if (msg.includes('WebSocket') || msg.includes('Transport') || msg.includes('@vite/client')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
  window.addEventListener('error', (event) => {
    const msg = String(event.message || '');
    const filename = String(event.filename || '');
    if (msg.includes('WebSocket') || filename.includes('@vite/client')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
