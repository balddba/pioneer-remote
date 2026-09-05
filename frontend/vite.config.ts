import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/power': 'http://localhost:8000',
      '/volume': 'http://localhost:8000',
      '/input': 'http://localhost:8000',
      '/mute': 'http://localhost:8000',
      '/status': 'http://localhost:8000',
      '/command': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
});
