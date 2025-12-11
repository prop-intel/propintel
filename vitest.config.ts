import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'backend/**/*.test.ts',
      'tests/integration/backend-*.test.ts',
    ],
    exclude: ['node_modules', '.next', 'dist', '.serverless'],
    testTimeout: 30000, // 30 seconds for integration tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.*',
        '**/types.ts',
        '**/*.d.ts',
        'backend/scripts/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@backend': path.resolve(__dirname, './backend/src'),
    },
    conditions: ['node', 'import', 'default'],
  },
  ssr: {
    noExternal: ['next-auth'],
    resolve: {
      conditions: ['node', 'import'],
    },
  },
  optimizeDeps: {
    exclude: ['next-auth'],
    include: ['pg'],
  },
});
