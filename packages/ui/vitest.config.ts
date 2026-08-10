import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest configuration for @interlace/ui.
 *
 * The tests in __tests__/ are *structural locks* — static source parsing
 * plus a tiny renderToStaticMarkup pass over layout primitives. No browser
 * APIs, but the static markup pass needs jsdom for React 19 type checks
 * around `useEffect` no-ops.
 *
 * `resolve.conditions` is the load-bearing piece: @base-ui/react exposes
 * subpath modules via package.json `exports` (e.g. `@base-ui/react/use-render`)
 * with `import` / `module` conditions. Without these, Vite returns
 * "Failed to resolve import" for every Base UI subpath.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ['module', 'import', 'default'],
  },
  test: {
    environment: 'jsdom',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    passWithNoTests: false,
    globals: true,
    reporters: ['default'],

    /**
     * Coverage ratchet — the `include` glob IS the ratchet.
     *
     * Until now "coverage" in this package meant structural parity locks
     * (`storybook-coverage-lock`, `skeleton-variant-coverage-lock`,
     * `composite-contrast-lock`). Those are good and they stay — but they
     * catch a missing story or an unmeasured contrast pair, never whether a
     * branch executed. Meanwhile every eslint plugin in the sibling monorepo
     * runs v8 at 100/100/100/100, so the DS had no number at all.
     *
     * The rule, borrowed from there: **a category is either in the glob at 100
     * or it is out.** No "87% and rising" — a threshold below 100 only records
     * how much you have stopped caring. Widening the glob is a coverage wave's
     * deliverable; lowering the numbers is not an option the next session gets.
     *
     * In scope today: `src/charts/**` and `src/lib/**`. Both run in jsdom
     * without a browser, and `charts/scale.ts` / `charts/graph.ts` are pure
     * arithmetic — so 100% here is real, not a number propped up by ignore
     * pragmas.
     *
     * Next waves (DESIGN-SYSTEM-PLAN.md phase 7.2): primitives → patterns →
     * templates.
     */
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/charts/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
      exclude: ['**/*.stories.tsx', '**/*.meta.json'],
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
      reportsDirectory: './coverage',
      reporter: ['text-summary', 'html', 'lcov'],
    },
  },
});
