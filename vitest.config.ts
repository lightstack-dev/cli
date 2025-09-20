import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks', // Use process forks instead of workers to support process.chdir
    poolOptions: {
      forks: {
        singleFork: true, // Use single fork for smoke tests that need process.chdir
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '*.config.ts',
        '*.config.js',
        'docs/',
      ],
    },
    include: ['tests/unit/**/*.test.ts', 'tests/smoke/**/*.test.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});