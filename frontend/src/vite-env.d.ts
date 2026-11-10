/// <reference types="vite/client" />

/**
 * Ambient type definitions for Vite client environment and application environment variables.
 *
 * This declaration file references Vite's built-in client types (static asset imports,
 * Hot Module Replacement (HMR) API, and `import.meta` extensions) and extends
 * `ImportMetaEnv` with PioneerRemote-specific environment variables.
 */

/**
 * Custom environment variable interface for the PioneerRemote frontend application.
 *
 * Variables declared here are loaded at build/dev time by Vite if prefixed with `VITE_`.
 */
interface ImportMetaEnv {
  /**
   * Optional custom HTTP base URL for backend REST API requests (e.g., `http://192.168.1.50:8099`).
   * When unset, the application defaults to relative URLs proxied through Vite in development
   * or served from the same host in production.
   */
  readonly VITE_API_URL?: string;

  /**
   * Optional custom WebSocket URL for real-time status streaming (e.g., `ws://192.168.1.50:8099/ws`).
   * When unset, the application dynamically resolves the WebSocket endpoint based on the current
   * browser origin (`window.location`).
   */
  readonly VITE_WS_URL?: string;
}

/**
 * Extends the global `ImportMeta` interface with typed environment definitions.
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

