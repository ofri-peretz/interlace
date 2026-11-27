'use client';

/**
 * @interlace/ui — Prose
 *
 * The article-body wrapper. Renders an `<article>` whose descendants
 * (`h1`–`h6`, `p`, `a`, `ul`/`ol`/`li`, `blockquote`, `figure`/`figcaption`, `code`/`pre`, `table`,
 * `img`) get DS-token-mapped typography without per-element class
 * gymnastics in the consumer. Think MDX-target wrapper: drop a stream of
 * Markdown / MDX inside and it reads like a published article — measure
 * bounded, GFM tables ruled like an editorial table, headings deep-link-anchorable.
 *
 * The descendant cascade lives on the wrapper itself via Tailwind
 * arbitrary-variant utilities (`[&_h1]:…`) so the whole contract is
 * auditable from one cva base and every value still resolves to a DS token
 * (R19). A stable `prose-interlace` className is also applied as an
 * external hook for consumer overrides (e.g. fumadocs MDX plugins).
 *
 * `variant="long"` switches the body to `--text-long` (17px / 1.7) for
 * extended reading per TYPOGRAPHY_PHILOSOPHY (Reading mode vs UI mode).
 * `width="fill"` drops the 65ch cap for prose inside a card or panel.
 * Headings use `font-heading`, like Typography, so one token restyles both.
 *
 * ## Anatomy
 *
 *   <article data-slot="prose" data-min-viewport="320" class="prose-interlace …">
 *     <h1>…</h1>
 *     <p>…</p>
 *     <ul><li>…</li></ul>
 *     <pre><code>…</code></pre>
 *     <table><thead/><tbody/></table>
 *   </article>
 *
 * The `as` prop accepts `'article' | 'div' | 'main' | 'section'` so the
 * wrapper can be the document root (`main`), a section in a wider
 * layout (`section`), or a non-landmark container (`div`).
 *
 * ## MIN_VIEWPORT — 320
 *
 * Long-form reading is one of the failure modes that MUST work on the
 * narrowest phone. Headings and measure all collapse cleanly at 320 CSS-px.
 * A table with a header row stacks into one card per row below the `sm`
 * breakpoint; any other table gets `overflow-x: auto`
 * (`[&_table]:block [&_table]:overflow-x-auto`) and scrolls sideways
 * instead of breaking the page.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el + VariantProps | `React.ComponentProps<'article'> & VariantProps<...>`       |
 * | R6   | data-slot on root                | `data-slot="prose"` + data-variant                          |
 * | R7   | className merged + ...rest + ref | `cn(proseVariants(...), 'prose-interlace', className)`      |
 * | R8   | No `isXxx`; enum for variants    | `variant` (`default` / `long`), `width` (`measure` / `fill`) |
 * | R10  | Composition seam (`as` prop)     | `as` accepts `article` / `div` / `main` / `section`         |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; cva + arbitrary-variant utilities      |
 * | R19  | Tokens only                      | `--text-*`, `--spacing-*`, `--container-prose`, semantic colors |
 * | R20  | AA contrast                      | `text-foreground` / `text-muted-foreground` clear AA in light + dark |
 * | R25  | Client component                 | useLayoutEffect makes an overflowing `<pre>`/`<table>` focusable and named, and undoes it when it fits |
 * | R26  | A11y from native el              | semantic elements (`article`, `h*`, `a`, `table`) own the a11y tree |
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';

/**
 * Minimum viable viewport (CSS px) for this primitive. Below it, the
 * preflight contract draws a dev-mode outline; in prod the component still
 * renders. Exported so consumers / tests can read it.
 */
export const MIN_VIEWPORT = 320 as const;

/**
 * Element seam — keep the set closed (`article` default + the three
 * landmark-or-neutral alternatives). Anything else (a `<span>`, a `<button>`)
 * would be a semantic mistake for an article-body wrapper.
 */
type ProseElement = 'article' | 'div' | 'main' | 'section';

/**
 * Descendant cascade. Every selector resolves to a DS token (R19): heading
 * sizes from `--text-h*`, weights from the 400/500/600/700 ladder, spacing
 * from `--spacing-*`, colors from semantic tokens. Headings carry
 * `scroll-margin-top` (xl ≈ 64px) so deep-link anchors clear a sticky
 * header instead of hiding under it. GFM tables read as editorial tables
 * (rules between rows, no cell grid), and on a phone a table whose cells
 * carry `data-label` stacks into one card per row.
 */
const PROSE_CASCADE = [
  // Headings — type scale + scroll-margin for deep-link anchors.
  '[&_h1]:font-heading [&_h1]:text-h1 [&_h1]:font-bold [&_h1]:tracking-display [&_h1]:text-balance [&_h1]:scroll-mt-16 [&_h1]:mt-16 [&_h1]:mb-6',
  '[&_h2]:font-heading [&_h2]:text-h2 [&_h2]:font-bold [&_h2]:tracking-heading [&_h2]:text-balance [&_h2]:scroll-mt-16 [&_h2]:mt-10 [&_h2]:mb-4',
  '[&_h3]:font-heading [&_h3]:text-h3 [&_h3]:font-semibold [&_h3]:tracking-heading [&_h3]:scroll-mt-16 [&_h3]:mt-10 [&_h3]:mb-4',
  '[&_h4]:font-heading [&_h4]:text-h4 [&_h4]:font-semibold [&_h4]:scroll-mt-16 [&_h4]:mt-6 [&_h4]:mb-2',
  '[&_h5]:font-heading [&_h5]:text-h5 [&_h5]:font-semibold [&_h5]:scroll-mt-16 [&_h5]:mt-6 [&_h5]:mb-2',
  '[&_h6]:font-heading [&_h6]:text-h6 [&_h6]:font-semibold [&_h6]:scroll-mt-16 [&_h6]:mt-6 [&_h6]:mb-2',

  // Paragraph rhythm.
  '[&_p]:my-4',

  // Links — primary color, underline-offset for legibility, focus-ring contract.
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-from-font',
  '[&_a:hover]:text-primary [&_a:hover]:opacity-90',
  '[&_a:focus-visible]:outline-hidden [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-ring [&_a:focus-visible]:ring-offset-2 [&_a:focus-visible]:rounded-sm',

  // Lists.
  '[&_ul]:my-4 [&_ul]:ps-6 [&_ul]:list-disc',
  '[&_ol]:my-4 [&_ol]:ps-6 [&_ol]:list-decimal',
  '[&_li]:my-2 [&_li]:ps-2',

  // Blockquote — quiet left rule with muted body.
  '[&_blockquote]:my-6 [&_blockquote]:border-s-4 [&_blockquote]:border-border [&_blockquote]:ps-6 [&_blockquote]:text-muted-foreground [&_blockquote]:italic',

  // Figure — a quote with who said it. The caption sits under the quote,
  // indented to the quote's text (the 4px rule plus ps-6), small and muted, so
  // the words lead and the attribution follows instead of outweighing them.
  // Only a bare figure: a component's own (Figure, a chart, Testimonial)
  // carries a data-slot and keeps its caption.
  '[&_figure:not([data-slot])]:my-6 [&_figure:not([data-slot])>blockquote]:my-0',
  '[&_figure:not([data-slot])>figcaption]:mt-2 [&_figure:not([data-slot])>figcaption]:ps-7 [&_figure:not([data-slot])>figcaption]:text-ui-sm [&_figure:not([data-slot])>figcaption]:text-muted-foreground',

  // Inline code — chip pill on muted surface. The vertical padding is the
  // one arbitrary value in this chain and stays arbitrary on purpose: an
  // inline chip has to grow with the text it sits inside, so the value is
  // `em`-relative. Every --spacing-* token is `rem`, which would freeze the
  // chip's height while the surrounding line scales (R19 exception).
  '[&_code]:font-mono [&_code]:text-code [&_code]:bg-muted [&_code]:text-foreground [&_code]:rounded-sm [&_code]:px-2 [&_code]:py-[0.125em]',
  // Code inside pre — clear the chip styles so the block code renders cleanly.
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none',

  // Pre — block code surface with horizontal overflow on narrow viewports.
  // Pairs with the focus-visible ring contract: Prose adds `tabIndex={0}`
  // itself when a block overflows (the sync effect in Prose), so the ring
  // shows on keyboard focus.
  '[&_pre]:my-6 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-6 [&_pre]:overflow-x-auto [&_pre]:font-mono [&_pre]:text-code [&_pre:focus-visible]:outline-hidden [&_pre:focus-visible]:ring-2 [&_pre:focus-visible]:ring-ring [&_pre:focus-visible]:ring-offset-2',

  // Tables — an editorial table, not a spreadsheet grid: no cell boxes, no
  // zebra fill, a firm rule under the header and a hairline between rows,
  // so the eye runs along the row. Body cells keep the reading size (a table
  // in an article is read, not scanned like a dashboard); headers are the
  // quieter UI size. Figures line up (tabular-nums), and a GFM column
  // alignment (`align` on th/td) is honoured. Block + overflow-x keeps a wide
  // table inside the column (R14), with the same keyboard-focus contract as
  // <pre>.
  '[&_table]:my-8 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:tabular-nums [&_table:focus-visible]:outline-hidden [&_table:focus-visible]:ring-2 [&_table:focus-visible]:ring-ring [&_table:focus-visible]:ring-offset-2',
  '[&_caption]:mb-3 [&_caption]:text-start [&_caption]:text-ui [&_caption]:text-muted-foreground',
  '[&_th]:border-b-2 [&_th]:border-foreground [&_th]:px-3 [&_th]:pt-0 [&_th]:pb-2 [&_th]:align-bottom [&_th]:text-ui [&_th]:font-semibold [&_th]:text-muted-foreground [&_th:not([align])]:text-start',
  '[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-4 [&_td]:align-top',
  '[&_:is(th,td):first-child]:ps-0 [&_:is(th,td):last-child]:pe-0',
  // The first cell names the row, so it carries the weight a row header would.
  '[&_tbody_td:first-child]:font-medium',

  // Status in a cell — `<span data-status="success|warning|info|destructive|neutral">`
  // reads as a quiet pill with a coloured dot. The word carries the meaning;
  // the dot only repeats it, so colour is never the only signal (WCAG 1.4.1).
  '[&_[data-status]]:inline-flex [&_[data-status]]:items-center [&_[data-status]]:gap-2 [&_[data-status]]:whitespace-nowrap [&_[data-status]]:rounded-full [&_[data-status]]:border [&_[data-status]]:border-border [&_[data-status]]:bg-background [&_[data-status]]:px-3 [&_[data-status]]:text-ui [&_[data-status]]:font-medium [&_[data-status]]:text-foreground',
  '[&_[data-status]]:before:size-2 [&_[data-status]]:before:shrink-0 [&_[data-status]]:before:rounded-full [&_[data-status]]:before:bg-muted-foreground [&_[data-status]]:before:content-[""]',
  // Two attribute selectors, so a tone outranks the neutral dot above.
  '[&_[data-status][data-status=success]]:before:bg-success [&_[data-status][data-status=warning]]:before:bg-warning [&_[data-status][data-status=info]]:before:bg-info [&_[data-status][data-status=destructive]]:before:bg-destructive',

  // Narrow screens — a table whose cells carry `data-label` (Prose adds it
  // from the header row; server-rendered markup can ship it to skip a
  // flash) stacks into one card per row: the first cell is the card's
  // title, every other cell shows its column name above its value, and an
  // empty cell drops out. Nothing scrolls sideways on a phone. The roles
  // Prose sets keep the table semantics a screen reader would otherwise
  // lose when the cells stop being table cells.
  'max-sm:[&_table:has(td[data-label])]:overflow-visible',
  'max-sm:[&_table:has(td[data-label])_thead]:sr-only',
  'max-sm:[&_table:has(td[data-label])_:is(tbody,tr,td)]:block',
  'max-sm:[&_tr:has(>td[data-label])]:border-b max-sm:[&_tr:has(>td[data-label])]:border-border max-sm:[&_tr:has(>td[data-label])]:py-4',
  'max-sm:[&_td[data-label]]:border-0 max-sm:[&_td[data-label]]:px-0 max-sm:[&_td[data-label]]:py-1',
  'max-sm:[&_td[data-label]:not(:first-child)]:before:block max-sm:[&_td[data-label]:not(:first-child)]:before:text-ui max-sm:[&_td[data-label]:not(:first-child)]:before:font-semibold max-sm:[&_td[data-label]:not(:first-child)]:before:text-muted-foreground max-sm:[&_td[data-label]:not(:first-child)]:before:content-[attr(data-label)]',
  'max-sm:[&_td[data-label]:first-child]:pb-2 max-sm:[&_td[data-label]:first-child]:font-heading max-sm:[&_td[data-label]:first-child]:text-h5 max-sm:[&_td[data-label]:first-child]:font-semibold',
  'max-sm:[&_td[data-label]:empty]:hidden',

  // Images — block layout + bounded radius + measure-respecting width.
  '[&_img]:my-6 [&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg',
].join(' ');

const proseVariants = cva(
  // Base — bound measure to --container-prose (65ch) so every body container
  // clears the "≤75ch" non-negotiable from TYPOGRAPHY_PHILOSOPHY. Token
  // foreground keeps AA in light + dark.
  ['text-foreground', PROSE_CASCADE].join(' '),
  {
    variants: {
      /**
       * Reading mode. `default` uses the body type contract (16px / 1.6);
       * `long` switches to the long-form contract (17px / 1.7) for extended
       * articles per TYPOGRAPHY_PHILOSOPHY "Reading mode vs UI mode".
       */
      variant: {
        default: 'text-body leading-body',
        long: 'text-long leading-long',
      },
      /**
       * Line length. `measure` caps lines at --container-prose (65ch), the
       * reading measure for a page column. `fill` takes the width of the
       * parent, for prose inside a card, panel or table cell whose own width
       * already sets a readable measure.
       */
      width: {
        measure: 'max-w-(--container-prose)',
        fill: 'max-w-none',
      },
    },
    defaultVariants: {
      variant: 'default',
      width: 'measure',
    },
  },
);

/** Names Prose gives a `<pre>` or `<table>` it makes focusable because it scrolls sideways. */
interface ProseLabels {
  /** Name for an overflowing `<table>` with no caption. */
  table: string;
  /** Name for an overflowing `<pre>`. */
  code: string;
}

const DEFAULT_PROSE_LABELS: ProseLabels = {
  table: 'Table, scrolls sideways',
  code: 'Code, scrolls sideways',
};

interface ProseProps
  extends React.ComponentProps<'article'>, VariantProps<typeof proseVariants> {
  /**
   * Override the rendered element. Defaults to `article` — the natural
   * semantic for an article-body wrapper. Use `main` when this is the page's
   * primary landmark, `section` inside a larger landmark, or `div` when the
   * surrounding container already owns the landmark.
   */
  as?: ProseElement;
  /** The names given to blocks that scroll sideways, for another language. */
  labels?: Partial<ProseLabels>;
}

/**
 * Make one `<pre>` or `<table>` focusable and named while it scrolls sideways,
 * and take back what we added once it fits. Author attributes always win.
 */
function syncScrollRegion(el: HTMLElement, label: string) {
  const ours = el.hasAttribute('data-prose-scroll');
  if (!ours && el.hasAttribute('tabindex')) return;
  const scrolls = el.scrollWidth > el.clientWidth + 1;
  if (scrolls && !ours) claimScrollRegion(el, label);
  else if (
    scrolls &&
    el.hasAttribute('data-prose-label') &&
    el.getAttribute('aria-label') !== label
  ) {
    // Labels changed (a language switch): keep our name current.
    el.setAttribute('aria-label', label);
  } else if (!scrolls && ours) releaseScrollRegion(el);
}

function claimScrollRegion(el: HTMLElement, label: string) {
  el.setAttribute('data-prose-scroll', '');
  el.setAttribute('tabindex', '0');
  const isTable = el.tagName === 'TABLE';
  if (!isTable && !el.hasAttribute('role')) {
    el.setAttribute('role', 'region');
    el.setAttribute('data-prose-role', '');
  }
  const named =
    el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
  if (!named && !(isTable && el.querySelector('caption'))) {
    el.setAttribute('aria-label', label);
    el.setAttribute('data-prose-label', '');
  }
}

function releaseScrollRegion(el: HTMLElement) {
  el.removeAttribute('data-prose-scroll');
  el.removeAttribute('tabindex');
  for (const [marker, attr] of [
    ['data-prose-role', 'role'],
    ['data-prose-label', 'aria-label'],
  ] as const) {
    if (el.hasAttribute(marker)) {
      el.removeAttribute(attr);
      el.removeAttribute(marker);
    }
  }
}

/** The ARIA role each part of a table keeps once a narrow screen stacks it. */
const TABLE_ROLES: Record<string, string> = {
  TABLE: 'table',
  THEAD: 'rowgroup',
  TBODY: 'rowgroup',
  TR: 'row',
  TH: 'columnheader',
  TD: 'cell',
};

/**
 * Give every body cell of a simple table its column name (`data-label`), so
 * the narrow-screen cascade can stack the rows into cards, and pin the table
 * roles, which some screen readers drop once a cell is no longer
 * `display: table-cell`. Labels the author already wrote are kept; a table
 * with merged cells or no header row is left as it is.
 */
function labelTableCells(table: HTMLTableElement) {
  const merged = Array.from(
    table.querySelectorAll<HTMLTableCellElement>('th, td'),
  ).some((cell) => cell.colSpan > 1 || cell.rowSpan > 1);
  if (merged) return;
  const headRow = table.tHead?.rows[0];
  if (!headRow) return;
  if (!table.querySelector('td[data-label]')) {
    const names = Array.from(headRow.cells, (c) => c.textContent?.trim() ?? '');
    for (const body of Array.from(table.tBodies)) {
      for (const row of Array.from(body.rows)) {
        Array.from(row.cells).forEach((cell, i) => {
          if (cell.tagName === 'TD' && names[i])
            cell.setAttribute('data-label', names[i]);
        });
      }
    }
  }
  for (const el of [
    table,
    ...table.querySelectorAll<HTMLElement>('thead, tbody, tr, th, td'),
  ]) {
    const role = TABLE_ROLES[el.tagName];
    if (role && !el.hasAttribute('role')) el.setAttribute('role', role);
  }
}

/**
 * Typographic article-body wrapper. Client component: a layout effect makes
 * blocks that scroll sideways reachable by keyboard.
 *
 * Drop any combination of `h1`–`h6`, `p`, `a`, `ul`/`ol`, `blockquote`,
 * `code`/`pre`, `table`, `img` inside; the cascade styles them with DS
 * tokens. The wrapper itself is just an `<article>` (or your `as` override)
 * with the measure bounded.
 */
const Prose = React.forwardRef<HTMLElement, ProseProps>(
  ({ className, variant, width, as, labels, children, ...props }, ref) => {
    const Tag = (as ?? 'article') as React.ElementType;
    const localRef = React.useRef<HTMLElement | null>(null);
    const tableLabel = labels?.table ?? DEFAULT_PROSE_LABELS.table;
    const codeLabel = labels?.code ?? DEFAULT_PROSE_LABELS.code;

    /**
     * axe `scrollable-region-focusable`: a `<pre>` or `<table>` that actually
     * scrolls sideways must be reachable by keyboard, or a keyboard user can
     * never read its right edge. One that fits is left alone, so it is not a
     * stray tab stop. The check re-runs when the wrapper resizes (a rotated
     * phone, a bigger text size) and when children change.
     *
     * A region we make focusable also needs a name, or a screen reader
     * announces an unnamed stop. A table is named by its `<caption>`; without
     * one, or on a `<pre>`, we add a short label (`labels`, English by
     * default). Anything the author set
     * (`tabindex`, `aria-label`, `aria-labelledby`, `role`) wins and is never
     * touched. What we add is marked `data-prose-scroll` so we can take it
     * back when the element stops overflowing.
     *
     * useLayoutEffect runs before paint, so the attributes are in place before
     * the test-runner's axe scan inspects the DOM.
     */
    React.useLayoutEffect(() => {
      const root = localRef.current;
      if (!root) return;
      for (const table of root.querySelectorAll('table'))
        labelTableCells(table);
      const sync = () => {
        for (const el of root.querySelectorAll<HTMLElement>('pre, table')) {
          syncScrollRegion(el, el.tagName === 'TABLE' ? tableLabel : codeLabel);
        }
      };
      sync();
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(sync);
      ro.observe(root);
      return () => ro.disconnect();
    }, [children, tableLabel, codeLabel]);

    const setRef = React.useCallback(
      (node: HTMLElement | null) => {
        localRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref)
          (ref as React.MutableRefObject<HTMLElement | null>).current = node;
      },
      [ref],
    );

    return (
      <Tag
        ref={setRef}
        data-slot="prose"
        data-min-viewport={String(MIN_VIEWPORT)}
        data-variant={variant ?? undefined}
        data-width={width ?? undefined}
        className={cn(
          proseVariants({ variant, width }),
          'prose-interlace',
          className,
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  },
);
Prose.displayName = 'Prose';

export { Prose, proseVariants };
export type { ProseLabels, ProseProps };
