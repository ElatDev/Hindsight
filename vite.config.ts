import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'node:path';

// Native CJS modules must stay external — Rollup can't bundle a `.node`
// addon, and `bindings`/`file-uri-to-path` use dynamic `require` paths that
// resolve correctly only when the package is loaded from node_modules at
// runtime. Add to this list whenever a new native dep enters the main side.
const NATIVE_EXTERNALS = ['better-sqlite3', 'bindings', 'file-uri-to-path'];

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: NATIVE_EXTERNALS,
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              external: NATIVE_EXTERNALS,
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
