/**
 * @interlace/ui — ReadingLayout
 *
 * A long read with its table of contents: the text column, and beside it a
 * `Toc` rail that stays in view as the reader scrolls. When the layout is
 * too narrow for a rail, the contents fold into a slim bar (`TocBar`) that
 * sticks to the top of the column, names the section being read, shows the
 * page's progress along its foot, and opens the list in a bottom sheet.
 *
 * ## Container, not viewport
 *
 * The switch is a container query on the layout's own width, not a media
 * query on the window. The same layout shows its rail in a wide main column
 * and folds it in a narrow one (next to a sidebar, in a split view, inside
 * a card) with no prop. The rail appears at `@4xl` (56rem) of layout width.
 *
 * ## Sticky offset
 *
 * A page with its own sticky header sets `--reading-offset` to that header's
 * height. The rail and the bar stick below it, and headings with an `id`
 * get a scroll margin, so a jump from the contents never lands under the
 * header or the bar. Defaults to 0.
 *
 * ## Anatomy
 *
 *   ReadingLayout                   (div — data-slot="reading-layout", @container/reading)
 *     └─ div grid                   (one column, or text + rail at @4xl)
 *         ├─ bar                    (div — data-slot="reading-layout-bar", sticky; hidden at @4xl)
 *         │   └─ TocBar
 *         ├─ content                (div — data-slot="reading-layout-content", min-w-0)
 *         └─ rail                   (div — data-slot="reading-layout-rail", shown at @4xl)
 *             └─ div sticky         (data-toc-scroller; scrolls on its own when taller than the screen)
 *                 └─ Toc
 *
 * With no `toc` items, it renders the content alone: no bar, no rail.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Below `@4xl` it is one column and the bar holds one button, so it reads on
 * the narrowest phone.
 *
 * | Rule | Concept                 | Where in this file                                       |
 * | ---- | ----------------------- | -------------------------------------------------------- |
 * | R4   | Extends native el       | `React.ComponentProps<'div'>`                            |
 * | R6   | data-slot per part      | reading-layout / -bar / -content / -rail                 |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                        |
 * | R14  | Declares min viewport   | `data-min-viewport` on the root + exported const         |
 * | R18  | Tailwind only           | Container query variants; the offset is a CSS variable   |
 * | R19  | Tokens only             | `bg-background`, `border-border`                         |
 * | R26  | A11y                    | Toc's named `<nav>` is the one landmark; the rail is a div |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Toc, TocBar, type TocItem } from '../primitives/toc.js';

export const MIN_VIEWPORT = 320 as const;

type ReadingLayoutProps = React.ComponentProps<'div'> & {
  /** The headings to list, in order. Empty or absent: no rail and no bar. */
  toc?: TocItem[];
  /** The contents' accessible name. @default 'Table of contents' */
  tocLabel?: string;
  /** The rail's title, the bar's label and the sheet's title. @default 'On this page' */
  triggerLabel?: React.ReactNode;
};

function ReadingLayout({
  toc = [],
  tocLabel,
  triggerLabel,
  className,
  children,
  ...props
}: ReadingLayoutProps) {
  const hasToc = toc.length > 0;
  return (
    <div
      data-slot="reading-layout"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        '@container/reading',
        // A jump from the contents lands below the page's header and the bar.
        hasToc &&
          '[&_:is(h2,h3,h4)[id]]:scroll-mt-[calc(var(--reading-offset,0px)+4rem)] @4xl/reading:[&_:is(h2,h3,h4)[id]]:scroll-mt-[calc(var(--reading-offset,0px)+1.5rem)]',
        className,
      )}
      {...props}
    >
      <div className="grid grid-cols-1 gap-6 @4xl/reading:grid-cols-[minmax(0,1fr)_15rem] @4xl/reading:gap-12">
        {hasToc ? (
          <div
            data-slot="reading-layout-bar"
            className="border-border bg-background sticky top-[var(--reading-offset,0px)] z-10 -mt-2 border-b @4xl/reading:hidden"
          >
            <TocBar items={toc} label={tocLabel} triggerLabel={triggerLabel} />
          </div>
        ) : null}
        <div data-slot="reading-layout-content" className="min-w-0">
          {children}
        </div>
        {hasToc ? (
          // A div, not an aside: the Toc's named <nav> is already the
          // landmark, and an unnamed complementary one around it is noise.
          <div data-slot="reading-layout-rail" className="hidden @4xl/reading:block">
            <div
              data-toc-scroller=""
              className="sticky top-[calc(var(--reading-offset,0px)+1.5rem)] max-h-[calc(100dvh-var(--reading-offset,0px)-3rem)] -m-1 overflow-y-auto overscroll-contain p-1"
            >
              <Toc items={toc} label={tocLabel} title={triggerLabel ?? 'On this page'} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { ReadingLayout };
export type { ReadingLayoutProps };
