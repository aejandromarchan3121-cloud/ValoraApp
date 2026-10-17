import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Redireciona as chamadas de /api para a sua implantação na Vercel em desenvolvimento local
      '/api': {
        target: 'https://valoraapp-sigma.vercel.app',
        changeOrigin: true,
        secure: true,
      },
      // Caso ainda precise manter o redirecionamento direto do P2P em dev local:
      '/p2p': {
        target: 'https://p2p.binance.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/p2p/, ''),
      }, 
    },
  },
});