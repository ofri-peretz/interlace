/**
 * Primitives MIN_VIEWPORT + client/server contract lock.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * Per CLAUDE.md ("Regressions are the issue. Lock everything you fix.") any
 * structural invariant we care about must be pinned by a test that would have
 * caught the regression pre-deploy. DESIGN_PRINCIPLES #14 ("Every primitive
 * declares its minimum viewport") is one of those invariants: each Interlace
 * UI primitive must export a `MIN_VIEWPORT` constant AND project that value
 * onto the rendered root via a `data-min-viewport=` attribute so audits +
 * Storybook + lighthouse can flag a hostile component on a too-narrow screen.
 *
 * The companion contract — client-vs-server boundary — is just as load-bearing.
 * `'use client'` is invisible at runtime but flips the whole subtree into a
 * client bundle; a careless refactor that adds the directive to a server
 * primitive (or strips it from a client one) breaks RSC composition silently
 * (server primitive becomes un-tree-shakeable; client primitive throws at
 * import time inside an RSC). Both regressions ship without lighting up any
 * runtime test — they only show up in `next build` budgets or in a user's
 * browser — so we pin them statically here.
 *
 * Static source-parse (fs.readFileSync + regex) is intentional: this is a
 * structural lock, not a render test. We assert what the SOURCE says, not
 * what React renders, so a future refactor that moves the attribute into a
 * helper or memo can't accidentally launder past the check.
 *
 * If you add a new primitive that owns a viewport contract, append it here.
 * If you move one between client and server tiers, update the array AND the
 * matching `DESIGN_PRINCIPLES.md` row in the same PR.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Contract — the 9 primitives this lock covers.
//   - `name`     : filename (no extension) under packages/ui/src/primitives/
//   - `viewport` : the MIN_VIEWPORT value baked into the source (320|480|768)
//   - `tier`     : 'client' if the source starts with `'use client'`,
//                  'server' if it must NOT carry that directive.
// ---------------------------------------------------------------------------
const PRIMITIVES = [
  { name: 'form', viewport: 320, tier: 'server' },
  { name: 'textarea', viewport: 320, tier: 'server' },
  { name: 'toast', viewport: 320, tier: 'client' },
  { name: 'alert-dialog', viewport: 320, tier: 'client' },
  { name: 'progress', viewport: 320, tier: 'client' },
  { name: 'breadcrumb', viewport: 480, tier: 'server' },
  { name: 'aspect-ratio', viewport: 320, tier: 'server' },
  { name: 'collapsible', viewport: 320, tier: 'client' },
  { name: 'hover-card', viewport: 768, tier: 'client' },
  { name: 'slider', viewport: 320, tier: 'client' },
  { name: 'toggle', viewport: 320, tier: 'client' },
  { name: 'number-field', viewport: 320, tier: 'client' },
  // A3 — a11y primitives (this PR)
  { name: 'skip-link', viewport: 320, tier: 'server' },
  { name: 'visually-hidden', viewport: 320, tier: 'server' },
  { name: 'focus-ring', viewport: 320, tier: 'server' },
  // B — blog primitives (this PR)
  { name: 'callout', viewport: 320, tier: 'server' },
  // Prose is client-tier because it uses useLayoutEffect to inject
  // tabindex="0" on overflowing <pre>/<table> descendants — axe's
  // `scrollable-region-focusable` requires those regions to be keyboard
  // reachable, and the wrapper can't satisfy that contract without
  // DOM access. The article surface itself still SSRs; only the
  // a11y attribute fix-up runs on the client after hydration.
  { name: 'prose', viewport: 320, tier: 'client' },
  { name: 'code-block', viewport: 320, tier: 'client' },
  { name: 'tag', viewport: 320, tier: 'server' },
  { name: 'toc', viewport: 480, tier: 'client' },
  { name: 'reading-time', viewport: 320, tier: 'server' },
  { name: 'published-date', viewport: 320, tier: 'server' },
  // Phase 3 — partial loading primitive. DataState is intentionally
  // NOT in this list: it's a state-orchestration wrapper with no visual
  // chrome of its own (just routes between loading / error / empty /
  // idle children), so it has no min-viewport to declare. SectionBoundary
  // DOES own a wrapping <section> element, so the contract applies.
  { name: 'section-boundary', viewport: 320, tier: 'client' },
  // Phase: scorecard pages — visual grade pill.
  { name: 'grade-badge', viewport: 320, tier: 'server' },
  // Right-click menu (paired with DropdownMenu's click-to-open variant).
  { name: 'context-menu', viewport: 320, tier: 'client' },
  // Phase 1.1 — form & input primitives brought to the component floor.
  // All five interactive ones are client-tier because Base UI ships client
  // hooks for their state machines; Input and Label are pure native
  // elements and stay server-tier so an RSC form never pulls a bundle.
  //
  // 320 across the board: a sign-in / contact / search form is the LAST
  // surface allowed to degrade on a narrow screen (iPhone SE class).
  { name: 'input', viewport: 320, tier: 'server' },
  { name: 'label', viewport: 320, tier: 'server' },
  { name: 'checkbox', viewport: 320, tier: 'client' },
  { name: 'radio-group', viewport: 320, tier: 'client' },
  { name: 'select', viewport: 320, tier: 'client' },
  { name: 'switch', viewport: 320, tier: 'client' },
  // ── Phase 1.2 — overlay & nav primitives ──────────────────────────────
  // Overlays project the attribute onto their POPUP, not their Root: Base
  // UI's `*.Root` for Dialog / Popover / Tooltip / Menu renders no DOM node,
  // so the Root has nowhere to hang the contract. Nav primitives (Tabs,
  // Accordion, Pagination, ScrollArea) own a real root element and use it.
  { name: 'dialog', viewport: 320, tier: 'client' },
  { name: 'sheet', viewport: 320, tier: 'client' },
  { name: 'popover', viewport: 320, tier: 'client' },
  // 320, not 768 like HoverCard: a tooltip is a short `w-fit` label that
  // Base UI also opens on keyboard focus, so it survives a touch screen.
  { name: 'tooltip', viewport: 320, tier: 'client' },
  { name: 'dropdown-menu', viewport: 320, tier: 'client' },
  { name: 'tabs', viewport: 320, tier: 'client' },
  { name: 'accordion', viewport: 320, tier: 'client' },
  // Pagination is a server primitive — plain anchors, no state.
  { name: 'pagination', viewport: 320, tier: 'server' },
  { name: 'scroll-area', viewport: 320, tier: 'client' },
  // ── Phase 8 — semantic themes ─────────────────────────────────────────
  // ThemeSwitcher is client-tier by necessity, not by preference: it reads
  // localStorage and matchMedia and writes to <html>. Its trigger collapses
  // to a 36px icon square below `sm`, so 320 is honest.
  { name: 'theme-switcher', viewport: 320, tier: 'client' },
  // ── Phase 10.2 / 10.3 — the absence vocabulary ────────────────────────
  // Both are server-tier: the whole vocabulary is a pure function of props,
  // so a dashboard can render a strip of measurements in an RSC without
  // shipping a byte of it to the browser. 320 across the board — a strip
  // collapses to two tracks and a meter is label-over-bar, which is the
  // layout that survives an iPhone SE.
  //
  // DataState itself stays OFF this list for the reason recorded above: it
  // is a state-orchestration wrapper with no chrome of its own. Its badge
  // is inline text, which has no viewport contract either.
  { name: 'stat-strip', viewport: 320, tier: 'server' },
  { name: 'meter', viewport: 320, tier: 'server' },
] as const;

/**
 * Templates that own MIN_VIEWPORT. These live under
 * `packages/ui/src/templates/` not `primitives/`. The test below splits
 * its source-read between the two roots.
 */
const TEMPLATES = [
  { name: 'article-template', viewport: 320, tier: 'server' },
  { name: 'registry-item-template', viewport: 320, tier: 'server' },
  { name: 'auth-template', viewport: 320, tier: 'server' },
  { name: 'error-template', viewport: 320, tier: 'server' },
  { name: 'landing-template', viewport: 320, tier: 'server' },
  { name: 'docs-page-template', viewport: 320, tier: 'server' },
  { name: 'dashboard-template', viewport: 480, tier: 'server' },
  { name: 'blog-home-template', viewport: 320, tier: 'server' },
  { name: 'settings-template', viewport: 480, tier: 'server' },
  { name: 'author-template', viewport: 320, tier: 'server' },
  { name: 'tag-template', viewport: 320, tier: 'server' },
  { name: 'stats-template', viewport: 320, tier: 'server' },
  { name: 'scorecard-template', viewport: 320, tier: 'server' },
] as const;

// Allowed viewport floors. Keep in lock-step with DESIGN_PRINCIPLES #14.
const ALLOWED_VIEWPORTS = [320, 480, 768] as const;

const readPrimitive = (name: string): string => {
  const absolute = resolve(
    __dirname,
    '../src/primitives',
    `${name}.tsx`,
  );
  return readFileSync(absolute, 'utf-8');
};

const readTemplate = (name: string): string => {
  const absolute = resolve(
    __dirname,
    '../src/templates',
    `${name}.tsx`,
  );
  return readFileSync(absolute, 'utf-8');
};

// Strip block comments + line comments before checking for the `'use client'`
// pragma so a docs-only mention inside a JSDoc header can't fool the test.
// Real directives are always the FIRST non-whitespace token in the file, so
// after comment-stripping we can simply look at the first statement.
const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/^\s*\/\/.*$/gm, ''); // line comments

const hasUseClientDirective = (source: string): boolean => {
  const stripped = stripComments(source).trimStart();
  return /^["']use client["'];?/.test(stripped);
};

for (const { name, viewport, tier } of [
  ...PRIMITIVES.map((p) => ({ ...p, kind: 'primitive' as const })),
  ...TEMPLATES.map((t) => ({ ...t, kind: 'template' as const })),
]) {
  describe(`${(name as string).endsWith('-template') ? 'template' : 'primitive'}: ${name}`, () => {
    const source =
      (name as string).endsWith('-template')
        ? readTemplate(name)
        : readPrimitive(name);

    // -----------------------------------------------------------------------
    // 1. MIN_VIEWPORT export + allowed literal (DESIGN_PRINCIPLES #14)
    // -----------------------------------------------------------------------
    it('exports a `MIN_VIEWPORT` constant', () => {
      expect(source).toMatch(/export\s+const\s+MIN_VIEWPORT\b/);
    });

    it(`pins MIN_VIEWPORT to the expected literal (${viewport})`, () => {
      // Look for `export const MIN_VIEWPORT = <number>` allowing optional
      // type annotation and trailing `as const`.
      const match = source.match(
        /export\s+const\s+MIN_VIEWPORT(?:\s*:\s*\w+)?\s*=\s*(\d+)\b/,
      );
      expect(match, 'MIN_VIEWPORT export not found').not.toBeNull();
      const literal = Number(match![1]);
      expect(ALLOWED_VIEWPORTS).toContain(literal as 320 | 480 | 768);
      expect(literal).toBe(viewport);
    });

    // -----------------------------------------------------------------------
    // 2. `data-min-viewport=` projected onto the rendered tree
    // -----------------------------------------------------------------------
    it('projects MIN_VIEWPORT onto the JSX via `data-min-viewport=`', () => {
      expect(source).toContain('data-min-viewport=');
    });

    // -----------------------------------------------------------------------
    // 3. Client / server tier — the `'use client'` directive contract
    // -----------------------------------------------------------------------
    if (tier === 'client') {
      it("declares the `'use client'` directive (client tier)", () => {
        expect(hasUseClientDirective(source)).toBe(true);
      });
    } else {
      it("does NOT declare the `'use client'` directive (server tier)", () => {
        expect(hasUseClientDirective(source)).toBe(false);
      });
    }
  });
}
