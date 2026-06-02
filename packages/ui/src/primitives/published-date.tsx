/**
 * @interlace/ui — PublishedDate
 *
 * Article publish-date stamp. A pure surface primitive that renders a
 * semantic `<time dateTime={iso}>` with a human-readable label produced by
 * `Intl.DateTimeFormat` at render time. The native element owns the machine
 * value (the `dateTime` attribute is what RSS readers, search engines, and
 * assistive tech read); the formatted string is what humans read. No state,
 * no hooks — a server component.
 *
 * The `format` enum keeps the call-site declarative:
 *   - `long`  → `May 30, 2026`   (article header, list cards)
 *   - `short` → `5/30/26`        (tight metadata rows, footers)
 *
 * Locale follows the runtime default (`Intl.DateTimeFormat` with no `locale`
 * arg). Consumers that need a fixed locale pass `lang=` on an ancestor or
 * wrap with their own formatter — this primitive trusts the page's locale
 * contract rather than baking one in.
 *
 * ## Anatomy
 *
 *   <time data-slot="published-date" data-min-viewport="320" dateTime="2026-05-30">
 *     May 30, 2026
 *   </time>
 *
 * ## MIN_VIEWPORT — 320
 *
 * Article metadata must render on every device that reads the post. A
 * narrow phone is the LCP-critical viewport for blog content; if the
 * publish stamp does not fit at 320px, the article header is broken.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'time'> & PublishedDateProps`         |
 * | R6   | data-slot on root                | `data-slot="published-date"`                                |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R8   | No isXxx; enums for variants     | `format` is an enum (`long` | `short`)                      |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | `text-muted-foreground` + `text-sm` from semantic tokens    |
 * | R20  | AA contrast                      | `text-muted-foreground` clears AA on `--background`         |
 * | R25  | Server component                 | No hooks → no `'use client'`; Intl runs at render           |
 * | R26  | A11y from native el              | `<time dateTime=...>` is the canonical machine-readable date |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Skeleton } from './skeleton.js';

/**
 * Minimum viable viewport (CSS px) for this primitive. Below it, the
 * preflight contract draws a dev-mode outline; in prod the component still
 * renders. Exported so consumers / tests can read it.
 */
export const MIN_VIEWPORT = 320 as const;

/** Human-readable format. `long` is the article-header default; `short` is for tight rows. */
export type PublishedDateFormat = 'long' | 'short';

type PublishedDateProps = Omit<React.ComponentProps<'time'>, 'dateTime' | 'children'> & {
  /**
   * ISO 8601 timestamp (e.g. `'2026-05-30'` or `'2026-05-30T14:00:00Z'`).
   * Becomes the `dateTime` attribute verbatim. Optional when
   * `loading={true}` (the skeleton has no value to render).
   */
  dateIso?: string;
  /** Display format. Defaults to `'long'`. */
  format?: PublishedDateFormat;
  /**
   * When true, render a `<Skeleton variant="text" />` (short width)
   * placeholder. Shape-matched to the typical "Month DD, YYYY" footprint.
   */
  loading?: boolean;
};

const LONG_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

const SHORT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: '2-digit',
  month: 'numeric',
  day: 'numeric',
};

function formatPublishedDate(iso: string, format: PublishedDateFormat): string {
  const date = new Date(iso);
  const options = format === 'short' ? SHORT_OPTIONS : LONG_OPTIONS;
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

/** Article publish-date stamp. Server component (no hooks). */
const PublishedDate = React.forwardRef<HTMLTimeElement, PublishedDateProps>(
  ({ className, dateIso, format = 'long', loading, ...props }, ref) => {
    if (loading || !dateIso) {
      return (
        <Skeleton
          variant="text"
          data-slot="published-date"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={cn('inline-block h-4 w-24', className)}
        />
      );
    }
    const label = formatPublishedDate(dateIso, format);
    return (
      <time
        ref={ref}
        data-slot="published-date"
        data-min-viewport={String(MIN_VIEWPORT)}
        data-format={format}
        dateTime={dateIso}
        className={cn('text-muted-foreground text-sm', className)}
        {...props}
      >
        {label}
      </time>
    );
  },
);
PublishedDate.displayName = 'PublishedDate';

export { PublishedDate };
export type { PublishedDateProps };
