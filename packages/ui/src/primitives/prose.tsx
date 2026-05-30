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
 * | R8   | No `isXxx`; enum for variants    | `variant` is an enum (`default` / `long`)                   |
 * | R10  | Composition seam (`as` prop)     | `as` accepts `article` / `div` / `main` / `section`         |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; cva + arbitrary-variant utilities      |
 * | R19  | Tokens only                      | `--text-*`, `--spacing-*`, `--container-prose`, semantic colors |
 * | R20  | AA contrast                      | `text-foreground` / `text-muted-foreground` clear AA in light + dark |
 * | R25  | Server component                 | no hooks → no `'use client'`                                |
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
  '[&_h1]:font-body [&_h1]:text-h1 [&_h1]:font-bold [&_h1]:tracking-display [&_h1]:text-balance [&_h1]:scroll-mt-xl [&_h1]:mt-xl [&_h1]:mb-md',
  '[&_h2]:font-body [&_h2]:text-h2 [&_h2]:font-bold [&_h2]:tracking-heading [&_h2]:text-balance [&_h2]:scroll-mt-xl [&_h2]:mt-lg [&_h2]:mb-sm',
  '[&_h3]:font-body [&_h3]:text-h3 [&_h3]:font-semibold [&_h3]:tracking-heading [&_h3]:scroll-mt-xl [&_h3]:mt-lg [&_h3]:mb-sm',
  '[&_h4]:font-body [&_h4]:text-h4 [&_h4]:font-semibold [&_h4]:scroll-mt-xl [&_h4]:mt-md [&_h4]:mb-xs',
  '[&_h5]:font-body [&_h5]:text-h5 [&_h5]:font-semibold [&_h5]:scroll-mt-xl [&_h5]:mt-md [&_h5]:mb-xs',
  '[&_h6]:font-body [&_h6]:text-h6 [&_h6]:font-semibold [&_h6]:scroll-mt-xl [&_h6]:mt-md [&_h6]:mb-xs',

  // Paragraph rhythm.
  '[&_p]:my-sm',

  // Links — primary color, underline-offset for legibility, focus-ring contract.
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-from-font',
  '[&_a:hover]:text-primary [&_a:hover]:opacity-90',
  '[&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-ring [&_a:focus-visible]:ring-offset-2 [&_a:focus-visible]:rounded-sm',

  // Lists.
  '[&_ul]:my-sm [&_ul]:pl-md [&_ul]:list-disc',
  '[&_ol]:my-sm [&_ol]:pl-md [&_ol]:list-decimal',
  '[&_li]:my-xs [&_li]:pl-xs',

  // Blockquote — quiet left rule with muted body.
  '[&_blockquote]:my-md [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-md [&_blockquote]:text-muted-foreground [&_blockquote]:italic',

  // Inline code — chip pill on muted surface.
  '[&_code]:font-mono [&_code]:text-code [&_code]:bg-muted [&_code]:text-foreground [&_code]:rounded-sm [&_code]:px-xs [&_code]:py-[0.125em]',
  // Code inside pre — clear the chip styles so the block code renders cleanly.
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none',

  // Pre — block code surface with horizontal overflow on narrow viewports.
  '[&_pre]:my-md [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-md [&_pre]:overflow-x-auto [&_pre]:font-mono [&_pre]:text-code',

  // Tables — GFM zebra rows; block + overflow-x for narrow viewports (R14).
  '[&_table]:my-md [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-ui',
  '[&_thead]:bg-muted',
  '[&_th]:border [&_th]:border-border [&_th]:px-sm [&_th]:py-xs [&_th]:font-semibold [&_th]:text-left',
  '[&_td]:border [&_td]:border-border [&_td]:px-sm [&_td]:py-xs',
  '[&_tbody_tr:nth-child(even)]:bg-muted/40',

  // Images — block layout + bounded radius + measure-respecting width.
  '[&_img]:my-md [&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md',
].join(' ');

const proseVariants = cva(
  // Base — bound measure to --container-prose (65ch) so every body container
  // clears the "≤75ch" non-negotiable from TYPOGRAPHY_PHILOSOPHY. Token
  // foreground keeps AA in light + dark.
  ['max-w-(--container-prose) text-foreground', PROSE_CASCADE].join(' '),
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
    },
    defaultVariants: {
      variant: 'default',
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
 * Typographic article-body wrapper. Server component (no hooks).
 *
 * Drop any combination of `h1`–`h6`, `p`, `a`, `ul`/`ol`, `blockquote`,
 * `code`/`pre`, `table`, `img` inside; the cascade styles them with DS
 * tokens. The wrapper itself is just an `<article>` (or your `as` override)
 * with the measure bounded.
 */
const Prose = React.forwardRef<HTMLElement, ProseProps>(
  ({ className, variant, as, children, ...props }, ref) => {
    const Tag = (as ?? 'article') as React.ElementType;
    return (
      <Tag
        ref={ref}
        data-slot="prose"
        data-min-viewport={String(MIN_VIEWPORT)}
        data-variant={variant ?? undefined}
        className={cn(proseVariants({ variant }), 'prose-interlace', className)}
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
