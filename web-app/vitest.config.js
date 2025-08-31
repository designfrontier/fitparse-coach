import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server.js', 'services/**/*.js', 'lib/**/*.js'],
      exclude: ['tests/**', 'node_modules/**', 'client/**']
    },
    // Separate test environments
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});