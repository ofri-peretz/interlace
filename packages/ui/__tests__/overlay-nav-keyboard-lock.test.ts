/**
 * Overlay & nav keyboard-contract lock (Phase 1.2).
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * Overlays are where a11y audits fail. axe (the `storybook (a11y)` CI gate)
 * renders each story and checks the STATIC tree — it cannot press a key, so
 * it never learns whether Escape closes a dialog, whether focus is trapped
 * inside it, whether focus is restored to the trigger on close, or whether a
 * hover-only surface is reachable at all without a pointer. Those are exactly
 * the regressions that ship silently.
 *
 * The keyboard flows themselves live in Storybook `play` functions, which
 * `npm run test-storybook:ci` executes in the same headless browser as axe.
 * This lock guards the layer above: it asserts every interactive overlay /
 * nav primitive in the 1.2 scope actually HAS such a story. Without it,
 * deleting a play function is a green PR.
 *
 * Static source-parse (fs.readFileSync + regex) is intentional — same posture
 * as the sibling locks. We assert what the SOURCE says, so a refactor that
 * hides the assertion behind a helper can't launder past the check.
 *
 * If you add an interactive overlay or nav primitive — or any primitive whose
 * contract only exists while something is focused — add it to KEYBOARD_DRIVEN
 * below AND write its `KeyboardFlow` story in the same PR.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');
const PRIMITIVES_DIR = join(REPO_ROOT, 'packages/ui/src/primitives');
const STORIES_DIR = join(REPO_ROOT, 'apps/storybook/src/stories/primitives');

/**
 * Interactive overlay / nav primitives — every one of these has a keyboard
 * contract a user can get stuck in, so every one owes a `play` function.
 *
 * Deliberately EXCLUDED (no keyboard state machine of their own — their
 * story would assert nothing a static axe pass doesn't already cover):
 *   - `scroll-area` is included: axe's `scrollable-region-focusable` is a
 *     real trap, and the story asserts arrow keys actually scroll.
 *   - `toc` / `breadcrumb` / `pagination` are included: they are plain link
 *     lists, but the traps are real (current page must not be a link; the
 *     ellipsis must not be `aria-hidden` over its own sr-only text).
 */
const KEYBOARD_DRIVEN = [
  // Overlays — focus trap / Escape / focus restore.
  { primitive: 'dialog', story: 'Dialog' },
  { primitive: 'alert-dialog', story: 'AlertDialog' },
  { primitive: 'sheet', story: 'Sheet' },
  { primitive: 'popover', story: 'Popover' },
  { primitive: 'tooltip', story: 'Tooltip' },
  { primitive: 'hover-card', story: 'HoverCard' },
  { primitive: 'dropdown-menu', story: 'DropdownMenu' },
  { primitive: 'context-menu', story: 'ContextMenu' },
  { primitive: 'select', story: 'Select' },
  // A combobox's entire value proposition is the keyboard: type to filter,
  // arrow to highlight, Enter to commit. And the palette is a combobox
  // inside a modal, where a swallowed Escape is a WCAG 2.1.2 trap — see the
  // `inline` note in command-palette.tsx.
  { primitive: 'combobox', story: 'Combobox' },
  { primitive: 'command-palette', story: 'CommandPalette' },
  // Nav / disclosure — roving tabindex, aria-expanded, bypass blocks.
  { primitive: 'tabs', story: 'Tabs' },
  { primitive: 'accordion', story: 'Accordion' },
  { primitive: 'collapsible', story: 'Collapsible' },
  { primitive: 'breadcrumb', story: 'Breadcrumb' },
  { primitive: 'pagination', story: 'Pagination' },
  { primitive: 'toc', story: 'Toc' },
  { primitive: 'skip-link', story: 'SkipLink' },
  { primitive: 'scroll-area', story: 'ScrollArea' },
  // Not an overlay and not nav — but its ENTIRE contract is a focus
  // affordance painted by `:focus-within`, a live pseudo-class no static tree
  // ever enters. axe reports a clean pass on a ring that paints nothing, so a
  // play function is the only thing standing between the DS and an invisible
  // focus indicator. Same requirement, same list.
  { primitive: 'focus-ring', story: 'FocusRing' },
] as const;

/**
 * Overlays whose dismissal must be asserted by name. A dialog you can't
 * Escape out of is a keyboard trap (WCAG 2.1.2), and it is the single most
 * common overlay regression — so the assertion is required, not optional.
 */
const MUST_ASSERT_ESCAPE = new Set([
  'Dialog',
  'AlertDialog',
  'Sheet',
  'Popover',
  'Tooltip',
  'HoverCard',
  'DropdownMenu',
  'ContextMenu',
  'Select',
  'ThemeSwitcher',
  'Combobox',
  'CommandPalette',
]);

const readStory = (name: string) =>
  readFileSync(join(STORIES_DIR, `${name}.stories.tsx`), 'utf-8');

const readPrimitive = (name: string) =>
  readFileSync(join(PRIMITIVES_DIR, `${name}.tsx`), 'utf-8');

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

describe('overlay + nav keyboard contract', () => {
  for (const { primitive, story } of KEYBOARD_DRIVEN) {
    describe(`${primitive} → ${story}.stories.tsx`, () => {
      const source = readStory(story);

      it('ships a `play` function driving the keyboard', () => {
        expect(
          source.includes('play:'),
          `${story}.stories.tsx has no play function. Overlays and nav ` +
            `primitives need a keyboard story — axe cannot press a key.`,
        ).toBe(true);
        expect(source).toContain('userEvent');
      });

      if (MUST_ASSERT_ESCAPE.has(story)) {
        it('asserts Escape dismisses the surface (WCAG 2.1.2 — no trap)', () => {
          expect(
            source.includes('{Escape}'),
            `${story}.stories.tsx never presses Escape. An overlay that ` +
              `can't be dismissed from the keyboard is a keyboard trap.`,
          ).toBe(true);
        });
      }
    });
  }

  it('no overlay/nav primitive gates its focus ring on `focus:` alone', () => {
    // `focus:ring-*` paints the ring on mouse clicks too, which trains
    // reviewers to read "ring present" as "keyboard affordance present".
    // When someone later trims the ring for looking noisy on click, the
    // keyboard affordance goes with it. `focus-visible:` is the contract.
    const offenders: string[] = [];
    for (const { primitive } of KEYBOARD_DRIVEN) {
      const source = stripComments(readPrimitive(primitive));
      // Match `focus:ring…` / `focus:outline…` but NOT `focus-visible:…`
      // and NOT `group-focus:` / `peer-focus:` compound variants.
      const bare = source.match(/(?<![\w-])focus:(?:ring|outline)[\w[\]/.-]*/g);
      if (bare) offenders.push(`  - ${primitive}.tsx: ${[...new Set(bare)].join(', ')}`);
    }
    expect(
      offenders,
      `Use \`focus-visible:\` for focus rings on these parts:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('every primitive in the 1.2 scope has a story file', () => {
    // Cheap cross-check so a rename of either side fails loudly here rather
    // than as a confusing ENOENT inside one of the tests above.
    for (const { primitive, story } of KEYBOARD_DRIVEN) {
      expect(() => readPrimitive(primitive)).not.toThrow();
      expect(() => readStory(story)).not.toThrow();
    }
  });
});
