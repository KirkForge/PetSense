import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, 'src/lib'),
    },
    // ponytail: Svelte 5 client build (mount) in jsdom — without this vitest
    // resolves svelte's server build, where mount() throws
    // lifecycle_function_unavailable, failing every component test.
    conditions: ['browser'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
});
