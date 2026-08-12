/**
 * Primitive API contract lock — the four defects fixed on 2026-08-11.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Each block below pins a promise the component's own header makes about its
 * public API, and each one failed on the source as it stood before this file
 * was written. They are not style checks: a doubled scrim, a `className` that
 * lands on the wrong node, a prop accepted and discarded, and an "anchor" that
 * is really a second trigger are all things a consumer discovers only in their
 * own app.
 *
 * WHY THESE RENDER AT ALL — the portal-overlay exclusion is about COVERAGE
 * -----------------------------------------------------------------------
 * `vitest.config.ts` keeps `sheet` / `popover` / `tooltip` / `accordion` out of
 * the coverage `include` glob, because none of them reaches 100% in jsdom. That
 * is a statement about the ratchet, not about renderability: with the two shims
 * below they mount fine, and nothing here is measured for coverage. Rendering
 * them is what makes these assertions evidence instead of a source grep.
 *
 * THE SHIMS
 * ---------
 * jsdom implements neither `ResizeObserver` (Base UI's floating-ui `autoUpdate`
 * subscribes to it, so every `Positioner` needs it) nor `PointerEvent` (Base UI
 * constructs one on activation). Both are shimmed in-file — same posture as
 * `combobox-command-render.test.tsx` and `data-table.test.tsx`, where a shim the
 * next reader can see beats one hidden in a setup file.
 *
 * WHAT jsdom CANNOT VERIFY HERE
 * -----------------------------
 * Anything painted or measured. That a single scrim is 50% black, that the
 * anchored popover lands beside its anchor, that the panel animation runs —
 * none of that is provable here. Read every assertion as "the tree is wired
 * this way", never as "it looks right".
 */

import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverShim {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver =
    ResizeObserverShim as unknown as typeof ResizeObserver;
}

if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventShim extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  globalThis.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
}

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../src/primitives/accordion.js';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '../src/primitives/popover.js';
import { DialogCompose } from '../src/primitives/dialog.js';
import { SheetCompose } from '../src/primitives/sheet.js';
import { TooltipCompose } from '../src/primitives/tooltip.js';

afterEach(cleanup);

const PRIMITIVES_DIR = resolve(__dirname, '../src/primitives');
const readPrimitive = (name: string) =>
  readFileSync(join(PRIMITIVES_DIR, `${name}.tsx`), 'utf-8');

/**
 * Comments are not code. The header of `tooltip.tsx` now NAMES the old
 * `void delay` bug so the next reader knows what was fixed, and a source match
 * that did not strip comments would read that sentence as the bug itself —
 * the same trap as grepping printed source instead of the tree.
 */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

/* ─────────────────────────────────────────────────────────────────
 * 1. Sheet — one scrim, whichever API you used.
 *
 * `SheetContent` mounts its own `SheetPortal` + `SheetOverlay`, so a
 * `SheetCompose` that also wrapped them stacked two `bg-black/50`
 * backdrops: the page behind a composed sheet came out at 75% black
 * instead of 50%, and the same component had two appearances depending
 * on which entry point the caller reached for.
 * ──────────────────────────────────────────────────────────────── */
describe('Sheet — composed and hand-composed render the same scrim', () => {
  it('SheetCompose mounts exactly one backdrop', async () => {
    render(
      <SheetCompose open trigger={<button type="button">Open</button>} title="Filters">
        <p>body</p>
      </SheetCompose>,
    );

    await screen.findByText('Filters');
    expect(
      document.querySelectorAll('[data-slot="sheet-overlay"]').length,
      'Two stacked bg-black/50 scrims darken the page twice as much as one.',
    ).toBe(1);
  });

  it('SheetCompose mounts exactly one portal', async () => {
    render(
      <SheetCompose open trigger={<button type="button">Open</button>} title="Filters">
        <p>body</p>
      </SheetCompose>,
    );

    await screen.findByText('Filters');
    expect(
      document.querySelectorAll('[data-slot="sheet-portal"]').length,
    ).toBe(1);
  });
});

/* ─────────────────────────────────────────────────────────────────
 * 1b. Dialog — the same defect, verbatim, in the file the DS calls its
 *     "gold-standard reference".
 *
 * Found while fixing Sheet, which is the useful part: a defect that
 * lives in a compose helper is invisible to the compositional API the
 * docs show, so it survives exactly as long as nobody counts the nodes.
 * `alert-dialog.tsx` was checked and is clean.
 * ──────────────────────────────────────────────────────────────── */
describe('Dialog — composed and hand-composed render the same scrim', () => {
  const tree = (
    <DialogCompose open trigger={<button type="button">Open</button>} title="Are you sure?">
      <p>body</p>
    </DialogCompose>
  );

  it('DialogCompose mounts exactly one backdrop', async () => {
    render(tree);
    await screen.findByText('Are you sure?');
    expect(
      document.querySelectorAll('[data-slot="dialog-overlay"]').length,
      'Two stacked bg-black/50 scrims darken the page twice as much as one.',
    ).toBe(1);
  });

  it('DialogCompose mounts exactly one portal', async () => {
    render(tree);
    await screen.findByText('Are you sure?');
    expect(
      document.querySelectorAll('[data-slot="dialog-portal"]').length,
    ).toBe(1);
  });
});

/* ─────────────────────────────────────────────────────────────────
 * 2. Accordion — `className` reaches the animated box, and every part
 *    carries a `data-slot` (R6).
 *
 * The caller's `className` used to land on the inner padding `div`, so
 * the `Panel` — which owns `overflow-hidden` and the open/close
 * animation — was unreachable from a call site.
 * ──────────────────────────────────────────────────────────────── */
describe('Accordion — className target and data-slot coverage', () => {
  const tree = (
    <Accordion defaultValue={['a']}>
      <AccordionItem value="a">
        <AccordionTrigger>Heading</AccordionTrigger>
        <AccordionContent className="max-h-40">Panel body</AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  it('forwards className to the Panel, not to the inner padding div', () => {
    render(tree);
    const panel = document.querySelector('[data-slot="accordion-content"]');
    expect(panel).not.toBeNull();
    expect(
      panel!.className,
      'className must reach the animated/overflow box, which is the Panel.',
    ).toContain('max-h-40');
    // The animation + overflow classes the Panel owns must survive the merge.
    expect(panel!.className).toContain('overflow-hidden');
  });

  it('keeps the padding div as a distinct, addressable node', () => {
    render(tree);
    const panel = document.querySelector('[data-slot="accordion-content"]')!;
    const inner = panel.querySelector('[data-slot="accordion-content-inner"]');
    expect(inner, 'R6 — every part carries a data-slot.').not.toBeNull();
    expect(inner!.className).toContain('pb-4');
    expect(inner!.className).not.toContain('max-h-40');
  });

  it('labels the Accordion.Header wrapper (R6)', () => {
    render(tree);
    const header = document.querySelector('[data-slot="accordion-header"]');
    expect(header, 'R6 — every part carries a data-slot.').not.toBeNull();
    expect(
      header!.querySelector('[data-slot="accordion-trigger"]'),
    ).not.toBeNull();
  });
});

/* ─────────────────────────────────────────────────────────────────
 * 3. Tooltip — `delay` is wired, not swallowed.
 *
 * `TooltipCompose` used to accept `delay` and discard it (`void delay`),
 * because `Tooltip.Root` has no `delay` prop — it lives on
 * `Tooltip.Provider`, which this file mounts internally. The fix routes
 * the prop to the provider it already owns.
 *
 * The positive control is load-bearing: without it, "no tooltip appeared"
 * would pass just as happily if hover did nothing at all in jsdom.
 * ──────────────────────────────────────────────────────────────── */
describe('Tooltip — the delay prop reaches the provider', () => {
  it('opens on hover when delay is 0 (positive control)', async () => {
    const user = userEvent.setup();
    render(
      <TooltipCompose
        delay={0}
        trigger={<button type="button">Search</button>}
        label="Search (Cmd-K)"
      />,
    );

    await user.hover(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toBeTruthy(),
    );
  });

  it('does NOT open on hover while a long delay is still pending', async () => {
    const user = userEvent.setup();
    render(
      <TooltipCompose
        delay={100_000}
        trigger={<button type="button">Search</button>}
        label="Search (Cmd-K)"
      />,
    );

    await user.hover(screen.getByRole('button', { name: 'Search' }));
    // Give the provider every chance to open on the default (0ms) timing.
    await new Promise((r) => setTimeout(r, 60));
    expect(
      screen.queryByRole('tooltip'),
      'A `delay` the component accepts and ignores is worse than no prop.',
    ).toBeNull();
  });

  it('no longer discards the prop in source', () => {
    // Belt and braces: `void delay` is the exact shape of the old bug, and a
    // future refactor could reintroduce it without failing the timing test if
    // jsdom timing ever goes flaky.
    expect(stripComments(readPrimitive('tooltip'))).not.toMatch(
      /\bvoid\s+delay\b/,
    );
    expect(stripComments(readPrimitive('tooltip'))).toMatch(
      /<Tooltip\s+delay=\{delay\}/,
    );
  });
});

/* ─────────────────────────────────────────────────────────────────
 * 4. Popover — the anchor is an anchor, not a second trigger.
 *
 * `PopoverAnchor` used to render a second `Popover.Trigger` under a
 * different `data-slot`, so anchoring a panel to one element while
 * triggering it from another gave the user two buttons that both opened
 * it. Base UI 1.6 ships no `Popover.Anchor` part; the real seam is the
 * `anchor` prop on `Popover.Positioner`, which is what this now uses.
 * ──────────────────────────────────────────────────────────────── */
describe('Popover — PopoverAnchor is not a trigger', () => {
  const tree = (extra?: { open?: boolean }) => (
    <Popover {...extra}>
      <PopoverAnchor />
      <PopoverTrigger render={<button type="button">Open</button>} />
      <PopoverContent>panel</PopoverContent>
    </Popover>
  );

  it('renders a non-interactive element, not a button', () => {
    render(tree({ open: true }));
    const anchor = document.querySelector('[data-slot="popover-anchor"]');
    expect(anchor).not.toBeNull();
    expect(anchor!.tagName).not.toBe('BUTTON');
    expect(
      anchor!.hasAttribute('aria-expanded'),
      'An anchor that carries trigger ARIA is a second trigger.',
    ).toBe(false);
  });

  it('leaves exactly one element advertising the popup to AT', () => {
    render(tree({ open: true }));
    expect(
      document.querySelectorAll('[aria-haspopup]').length,
    ).toBe(1);
  });

  it('does not open the popover when clicked', async () => {
    const user = userEvent.setup();
    render(tree());
    await user.click(document.querySelector('[data-slot="popover-anchor"]')!);
    await new Promise((r) => setTimeout(r, 30));
    expect(
      document.querySelector('[data-slot="popover-content"]'),
      'Clicking the anchor opened the panel — it is still a trigger.',
    ).toBeNull();
  });
});

/* ─────────────────────────────────────────────────────────────────
 * 5. The RSC boundary of the layout primitives.
 *
 * REGRESSION GUARD, NOT EVIDENCE OF A FIX — nothing was changed for it.
 * A doc pass read `container.tsx` / `stack.tsx` calling `useRender`
 * without `'use client'` as a defect. It is not: Base UI's
 * `use-render` module ships no `'use client'` of its own, and
 * `useRenderElement` guards its only hook behind
 * `typeof document !== 'undefined'` (its comment: "skips the
 * `useMergedRefs` call on the server"). DESIGN_PRINCIPLES #11 names
 * these files as deliberately zero-hook and RSC-safe, and the registry
 * publishes them with `client: false`.
 *
 * So the lock runs the other way: adding `'use client'` to a layout
 * primitive forces a client boundary on every consumer of it, and that
 * is the regression worth catching.
 * ──────────────────────────────────────────────────────────────── */
describe('layout primitives stay RSC-safe (DESIGN_PRINCIPLES #11)', () => {
  it.each(['container', 'stack', 'box', 'grid', 'typography', 'section'])(
    '%s.tsx declares no client boundary',
    (name) => {
      const firstStatement = readPrimitive(name)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .trim();
      expect(
        firstStatement.startsWith("'use client'") ||
          firstStatement.startsWith('"use client"'),
        `${name}.tsx is a layout primitive — a 'use client' here forces a ` +
          `client boundary on every server tree that lays out with it.`,
      ).toBe(false);
    },
  );

  it("Base UI's useRender is server-safe, which is why the above holds", () => {
    const impl = readFileSync(
      resolve(
        __dirname,
        '../../../node_modules/@base-ui/react/internals/useRenderElement.js',
      ),
      'utf-8',
    );
    // If a Base UI upgrade ever calls the hook unconditionally, the premise
    // above is gone and the layout primitives really do need the directive.
    expect(impl).toContain("typeof document !== 'undefined'");
  });
});
