import * as React from 'react';
import { Clock } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Skeleton } from './skeleton.js';

/**
 * @interlace/ui — ReadingTime
 *
 * Compact "<N> min read" badge for articles, blog cards, docs index entries
 * — anywhere a content surface needs to signal expected reading effort
 * before the reader commits. Renders as an inline `<span>` so it can sit
 * next to a date, an author, or a tag cluster without imposing block
 * layout. Server primitive — no hooks, no client surface.
 *
 * The displayed string is always `"<minutes> min read"` (English-only at
 * this primitive layer; localisation belongs in a higher-altitude wrapper
 * that swaps the label text via children). The numeric `minutes` value is
 * also exposed on `data-reading-time` so scrapers, analytics, and JSON-LD
 * builders can read it without parsing the rendered text.
 *
 * ## Anatomy
 *
 *   ReadingTime                        (span — data-min-viewport=320)
 *     ├─ {showIcon && <Clock />}       (optional 14px lucide outline, aria-hidden)
 *     └─ "<N> min read"                (text node)
 *
 * ## MIN_VIEWPORT — 320
 *
 * Article metadata is a content-surface fixture; it must read on every
 * device that renders text, including a 320 CSS-px iPhone SE. The badge
 * stays on one line because the label is short and the icon collapses
 * to `gap-1`.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'span'> & ReadingTimeProps`           |
 * | R6   | data-slot on root                | `data-slot="reading-time"`                                  |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R8   | No `isXxx`                       | `showIcon` is a presence flag, not a state machine          |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | `text-muted-foreground` + `text-sm` + `gap-1` token utilities |
 * | R20  | AA contrast                      | `--muted-foreground` clears AA on `--background`            |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | `<span>` is inert text; icon marked `aria-hidden`           |
 */

export const MIN_VIEWPORT = 320 as const;

type ReadingTimeProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  /**
   * Estimated reading time in whole minutes. Rendered verbatim and emitted
   * on `data-reading-time` for downstream consumers. Optional when
   * `loading={true}` (no value to render).
   */
  minutes?: number;
  /**
   * When true, prefixes the label with a small `lucide-react` Clock icon.
   * The icon is decorative (`aria-hidden`) — the text label carries the
   * semantic.
   */
  showIcon?: boolean;
  /**
   * When true, render a `<Skeleton variant="text" />` (short width)
   * placeholder in place of the badge. Shape-matched to the typical
   * "<N> min read" footprint so article-header metadata rows don't
   * shift on data arrival.
   */
  loading?: boolean;
};

export const ReadingTime = React.forwardRef<HTMLSpanElement, ReadingTimeProps>(
  ({ className, minutes, showIcon, loading, ...props }, ref) => {
    if (loading) {
      return (
        <Skeleton
          variant="text"
          data-slot="reading-time"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={cn('inline-block h-4 w-20', className)}
        />
      );
    }
    return (
      <span
        ref={ref}
        data-slot="reading-time"
        data-min-viewport={String(MIN_VIEWPORT)}
        data-reading-time={minutes}
        className={cn(
          'inline-flex items-center gap-1 text-muted-foreground text-sm',
          className,
        )}
        {...props}
      >
        {showIcon ? <Clock aria-hidden className="size-3.5" /> : null}
        {minutes} min read
      </span>
    );
  },
);
ReadingTime.displayName = 'ReadingTime';

export type { ReadingTimeProps };
