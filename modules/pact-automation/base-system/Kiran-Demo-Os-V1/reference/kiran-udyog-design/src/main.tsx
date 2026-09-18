/// <reference types="vite/client" />

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import App from '@/App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('RTS could not start: no #root element found in index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
