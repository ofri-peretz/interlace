import * as React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { cn } from '../lib/cn.js';

/**
 * @interlace/ui — PrevNextPost
 *
 * Paired previous / next link cards rendered at the foot of an article. The
 * canonical "what to read next" surface — improves session depth, reduces
 * bounce, and gives keyboard / screen-reader users a deterministic exit ramp
 * from long-form content. Wrapped in a `<nav aria-label="Article navigation">`
 * so AT users can jump to it from the landmarks rotor.
 *
 * Either side is optional: a series-start post passes only `next`, a
 * series-end post passes only `prev`. When only one side is supplied the
 * grid still reserves two columns at `md` so the surviving card keeps its
 * column width — no layout shift between pages.
 *
 * ## Anatomy
 *
 *   PrevNextPost                       (nav — data-min-viewport=480)
 *     ├─ a [data-slot="prev-next-prev"]   (left card — ArrowLeft + kicker + title)
 *     └─ a [data-slot="prev-next-next"]   (right card — kicker + title + ArrowRight)
 *
 * ## MIN_VIEWPORT — 480
 *
 * Article-footer surface; below ~480 CSS px the two cards stack and the
 * arrow + title row becomes the dominant chrome of the screen, which is
 * fine. We don't promise design quality below 480 — phones at 360–390
 * still get a usable single-column stack via `grid-cols-1`, and the
 * preflight dev outline flags the regression if a consumer tries to embed
 * the block inside a narrower container.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'nav'> & PrevNextPostProps`           |
 * | R6   | data-slot on root + parts        | `data-slot="prev-next-post"` + per-card `prev-next-prev/next` |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R8   | No isXxx; enums for variants     | n/a — no boolean variants                                   |
 * | R10  | Composition seam                 | `prev` + `next` slots; `kicker` per side                    |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | border-border / rounded-lg / p-md / gap-md / text-muted-foreground |
 * | R20  | AA contrast                      | Hover ring uses `violet-500/60`; base uses semantic tokens  |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | `<a href>` per card; `<nav aria-label>` landmark            |
 */

export const MIN_VIEWPORT = 480 as const;

/** One side of the pair. `kicker` is the eyebrow label, e.g. "Previous" or section name. */
export type PrevNextPostLink = {
  /** Destination URL. */
  href: string;
  /** Card title — the post title or section name. */
  title: React.ReactNode;
  /** Optional eyebrow label above the title. Defaults to "Previous" / "Next" per side. */
  kicker?: React.ReactNode;
};

type PrevNextPostProps = Omit<React.ComponentProps<'nav'>, 'aria-label'> & {
  /** Previous post — left card. Omit for the first post in a series. */
  prev?: PrevNextPostLink;
  /** Next post — right card. Omit for the last post in a series. */
  next?: PrevNextPostLink;
  /** Override the nav landmark label. Defaults to "Article navigation". */
  'aria-label'?: string;
};

const CARD_BASE =
  'group flex flex-col gap-1 rounded-lg border border-border p-md no-underline transition-colors hover:border-violet-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function PrevNextPost({
  className,
  prev,
  next,
  'aria-label': ariaLabel = 'Article navigation',
  ...props
}: PrevNextPostProps) {
  return (
    <nav
      data-slot="prev-next-post"
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-label={ariaLabel}
      className={cn('grid grid-cols-1 gap-md md:grid-cols-2', className)}
      {...props}
    >
      {prev ? (
        <a
          href={prev.href}
          data-slot="prev-next-prev"
          className={cn(CARD_BASE, 'items-start text-left')}
        >
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            {prev.kicker ?? 'Previous'}
          </span>
          <span className="text-body font-medium text-foreground">
            {prev.title}
          </span>
        </a>
      ) : (
        // Empty cell keeps the next card right-aligned on md+ when prev is absent.
        <span aria-hidden className="hidden md:block" />
      )}

      {next ? (
        <a
          href={next.href}
          data-slot="prev-next-next"
          className={cn(CARD_BASE, 'items-end text-right md:col-start-2')}
        >
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {next.kicker ?? 'Next'}
            <ArrowRight className="size-4" aria-hidden />
          </span>
          <span className="text-body font-medium text-foreground">
            {next.title}
          </span>
        </a>
      ) : null}
    </nav>
  );
}

export type { PrevNextPostProps };
