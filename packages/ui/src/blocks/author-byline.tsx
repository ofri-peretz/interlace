import * as React from 'react';
import { Clock } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Avatar, AvatarImage, AvatarFallback } from '../primitives/avatar.js';
import { Typography } from '../primitives/typography.js';

/**
 * @interlace/ui — AuthorByline
 *
 * The "who wrote this + when + how long it takes to read" adornment that sits
 * directly under an article H1. Pure surface composition over existing
 * primitives — Avatar (large) on the left, a vertical Stack on the right
 * with author name (UI semibold), optional one-line bio (UI-sm muted), and a
 * meta row that pairs the publication date with the reading-time chip,
 * separated by a typographic mid-dot.
 *
 * Date is rendered through a native `<time dateTime>` so RSS / Google
 * structured-data parsers + assistive tech read the ISO value, while the
 * visible text uses the short, locale-friendly `Mar 5, 2026` form. Reading
 * time is a span (not a `<time>`) because it isn't a moment in time — it's
 * an estimated duration, and the `<time>` element's `datetime` grammar for
 * durations (`PT5M`) confuses more readers than it helps.
 *
 * ## Anatomy
 *
 *   AuthorByline                     (div — data-min-viewport=320)
 *     ├─ Avatar size=lg              (left — `h-12 w-12`, AvatarImage src, AvatarFallback initial)
 *     └─ Stack vertical gap=xs       (right column)
 *         ├─ Typography ui semibold  (author name)
 *         ├─ Typography ui-sm muted  (optional bio)
 *         └─ <div> meta row          (PublishedDate · ReadingTime)
 *             ├─ <time dateTime>     (published date — short form)
 *             ├─ <span aria-hidden>· (dot separator)
 *             └─ <span>              (reading time — Clock icon + "N min read")
 *
 * ## MIN_VIEWPORT — 320
 *
 * Article bylines are reading-surface furniture; they MUST work on the
 * narrowest phone we support. A 320 CSS-px viewport fits one 48px-square
 * avatar + a single-line name + a two-chip meta row when the bio is omitted;
 * when the bio is present, the right column wraps naturally because every
 * row uses the same `flex-wrap` rhythm.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'div'> & AuthorBylineProps`           |
 * | R6   | data-slot on root + parts        | `data-slot="author-byline"`, `data-slot="author-byline-*"`  |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R8   | No `isXxx`                       | n/a — no boolean variants                                   |
 * | R10  | Composition over primitives      | Avatar + Typography + (PublishedDate + ReadingTime inline)  |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | `gap-md`/`gap-xs` from `--spacing-*`; type tokens via Typography; semantic colors |
 * | R20  | AA contrast                      | Muted tone resolves to `--muted-foreground` (AA-cleared)    |
 * | R25  | Server component                 | No hooks → no `'use client'` (Avatar is the client boundary) |
 * | R26  | A11y from native el              | `<time dateTime>` for the date; reading-time chip has visible text |
 */

export const MIN_VIEWPORT = 320 as const;

/** Short, locale-friendly date for the visible byline (e.g. `Mar 5, 2026`). */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** First grapheme of `name`, uppercased, for the avatar fallback. */
function initialOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

type AuthorBylineProps = React.ComponentProps<'div'> & {
  /** Author display name — required. Renders as the primary byline label. */
  authorName: string;
  /** `<img src>` for the avatar. Decorative — `alt` derives from `authorName`. */
  authorAvatar: string;
  /** Optional one-line bio (e.g. "Staff engineer at Interlace"). */
  authorBio?: string;
  /** ISO-8601 publication timestamp — drives both `<time dateTime>` and the visible short form. */
  publishedDateIso: string;
  /** Estimated reading time in whole minutes. Omitting it hides the chip. */
  readingTimeMinutes?: number;
};

/**
 * Article hero adornment — author + date + reading time. Server component.
 */
export function AuthorByline({
  className,
  authorName,
  authorAvatar,
  authorBio,
  publishedDateIso,
  readingTimeMinutes,
  ...props
}: AuthorBylineProps) {
  return (
    <div
      data-slot="author-byline"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex flex-row items-center gap-md', className)}
      {...props}
    >
      <Avatar
        data-slot="author-byline-avatar"
        className="size-12 shrink-0"
      >
        <AvatarImage src={authorAvatar} alt={authorName} />
        <AvatarFallback>{initialOf(authorName)}</AvatarFallback>
      </Avatar>

      <div
        data-slot="author-byline-body"
        className="flex min-w-0 flex-col gap-xs"
      >
        <Typography
          data-slot="author-byline-name"
          variant="ui"
          className="font-semibold"
        >
          {authorName}
        </Typography>

        {authorBio ? (
          <Typography
            data-slot="author-byline-bio"
            variant="ui-sm"
            tone="muted"
          >
            {authorBio}
          </Typography>
        ) : null}

        <div
          data-slot="author-byline-meta"
          className="text-muted-foreground flex flex-wrap items-center gap-2 text-ui-sm"
        >
          <time
            data-slot="author-byline-published-date"
            dateTime={publishedDateIso}
          >
            {formatDate(publishedDateIso)}
          </time>
          {readingTimeMinutes !== undefined ? (
            <>
              <span aria-hidden className="opacity-60">
                ·
              </span>
              <span
                data-slot="author-byline-reading-time"
                className="inline-flex items-center gap-1"
              >
                <Clock className="size-4" aria-hidden />
                {readingTimeMinutes} min read
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
