import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the client runs on :5173 and proxies API + share-download calls to
// the Express server on :8080. In production the server serves the built files.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
