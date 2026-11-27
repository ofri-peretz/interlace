import { defineConfig } from 'vitest/config';

/**
 * The native package's tests run in Node: they cover the pure modules (tokens, theme building,
 * contrast) at 100%, the same ledger rule as @interlace/ui. The components are type-checked
 * (`npm run typecheck`) and run in the consumer's app; a React Native renderer in Node is a
 * later wave, and until then no `.tsx` file is in the coverage list.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    passWithNoTests: false,
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/{contrast,error-handler,reading-prefs,scale,theme-model,tokens.generated}.ts'],
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
      reportsDirectory: './coverage',
      reporter: ['text-summary'],
    },
  },
});
