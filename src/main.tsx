import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initOnlineMonitor } from './lib/online';
import { initCrashReporter } from './lib/crashReporter';

initOnlineMonitor();
initCrashReporter();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
