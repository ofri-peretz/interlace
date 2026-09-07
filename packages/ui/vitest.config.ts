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
     * In scope: `src/charts/**`, `src/lib/**`, and — as of the primitives wave
     * — 35 of the 62 files in `src/primitives/`. All run in jsdom without a
     * browser, and `charts/scale.ts` / `charts/graph.ts` / the primitives'
     * variant maps are pure arithmetic and lookup — so 100% here is real, not
     * a number propped up by ignore pragmas. There is not one `v8 ignore` in
     * the covered set.
     *
     * PRIMITIVES: WHY A FILE LIST AND NOT `src/primitives/**`
     * ------------------------------------------------------
     * Because 27 of the 62 cannot reach 100 in jsdom today, and the rule above
     * says a file is in at 100 or it is out. Listing them is the honest form:
     * the glob is a ledger of what is actually measured, and adding a file to
     * it is a one-line diff the next wave can make.
     *
     * DO NOT "simplify" the `.ts` line to `src/primitives/*.ts`. Vitest's
     * coverage `include` matches `*.ts` against `.tsx` files as well, so that
     * wildcard silently drags all 27 excluded components back in — the run
     * then reports 97.4% and fails, and the pattern gives no hint why. Both
     * lines below name their files.
     *
     * EXCLUDED, AND WHY
     * -----------------
     *  1. PORTAL OVERLAYS (10 files, ~2,660 lines) — `alert-dialog`,
     *     `context-menu`, `dialog`, `dropdown-menu`, `hover-card`, `popover`,
     *     `select`, `sheet`, `toast`, `tooltip`. Each mounts into
     *     `document.body` via Base UI `Portal` + `Positioner`, whose
     *     floating-ui `autoUpdate` needs `ResizeObserver` (absent in jsdom),
     *     and each has 6–17 popup sub-components that are unreachable until
     *     the surface is opened. `toast` additionally throws Base UI error #66
     *     without a `Toast.Provider` ancestor. These belong in one overlay wave
     *     with a shared setup file, not smuggled in one at a time.
     *
     *  2. BROWSER-API COMPONENTS (5) — `code-block` (`navigator.clipboard`,
     *     absent in jsdom, plus fake timers for the copied-reset),
     *     `toc` (`IntersectionObserver` + `scrollIntoView` + `history.pushState`,
     *     and it imports the portal-based `popover`), `theme-switcher`
     *     (`localStorage` + `matchMedia` + `<html>` mutation AND renders
     *     through `dropdown-menu`), `meteors` (`Math.random()` — not
     *     deterministic — behind a `typeof window === 'undefined'` guard),
     *     `scroll-area` (Base UI ScrollArea requires `ResizeObserver`).
     *
     *  3. INLINE, NO PORTAL (11) — `accordion`, `collapsible`, `form`,
     *     `number-field`, `progress`, `prose`, `radio-group`, `slider`,
     *     `switch`, `tabs`, `toggle`. Mostly Base UI wrappers; `prose` is ours
     *     (a `useLayoutEffect` that tabs-focuses `pre`/`table`, plus a
     *     three-way ref-forwarding branch). These are the NEXT wave and
     *     the cheapest one: `checkbox` and `pagination` are already in at 100,
     *     which proves Base UI form controls do reach it in jsdom given the
     *     `PointerEvent` shim. Left out only for want of session, not for a
     *     reason of principle.
     *
     *  4. `skeleton.tsx` — the one file excluded for a reason worth writing
     *     down. It is 90% mechanically coverable (an `it.each` over
     *     `SKELETON_VARIANTS` walks every arm of `CompositeBody`), but its
     *     `default: return null` is UNREACHABLE through the public API:
     *     `CompositeBody` is only ever called from `CompositeSkeleton`, which
     *     is only reached when `COMPOSITE_VARIANTS.has(variant)`, and the
     *     19 members of that set are exactly the 19 `case` labels. So the
     *     default arm can only be closed by deleting it, by exporting an
     *     internal, or by an ignore pragma. It is defensive code — a variant
     *     added to the set without a matching case renders nothing instead of
     *     crashing — and trading that for a coverage point is the wrong side
     *     of the bargain. It stays out until the arm is reachable.
     *
     * Next waves (DESIGN-SYSTEM-PLAN.md phase 7.2): the inline Base UI
     * wrappers (3), then the overlay wave (1), then patterns → templates.
     */
    coverage: {
      enabled: true,
      provider: 'v8',
      include: [
        'src/charts/**/*.{ts,tsx}',
        'src/lib/**/*.{ts,tsx}',
        // The four pure variant/model modules.
        'src/primitives/{button-variants,data-state-model,meter-scale,skeleton-variants}.ts',
        // The 32 components with real render coverage. See the ledger above.
        'src/primitives/{alert,aspect-ratio,avatar,badge,box,breadcrumb,button,callout,card,checkbox,code-editor,container,data-state,focus-ring,grade-badge,grid,input,label,meter,pagination,published-date,reading-time,section,section-boundary,separator,skip-link,stack,stat-strip,tag,textarea,typography,visually-hidden}.tsx',
        // Patterns with full render coverage — the same ledger rule: a
        // file is in at 100 or it is out, and joining is a one-line diff.
        'src/patterns/lint-playground.tsx',
      ],
      exclude: ['**/*.stories.tsx', '**/*.meta.json'],
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
      reportsDirectory: './coverage',
      reporter: ['text-summary', 'html', 'lcov'],
    },
  },
});
