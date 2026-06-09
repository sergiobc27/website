import { defineConfig } from 'vitest/config';

// Pruebas unitarias (lógica pura en TS). Se acota a src/ para no recoger ni los
// e2e de Playwright (tests/e2e) ni el test del Worker (tests/worker.test.mjs, que
// corre con el runner nativo de Node vía `npm test`).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
