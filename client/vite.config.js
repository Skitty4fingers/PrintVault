import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the client runs on :5173 and proxies API + share-download calls to
// the Express server on :8080. In production the server serves the built files.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 42069,
    host: true, // expose the dev server on the LAN / Tailscale interface too
    proxy: {
      // Proxy API calls to the backend (PORT in .env, default 8080).
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
