import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    {/* basename matches Vite's `base: '/app/'` so links resolve under interwave.cc/app/ */}
    <BrowserRouter basename="/app">
      <App />
    </BrowserRouter>
  </StrictMode>
);
