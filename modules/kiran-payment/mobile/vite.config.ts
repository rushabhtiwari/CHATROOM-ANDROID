import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The console owns 5173 and the Python API owns 3001. The mobile app takes the
// next port so both can run side by side while we compare them.
const API = process.env.KIRAN_API ?? 'http://127.0.0.1:3001';
const PORT = Number(process.env.MOBILE_PORT ?? 5174);

// `kiran-os` is a workspace symlink to the console's source, which lives
// outside this package. Vite resolves the symlink to its real path, so the dev
// server's file allowlist and the aliases both have to name that real path.
const OS_SRC = path.resolve(__dirname, '../master-frontend/vd/src');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // `@` means the console, here and inside the console itself. The console
      // has 292 imports written as '@/lib/...', and they have to keep meaning
      // the console's own source when Vite compiles those files into this app.
      // Giving `@` any other meaning here would silently redirect every one of
      // them into this package.
      '@': OS_SRC,
      // `~` means this app. The mobile code is the guest in this arrangement,
      // so it takes the new prefix rather than the established one.
      '~': path.resolve(__dirname, './src'),
    },
    // One React instance. Two would break every hook the shared chat store owns.
    dedupe: ['react', 'react-dom'],
  },
  // A linked workspace package is source, not a dependency: let Vite's pipeline
  // compile its TypeScript instead of trying to pre-bundle it.
  optimizeDeps: { exclude: ['kiran-os'] },
  server: {
    port: PORT,
    strictPort: true,
    host: true,
    fs: { allow: [path.resolve(__dirname, '..')] },
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/uploads': { target: API, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          markdown: ['react-markdown', 'remark-gfm', 'rehype-highlight'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
