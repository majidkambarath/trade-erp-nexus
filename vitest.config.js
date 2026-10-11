import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Same alias as vite.config.js, so components that import "@/lib/utils" (the ui/ primitives)
  // can be rendered in tests.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    css: true,
    // 179 files render whole screens in parallel: a list-paging test that takes 1 s alone takes 6 s when the machine is busy, which is
    // over vitest's 5 s default and failed a different test on every full run (none of them a fault).
    testTimeout: 20000,
  },
});
