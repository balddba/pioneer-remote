import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite Configuration for PioneerRemote Frontend.
 *
 * Configures the development server, React plugin integration, and local reverse
 * proxy routing. The reverse proxy transparently forwards REST API requests and
 * WebSocket connections to the backend Pioneer AVR controller daemon running on port 8099.
 *
 * @see https://vite.dev/config/
 */
export default defineConfig({
  /**
   * Vite plugins.
   * Enables Fast Refresh and JSX transformation via the official React plugin.
   */
  plugins: [react()],

  /**
   * Development server configuration.
   */
  server: {
    /**
     * Local development port for the frontend interface.
     */
    port: 5173,

    /**
     * Bind to all network interfaces (0.0.0.0) to allow testing from mobile devices
     * and external LAN clients on the local home network.
     */
    host: '0.0.0.0',

    /**
     * Reverse proxy configuration.
     * Routes backend API requests to the Python FastAPI backend service (default: localhost:8099).
     * Prevents CORS issues during local development.
     */
    proxy: {
      /** Route for power state query and toggle commands. */
      '/power': 'http://localhost:8099',

      /** Route for volume level query, direct set, and step (up/down) operations. */
      '/volume': 'http://localhost:8099',

      /** Route for input source selection and active input query. */
      '/input': 'http://localhost:8099',

      /** Route for audio mute status toggle and query. */
      '/mute': 'http://localhost:8099',

      /** Route for aggregated amplifier status snapshot. */
      '/status': 'http://localhost:8099',

      /** Route for direct/raw Pioneer RS-232/IP protocol command pass-through. */
      '/command': 'http://localhost:8099',

      /** Route for backend service and amplifier connectivity health checks. */
      '/health': 'http://localhost:8099',

      /**
       * WebSocket endpoint proxy for real-time status updates broadcast from the backend.
       * Enables HTTP connection upgrade to WebSocket protocol (`ws://localhost:8099`).
       */
      '/ws': {
        target: 'ws://localhost:8099',
        ws: true,
      },
    },
  },
});

