'use client';

/**
 * @interlace/ui — Prose
 *
 * The article-body wrapper. Renders an `<article>` whose descendants
 * (`h1`–`h6`, `p`, `a`, `ul`/`ol`/`li`, `blockquote`, `code`/`pre`, `table`,
 * `img`) get DS-token-mapped typography without per-element class
 * gymnastics in the consumer. Think MDX-target wrapper: drop a stream of
 * Markdown / MDX inside and it reads like a published article — measure
 * bounded, GFM tables zebra-striped, headings deep-link-anchorable.
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
 * narrowest phone. Headings and measure all collapse cleanly at 320 CSS-px;
 * tables get `overflow-x: auto` (`[&_table]:block [&_table]:overflow-x-auto`)
 * so wide GFM tables scroll horizontally instead of breaking the page.
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
 * header instead of hiding under it. GFM tables zebra-stripe via
 * `[&_tbody_tr:nth-child(even)]:bg-muted/40` and scroll horizontally on
 * narrow viewports.
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
  '[&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-ring [&_a:focus-visible]:ring-offset-2 [&_a:focus-visible]:rounded-sm',

  // Lists.
  '[&_ul]:my-4 [&_ul]:ps-6 [&_ul]:list-disc',
  '[&_ol]:my-4 [&_ol]:ps-6 [&_ol]:list-decimal',
  '[&_li]:my-2 [&_li]:ps-2',

  // Blockquote — quiet left rule with muted body.
  '[&_blockquote]:my-6 [&_blockquote]:border-s-4 [&_blockquote]:border-border [&_blockquote]:ps-6 [&_blockquote]:text-muted-foreground [&_blockquote]:italic',

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
  '[&_pre]:my-6 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-6 [&_pre]:overflow-x-auto [&_pre]:font-mono [&_pre]:text-code [&_pre:focus-visible]:outline-none [&_pre:focus-visible]:ring-2 [&_pre:focus-visible]:ring-ring [&_pre:focus-visible]:ring-offset-2',

  // Tables — GFM zebra rows; block + overflow-x for narrow viewports (R14).
  // Same keyboard-focus contract as <pre>.
  '[&_table]:my-6 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-ui [&_table:focus-visible]:outline-none [&_table:focus-visible]:ring-2 [&_table:focus-visible]:ring-ring [&_table:focus-visible]:ring-offset-2',
  '[&_thead]:bg-muted',
  '[&_th]:border [&_th]:border-border [&_th]:px-4 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-start',
  '[&_td]:border [&_td]:border-border [&_td]:px-4 [&_td]:py-2',
  '[&_tbody_tr:nth-child(even)]:bg-muted/40',

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

interface ProseProps
  extends React.ComponentProps<'article'>,
    VariantProps<typeof proseVariants> {
  /**
   * Override the rendered element. Defaults to `article` — the natural
   * semantic for an article-body wrapper. Use `main` when this is the page's
   * primary landmark, `section` inside a larger landmark, or `div` when the
   * surrounding container already owns the landmark.
   */
  as?: ProseElement;
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
  ({ className, variant, width, as, children, ...props }, ref) => {
    const Tag = (as ?? 'article') as React.ElementType;
    const localRef = React.useRef<HTMLElement | null>(null);

    /**
     * axe `scrollable-region-focusable`: a `<pre>` or `<table>` that actually
     * scrolls sideways must be reachable by keyboard, or a keyboard user can
     * never read its right edge. One that fits is left alone, so it is not a
     * stray tab stop. The check re-runs when the wrapper resizes (a rotated
     * phone, a bigger text size) and when children change.
     *
     * A region we make focusable also needs a name, or a screen reader
     * announces an unnamed stop. A table is named by its `<caption>`; without
     * one, or on a `<pre>`, we add a short label. Anything the author set
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
      const sync = () => {
        for (const el of root.querySelectorAll<HTMLElement>('pre, table')) {
          const ours = el.hasAttribute('data-prose-scroll');
          if (!ours && el.hasAttribute('tabindex')) continue;
          const scrolls = el.scrollWidth > el.clientWidth + 1;
          if (scrolls && !ours) {
            el.setAttribute('data-prose-scroll', '');
            el.setAttribute('tabindex', '0');
            const named = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
            const isTable = el.tagName === 'TABLE';
            if (!isTable && !el.hasAttribute('role')) {
              el.setAttribute('role', 'region');
              el.setAttribute('data-prose-role', '');
            }
            if (!named && !(isTable && el.querySelector('caption'))) {
              el.setAttribute('aria-label', isTable ? 'Table, scrolls sideways' : 'Code, scrolls sideways');
              el.setAttribute('data-prose-label', '');
            }
          } else if (!scrolls && ours) {
            el.removeAttribute('data-prose-scroll');
            el.removeAttribute('tabindex');
            if (el.hasAttribute('data-prose-role')) {
              el.removeAttribute('role');
              el.removeAttribute('data-prose-role');
            }
            if (el.hasAttribute('data-prose-label')) {
              el.removeAttribute('aria-label');
              el.removeAttribute('data-prose-label');
            }
          }
        }
      };
      sync();
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(sync);
      ro.observe(root);
      return () => ro.disconnect();
    }, [children]);

    const setRef = React.useCallback(
      (node: HTMLElement | null) => {
        localRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
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
        className={cn(proseVariants({ variant, width }), 'prose-interlace', className)}
        {...props}
      >
        {children}
      </Tag>
    );
  },
);
Prose.displayName = 'Prose';

export { Prose, proseVariants };
export type { ProseProps };
