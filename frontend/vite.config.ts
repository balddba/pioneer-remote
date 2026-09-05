import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/power': 'http://localhost:8099',
      '/volume': 'http://localhost:8099',
      '/input': 'http://localhost:8099',
      '/mute': 'http://localhost:8099',
      '/status': 'http://localhost:8099',
      '/command': 'http://localhost:8099',
      '/health': 'http://localhost:8099',
      '/ws': {
        target: 'ws://localhost:8099',
        ws: true,
      },
    },
  },
});
