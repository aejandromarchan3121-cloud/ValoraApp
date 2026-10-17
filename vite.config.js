import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/p2p': { target: 'https://p2p.binance.com', changeOrigin: true, rewrite: (p) => p.replace(/^\/p2p/, '') },
    },
  },
});