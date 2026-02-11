import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportsDirectory: './coverage',
      include: ['lib/**/*.ts', 'stores/**/*.ts', 'electron/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        'electron/dist/**',
        'electron/forge.config.ts',
        'electron/main.ts',
        'electron/preload.ts',
        'electron/lib/db.ts',
        'electron/lib/export.ts',
        'electron/lib/queries.ts',
        'electron/lib/sql-query-executor.ts',
        'electron/lib/query-runners/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
