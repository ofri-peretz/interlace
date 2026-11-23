/**
 * @interlace/ui — FocusGrid
 *
 * A grid of picture cards where the one you point at or tab to stays bright
 * and the others step back. It helps a reader compare a few visual options
 * (destinations, case studies, chapters) without the grid feeling busy.
 *
 * ## No JavaScript
 *
 * The whole effect is CSS. The grid uses `:has()` to notice that one of its
 * cards is hovered or holds focus, and dims every other card. There is no
 * state, no event handler and no hydration: it renders on the server and
 * works before scripts load. Browsers without `:has()` simply show every
 * card at full strength.
 *
 * ## Composition
 *
 *   FocusGrid                         (ul — data-slot="focus-grid", columns)
 *     └─ FocusGrid.Item × n           (li > article)
 *         ├─ media                    (any node: img, next/image, video)
 *         ├─ title / description      (text on a scrim over the media)
 *         └─ href?                    (makes the whole card one link)
 *
 * The card's text sits on a dark scrim (`--scrim` / `--scrim-foreground`,
 * which do not invert between schemes) so it stays readable on any picture.
 * With `href`, the title is the link and its hit area covers the card, so
 * there is one tab stop per card and the link's name is the title.
 *
 * ## Motion
 *
 * Dimming is opacity, applied in every mode because it carries the meaning.
 * The soft blur and the small scale only run under `motion-safe:`.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `ul` / `article` props                                |
 * | R6   | data-slot per part      | focus-grid / -item / -media / -caption                |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R8   | Enums, not booleans     | `columns`, `aspect`                                   |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const                  |
 * | R19  | Tokens only             | `--scrim`, `--scrim-foreground`, `--ring`             |
 * | R25  | Server component        | no hooks → no `'use client'`                          |
 * | R26  | A11y from native el     | list semantics, one link per card                     |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

/**
 * Columns follow the grid's own width, not the viewport: the list is the
 * grid, so it cannot be its own container, and an intrinsic track does the
 * job instead. `auto-fill` fits as many tracks as the width allows; the
 * `max(…)` floor keeps a card readable (16 / 14 / 12rem); the `calc(…)` term
 * caps the count at `columns`; `min(100%, …)` lets one card fill a column
 * narrower than the floor. Written out because Tailwind cannot scan a
 * runtime-built class.
 */
const COLUMNS = {
  2: 'grid-cols-[repeat(auto-fill,minmax(min(100%,max(16rem,calc((100%_-_1rem)/2))),1fr))]',
  3: 'grid-cols-[repeat(auto-fill,minmax(min(100%,max(14rem,calc((100%_-_2rem)/3))),1fr))]',
  4: 'grid-cols-[repeat(auto-fill,minmax(min(100%,max(12rem,calc((100%_-_3rem)/4))),1fr))]',
} as const;

const ASPECT = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
} as const;

/** Every card that is not the hovered or focused one steps back. */
const DIM_OTHERS = [
  '[&:has([data-slot=focus-grid-item]:is(:hover,:focus-within))_[data-slot=focus-grid-item]:not(:hover,:focus-within)]:opacity-55',
  'motion-safe:[&:has([data-slot=focus-grid-item]:is(:hover,:focus-within))_[data-slot=focus-grid-item]:not(:hover,:focus-within)]:blur-[2px]',
  'motion-safe:[&:has([data-slot=focus-grid-item]:is(:hover,:focus-within))_[data-slot=focus-grid-item]:not(:hover,:focus-within)]:scale-[0.98]',
].join(' ');

export interface FocusGridProps extends React.ComponentProps<'ul'> {
  /**
   * The most columns it shows. Fewer as its own width shrinks, so it fits a
   * sidebar or a card as well as a page. @default 3
   */
  columns?: keyof typeof COLUMNS;
}

function FocusGrid({ columns = 3, className, ...props }: FocusGridProps) {
  return (
    <ul
      data-slot="focus-grid"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', COLUMNS[columns], DIM_OTHERS, className)}
      {...props}
    />
  );
}

export interface FocusGridItemProps extends Omit<React.ComponentProps<'article'>, 'title'> {
  /** The picture: an `<img>`, a framework image, a video. Fills the card. */
  media: React.ReactNode;
  /** Card title, shown over the media. With `href`, it is the link's name. */
  title: React.ReactNode;
  /** One short line under the title. */
  description?: React.ReactNode;
  /** Makes the whole card a single link. */
  href?: string;
  /** Shape of the card. @default 'portrait' */
  aspect?: keyof typeof ASPECT;
  /** Heading level of the title, to fit the page outline. @default 'h3' */
  as?: 'h2' | 'h3' | 'h4';
}

function FocusGridItem({
  media,
  title,
  description,
  href,
  aspect = 'portrait',
  as: Heading = 'h3',
  className,
  ...props
}: FocusGridItemProps) {
  return (
    <li
      data-slot="focus-grid-item"
      className="motion-safe:transition-[opacity,filter,transform] motion-safe:duration-300 transition-opacity"
    >
      <article
        className={cn(
          'focus-within:ring-ring relative isolate overflow-hidden rounded-xl focus-within:ring-[3px]',
          ASPECT[aspect],
          className,
        )}
        {...props}
      >
        <div
          data-slot="focus-grid-media"
          className="absolute inset-0 -z-10 [&>*]:size-full [&>img]:object-cover [&>video]:object-cover"
        >
          {media}
        </div>
        <div
          data-slot="focus-grid-caption"
          className="from-scrim/85 text-scrim-foreground absolute inset-x-0 bottom-0 bg-linear-to-t to-transparent p-4 pt-12"
        >
          <Heading className="font-heading text-lg leading-snug font-semibold text-balance">
            {href ? (
              <a href={href} className="outline-none after:absolute after:inset-0">
                {title}
              </a>
            ) : (
              title
            )}
          </Heading>
          {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
        </div>
      </article>
    </li>
  );
}

const FocusGridWithDot = Object.assign(FocusGrid, { Item: FocusGridItem });

export { FocusGridWithDot as FocusGrid, FocusGridItem };
