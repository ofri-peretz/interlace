/**
 * Storybook test-runner config.
 *
 * Runs axe-core against every story and asserts zero violations at the
 * strict tag stack. The sibling gate is apps/landing/e2e/a11y.spec.ts
 * (`A11Y_TAGS`) — same seven tags, with `color-contrast-enhanced` explicitly
 * excluded there because the marketing gradient cannot clear AAA. This gate
 * DOES enforce AAA, because it scores DS tokens rather than gradients.
 * (`apps/docs/e2e/a11y.spec.ts` and `scripts/a11y-summary.ts`, cited here
 * before, do not exist in this repo.)
 *
 * The test-runner walks every story by composing them in a headless
 * browser and invoking the story's `play` function. Stories without play
 * functions still get the axe scan; stories with play functions execute
 * their interactions first, then get scanned (interactive states are
 * a11y-tested too, not just the initial render).
 *
 * Layer 4 of UX_PHILOSOPHY.md — per-component isolation.
 *
 * ─── The matrix (Phase 8.4) ───────────────────────────────────────
 *
 * Contrast is a property of a theme × scheme PAIR, not of a component. The
 * scan above covers whichever pair the story happens to render in, and the
 * corpus covers the SCHEME axis by construction — every component ships a
 * default story and a `--dark` twin. Nothing covered the THEME axis: Harbor
 * shipped a complete, contract-checked palette that no axe run had ever
 * looked at, which makes "AA in every theme" an untested claim about a
 * second brand rather than a measurement.
 *
 * So after the primary scan, `postVisit` re-runs the COLOUR rules once per
 * other registered theme, at the scheme the story is already in. Together
 * with the light/dark story pairs that is the full matrix, at the cost of
 * one extra colour-only pass per story per extra theme.
 *
 * Two decisions worth stating, because both look like omissions:
 *
 *   1. The sweep flips `data-theme` and NEVER the scheme. Forcing `.dark`
 *      off `<html>` would leave the `--dark` stories' own `.dark` wrapper
 *      div in place — dark-scheme foregrounds on a light page — and every
 *      one of them would report contrast failures that no user can reach.
 *      The scheme axis belongs to the story, and it already has it.
 *
 *   2. The theme list is DISCOVERED from the stylesheet the page actually
 *      loaded (`[data-theme='x']` selectors), not hard-coded here and not
 *      imported from `theme-tokens.ts`. A hard-coded list is a list that
 *      silently stops covering theme #3; and a sweep that finds no themes
 *      at all — a CSS-build regression — must fail rather than pass by
 *      finding nothing to check, which is why `expectedThemes` is asserted
 *      rather than assumed.
 */
import type { TestRunnerConfig } from '@storybook/test-runner';
import { getStoryContext } from '@storybook/test-runner';
import { injectAxe } from 'axe-playwright';

const STRICT_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
  'ACT',
];

// AAA-level rules. As of the AAA-bump commit (interlace-theme.css token
// ladder), `color-contrast-enhanced` is INTENTIONALLY enforced — brand
// tokens clear ≥7:1 in both modes. Leave this empty unless a real
// physics-of-light constraint requires carving out a rule globally;
// per-story carve-outs go in `parameters.a11y.config.rules`.
const AAA_RULES_DISABLED: string[] = [];

/**
 * The rules the theme sweep re-runs. Swapping `data-theme` changes colour
 * values and nothing else — no node is added, removed, named or re-roled —
 * so re-running the structural rules would burn a full axe pass per theme
 * to reproduce results that cannot have changed.
 *
 * `color-contrast-enhanced` (AAA) is deliberately absent: it is not in
 * STRICT_TAGS either, and a sweep that holds a second theme to a bar the
 * first one is not held to would fail Harbor for being Harbor.
 */
const COLOUR_RULES = ['color-contrast', 'link-in-text-block'];

/**
 * How many themes the sweep must find before it believes itself.
 *
 * `interlace` is `:root` (no attribute), so it is added by definition and
 * proves nothing. This floor is really "at least one `[data-theme]` theme
 * reached the page" — i.e. the DS stylesheet loaded and its theme files came
 * with it. Without the floor, a broken `@import` turns the whole sweep into
 * a loop over one theme that reports success.
 */
const MIN_THEMES = 2;

const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },

  async postVisit(page, context) {

    /**
     * A padded story's root must FILL the canvas.
     *
     * This catches the regression class that shipped to the public registry:
     * `#storybook-root` sized to its CONTENT rather than the viewport, so a
     * component that sizes itself from its container (`w-full`, `max-w-*`,
     * SVG `viewBox`) resolved its percentage against an indefinite width and
     * collapsed. SignInForm rendered as a ~40px column with circular inputs;
     * FocusRing rendered one word per line; charts painted nothing at all.
     * Every one of those looked like a broken component and was a broken
     * CONTAINER.
     *
     * Only `layout: 'padded'` (our global default) is asserted. `centered` is
     * a legitimate opt-in for components with intrinsic width — a lone Badge,
     * an overlay trigger — and there the fit-content root is the point, so
     * asserting against it would be asserting against the feature.
     *
     * Note what this does NOT claim: a 384px SignInForm inside a 1248px canvas
     * is CORRECT. `max-w-96` is the component's own decision and a sign-in form
     * has no business being 1248px wide. Narrow-by-design is a presentation
     * question, not a bug; a collapsed root is the bug.
     */
    // The runner's TestContext does not expose `parameters`, so read the
    // resolved layout off the preview itself — which is also more honest: it
    // reports what the story ACTUALLY rendered with, not what its meta asked
    // for.
    const layout = await page.evaluate(() => {
      const b = document.body.className;
      if (b.includes('sb-main-centered')) return 'centered';
      if (b.includes('sb-main-fullscreen')) return 'fullscreen';
      return 'padded';
    });
    if (layout === 'padded') {
      const box = await page.evaluate(() => {
        const root = document.getElementById('storybook-root');
        return {
          root: root ? root.getBoundingClientRect().width : 0,
          body: document.body.getBoundingClientRect().width,
        };
      });
      // 0.8 rather than 1.0: `padded` adds its own gutter, and a story may add
      // its own. A root under 80% of the body has not been padded, it has
      // collapsed.
      if (box.body > 0 && box.root < box.body * 0.8) {
        throw new Error(
          `Story root collapsed: #storybook-root is ${Math.round(box.root)}px ` +
            `inside a ${Math.round(box.body)}px canvas (layout: '${layout}').\n` +
            `A padded story's root must fill the canvas. Either the component ` +
            `has no responsive width strategy, or this story wants ` +
            `\`parameters: { layout: 'centered' }\` because it is ` +
            `intrinsically narrow. Do NOT "fix" this by hardcoding a pixel ` +
            `width on a wrapper.`,
        );
      }
    }
    const storyContext = await getStoryContext(page, context);
    if (storyContext.parameters?.a11y?.skip) return;

    type RuleOverride = { id: string; enabled?: boolean };
    const ruleOverrides: RuleOverride[] =
      (storyContext.parameters?.a11y?.config?.rules as RuleOverride[] | undefined) ?? [];

    const results: {
      violations: Array<{
        id: string;
        help: string;
        impact: string | null;
        nodes: Array<{ target: string[]; failureSummary: string; html: string }>;
      }>;
    } = await page.evaluate(
      async ({ tags, rules, aaaDisabled }) => {
        const opts: Record<string, unknown> = {
          runOnly: { type: 'tag', values: tags },
        };
        const ruleMap: Record<string, { enabled: boolean }> = {};
        for (const id of aaaDisabled) ruleMap[id] = { enabled: false };
        for (const r of rules) ruleMap[r.id] = { enabled: r.enabled !== false };
        if (Object.keys(ruleMap).length > 0) opts.rules = ruleMap;
        // @ts-ignore — axe is injected into the page by injectAxe.
        return await window.axe.run(document.querySelector('#storybook-root'), opts);
      },
      { tags: STRICT_TAGS, rules: ruleOverrides, aaaDisabled: AAA_RULES_DISABLED },
    );

    if (results.violations.length > 0) {
      const lines = ['', `=== A11Y violations in story: ${context.title} > ${context.name} ===`];
      for (const v of results.violations) {
        lines.push(`[${v.impact ?? 'unknown'}] ${v.id} — ${v.help}`);
        for (const n of v.nodes) {
          lines.push(`  • ${n.target.join(' ')}`);
          lines.push(`    ${n.failureSummary.replace(/\n/g, '\n    ')}`);
          lines.push(`    html: ${n.html.slice(0, 200)}`);
        }
      }
      // eslint-disable-next-line no-console
      console.log(lines.join('\n'));
      throw new Error(
        `${results.violations.length} accessibility violation(s) in ${context.title} > ${context.name} (see logged report above)`,
      );
    }

    // ─── Theme-matrix colour sweep ────────────────────────────────────
    // Same DOM, other brands. See the file header for why this flips the
    // theme axis only, and why the theme list is discovered rather than
    // declared.
    const matrix: { themes: string[]; failures: string[] } = await page.evaluate(
      async ({ rules, colourRules }) => {
        const root = document.documentElement;
        const originalTheme = root.getAttribute('data-theme');
        // `:root` IS the default theme, so it is never spelled as an
        // attribute anywhere — including here.
        const activeTheme = originalTheme ?? 'interlace';

        // Discover the theme axis from the CSS that actually reached this
        // document. Layer blocks (`@layer interlace.brand { … }`) nest their
        // rules, hence the recursive walk.
        const discovered = new Set<string>(['interlace']);
        const walk = (rules_: CSSRuleList): void => {
          for (const rule of Array.from(rules_)) {
            const selector = (rule as CSSStyleRule).selectorText;
            if (typeof selector === 'string') {
              const re = /\[data-theme=['"]([a-z0-9-]+)['"]\]/g;
              let match: RegExpExecArray | null;
              while ((match = re.exec(selector)) !== null) discovered.add(match[1]);
            }
            const nested = (rule as CSSGroupingRule).cssRules;
            if (nested) walk(nested);
          }
        };
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            walk(sheet.cssRules);
          } catch {
            /* cross-origin sheet — nothing of ours is, so nothing is lost */
          }
        }

        const ruleMap: Record<string, { enabled: boolean }> = {};
        for (const r of rules) ruleMap[r.id] = { enabled: r.enabled !== false };

        const failures: string[] = [];
        for (const theme of discovered) {
          if (theme === activeTheme) continue; // already scanned in full above
          if (theme === 'interlace') root.removeAttribute('data-theme');
          else root.setAttribute('data-theme', theme);

          const result = await (
            window as unknown as {
              axe: {
                run: (
                  ctx: Element | null,
                  opts: Record<string, unknown>,
                ) => Promise<{
                  violations: Array<{
                    id: string;
                    impact: string | null;
                    help: string;
                    nodes: Array<{ target: string[]; failureSummary: string }>;
                  }>;
                }>;
              };
            }
          ).axe.run(document.querySelector('#storybook-root'), {
            runOnly: { type: 'rule', values: colourRules },
            ...(Object.keys(ruleMap).length > 0 ? { rules: ruleMap } : {}),
          });

          for (const v of result.violations) {
            for (const n of v.nodes) {
              failures.push(
                `  [${theme}] ${v.id} — ${v.help}\n    ${n.target.join(' ')}\n` +
                  `    ${n.failureSummary.replace(/\n/g, '\n    ')}`,
              );
            }
          }
        }

        // Restore, always — the next assertion in this same postVisit reads
        // computed styles, and a leaked `data-theme` would silently move it
        // to another brand.
        if (originalTheme === null) root.removeAttribute('data-theme');
        else root.setAttribute('data-theme', originalTheme);

        return { themes: [...discovered], failures };
      },
      { rules: ruleOverrides, colourRules: COLOUR_RULES },
    );

    if (matrix.themes.length < MIN_THEMES) {
      throw new Error(
        `Theme sweep found ${matrix.themes.length} theme(s) (${matrix.themes.join(', ')}) ` +
          `in the page's stylesheets, expected at least ${MIN_THEMES}. Either a theme ` +
          `file stopped being imported by packages/ui/styles/index.css, or the DS CSS ` +
          `is not reaching the preview at all — both make this sweep pass by having ` +
          `nothing to check.`,
      );
    }

    if (matrix.failures.length > 0) {
      const lines = [
        '',
        `=== A11Y violations in NON-ACTIVE THEMES: ${context.title} > ${context.name} ===`,
        `(same DOM, same scheme, other brand palettes — themes found: ${matrix.themes.join(', ')})`,
        ...matrix.failures,
      ];
      // eslint-disable-next-line no-console
      console.log(lines.join('\n'));
      throw new Error(
        `${matrix.failures.length} theme-matrix accessibility violation(s) in ` +
          `${context.title} > ${context.name} (see logged report above)`,
      );
    }

    // ─── Styling-sanity sweep ─────────────────────────────────────────
    // Cheap per-story computed-style checks. Catches the failure mode where
    // a CSS-build regression (broken `@source`, missing import) ships an
    // ~unstyled DOM. Each assertion is opt-in via a `data-slot`, so stories
    // without the relevant primitive are no-ops.
    const stylingProblems: string[] = await page.evaluate(() => {
      const problems: string[] = [];
      const parseAlpha = (rgba: string): number => {
        // accepts `rgb(...)`, `rgba(...)`, `oklab(... / 0.5)`, `oklch(... / 0.5)`
        const slash = rgba.match(/\/\s*([0-9.]+)\s*\)/);
        if (slash) return Number.parseFloat(slash[1]);
        const m = rgba.match(/rgba?\([^)]+\)/);
        if (!m) return 1;
        const parts = m[0].replace(/rgba?\(|\)/g, '').split(',');
        return parts.length === 4 ? Number.parseFloat(parts[3]) : 1;
      };

      // Avatar root must be small (size-8 → 32px). If a primitive utility was
      // dropped, the inner SVG fallback fills the canvas and width balloons.
      for (const el of document.querySelectorAll<HTMLElement>('[data-slot="avatar"]')) {
        const w = el.getBoundingClientRect().width;
        if (w > 100) problems.push(`avatar width ${w.toFixed(0)}px > 100px (utility classes likely missing)`);
      }

      // Open Dialog content must be a fixed-position centred panel.
      for (const el of document.querySelectorAll<HTMLElement>('[data-slot="dialog-content"][data-open], [data-slot="dialog-content"][data-state="open"]')) {
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed') problems.push(`dialog-content position=${cs.position} (expected fixed)`);
      }

      // Dialog overlay must be a visible scrim (alpha > 0). bg-black/50 expands
      // to rgba(0,0,0,0.5) when emitted; if missing, alpha is 0 = invisible.
      for (const el of document.querySelectorAll<HTMLElement>('[data-slot="dialog-overlay"]')) {
        const alpha = parseAlpha(getComputedStyle(el).backgroundColor);
        if (alpha === 0) problems.push(`dialog-overlay background-color alpha=0 (expected > 0)`);
      }

      // Popover / DropdownMenu / Tooltip popups. NOT the Dialog contract:
      // Base UI puts the positioning on the *Positioner*, and the popup is a
      // `position: static` child of it. Asserting `fixed|absolute` on the
      // popup fails for every open one; asserting it on the positioner would
      // never fail, because that position is an inline style Base UI writes at
      // runtime — it survives a CSS build that emitted nothing. So assert what
      // Tailwind actually owns here: an opaque surface (`bg-popover` /
      // `bg-primary`) with `rounded-md`. Both vanish if the CSS is missing.
      for (const slot of ['popover-content', 'dropdown-menu-content', 'tooltip-content']) {
        const sel = `[data-slot="${slot}"][data-open], [data-slot="${slot}"][data-state="open"]`;
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          const cs = getComputedStyle(el);
          if (parseAlpha(cs.backgroundColor) === 0) {
            problems.push(`${slot} background-color alpha=0 (expected an opaque surface)`);
          }
          if (Number.parseFloat(cs.borderTopLeftRadius) === 0) {
            problems.push(`${slot} border-radius=0 (expected rounded-md)`);
          }
        }
      }

      return problems;
    });

    if (stylingProblems.length > 0) {
      const lines = ['', `=== STYLING regressions in story: ${context.title} > ${context.name} ===`];
      for (const p of stylingProblems) lines.push(`  • ${p}`);
      // eslint-disable-next-line no-console
      console.log(lines.join('\n'));
      throw new Error(
        `${stylingProblems.length} styling regression(s) in ${context.title} > ${context.name} (see logged report above)`,
      );
    }
  },
};

export default config;
