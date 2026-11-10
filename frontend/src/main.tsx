/**
 * @file main.tsx
 * @description Application bootstrap entrypoint for the PioneerRemote frontend.
 * Initializes the React 18 concurrent root, mounts the top-level application tree
 * inside React StrictMode, and imports global stylesheet tokens.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Global DOM Mount Target & Concurrent Root Bootstrap.
 *
 * Locates the root `<div id="root">` element in `index.html` and creates a React 18
 * concurrent root using `ReactDOM.createRoot`.
 *
 * React.StrictMode wraps `<App />` during development to:
 * - Surface side-effects by intentionally double-invoking lifecycle methods and effect hooks.
 * - Detect deprecated React APIs, legacy ref usage, or unexpected side effects.
 * - Verify that cleanup routines (such as WebSocket teardown in App.tsx) properly dispose of resources.
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element. Ensure index.html contains <div id="root"></div>.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

