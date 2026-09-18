import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// One origin for the whole console: the Python API and the files it stores are
// proxied under the same host the app is served from, so nothing in the client
// ever needs to know a port number.
// Inside the Central Platform this console runs beside the PACT console, which owns
// 3001/5173, so both values can be moved with an environment variable. Unset, they are
// exactly what they always were.
const API = process.env.KIRAN_API ?? 'http://127.0.0.1:3001';
const PORT = Number(process.env.KIRAN_PORT ?? 5173);
// The activity feed shows the order pipeline, which the PACT console's API owns.
const PACT_API = process.env.PACT_API ?? 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: PORT,
    strictPort: true,
    host: true,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/uploads': { target: API, changeOrigin: true },
      '/pact-api': {
        target: PACT_API,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pact-api/, '/api'),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // The console loads as one bundle today. Splitting the two heaviest
        // dependency groups keeps the first paint off the critical path of a
        // charting library the command centre may never render.
        manualChunks: {
          charts: ['recharts'],
          markdown: ['react-markdown', 'remark-gfm', 'rehype-highlight'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
