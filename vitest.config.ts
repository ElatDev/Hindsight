import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Vitest config kept separate from vite.config.ts so the Electron plugin
// (which runs the main-process build pipeline) doesn't activate during tests.
export default defineConfig({
  test: {
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'dist-electron/**'],
    // Engine tests spawn a Stockfish subprocess and run real searches; the
    // default 5s vitest timeout is too tight for handshake + depth-10 search.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
