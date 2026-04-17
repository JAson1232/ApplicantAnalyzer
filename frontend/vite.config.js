import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['applicant.iasonsomoglou.com'],
    proxy: {
      '/api': {
        target: 'http://backend:4000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://backend:4000',
        changeOrigin: true
      }
    }
  }
});
