import { defineConfig, type Plugin } from 'vite';
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

/**
 * Give the chat store the device's attachment store.
 *
 * The console's chat store imports `./attachment-store`, which keeps photos in
 * IndexedDB — storage iOS may clear under space pressure. This redirects that
 * one import, from that one importer, to `src/native/attachment-store.ts`: the
 * same exports, backed by the app's data directory on a device and delegating
 * to the console's own module in a browser. The console's source is not
 * edited. Every other importer of the original — including the replacement
 * itself — still gets the original, so there is no loop.
 */
function deviceAttachmentStore(): Plugin {
  const chatStore = path.resolve(OS_SRC, 'lib/chat-store.tsx');
  const replacement = path.resolve(__dirname, 'src/native/attachment-store.ts');
  const same = (a: string, b: string) =>
    path.normalize(a).toLowerCase() === path.normalize(b).toLowerCase();
  return {
    name: 'device-attachment-store',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source !== './attachment-store' || !importer) return null;
      return same(importer.split('?')[0]!, chatStore) ? replacement : null;
    },
  };
}

export default defineConfig({
  plugins: [deviceAttachmentStore(), react()],
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
