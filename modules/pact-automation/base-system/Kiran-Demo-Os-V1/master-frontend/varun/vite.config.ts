import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// One origin for the whole console: the Python API and the files it stores are
// proxied under the same host the app is served from, so nothing in the client
// ever needs to know a port number.
const API = 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/uploads': { target: API, changeOrigin: true },
    },
  },
  // `vite preview` serves the built bundle instead of compiling on demand, which costs a
  // fraction of the dev server's memory - on a machine under pressure the dev server is
  // the first thing the OS kills, and it took the console down three times in one demo
  // session. It needs its own proxy block: `server.proxy` does not apply to preview, and
  // without this every /api call from the built console 404s against the static server.
  //
  //   npm run build && npx vite preview --port 5173
  //
  // Same URL, same origin, same behaviour. Use the dev server while editing the console.
  preview: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/uploads': { target: API, changeOrigin: true },
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
          markdown: ['react-markdown', 'remark-gfm', 'rehype-highlight', 'highlight.js'],
          react: ['react', 'react-dom', 'react-router-dom'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
          icons: ['lucide-react'],
          date: ['date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
