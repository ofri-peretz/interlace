'use client';

/**
 * @interlace/ui — Carousel
 *
 * A row of cards the reader swipes through: today's updates, featured
 * answers, the games to play next. On a phone it is the shape people already
 * know from every feed; on a wide screen it shows several cards at once and
 * two buttons page through the rest.
 *
 * ## How to use it
 *
 *   <Carousel aria-label="Featured answers">
 *     <CarouselContent>
 *       {answers.map((a) => <CarouselItem key={a.id}><AnswerCard {...a} /></CarouselItem>)}
 *     </CarouselContent>
 *     <CarouselPrevious />
 *     <CarouselNext />
 *   </Carousel>
 *
 * The part names follow shadcn's carousel, so an app moving over finds them
 * where it expects. There is no carousel library underneath: the row is the
 * browser's own scroll with snap points, so touch, trackpad, wheel and the
 * keyboard all work as they do on any scrolling region, at the device's own
 * speed and friction.
 *
 * ## Content first
 *
 * Every card is in the server HTML, in order. Nothing rotates on
 * its own (WCAG 2.2.2), nothing is cloned to fake a loop, and no card is
 * hidden from a screen reader. The row is one tab stop that scrolls with the
 * arrow keys; Tab then walks through the links inside the cards, and the
 * browser brings each one into view as it takes focus. Each card is announced
 * as "slide, 2 of 6" inside a region announced as a carousel.
 *
 * ## Paging
 *
 * Previous and Next scroll by one view, and snap lands on the start of a
 * card. They switch off at either end and are not shown when every card fits, and they follow the reading
 * direction: in a right-to-left page Next moves left and the arrows turn
 * around. Under `prefers-reduced-motion: reduce` a page jumps instead of
 * gliding.
 *
 * ## Tokens
 *
 * `--carousel-item-size` sets how wide a card is (default `min(20rem, 85%)`,
 * so the next card always peeks in on a phone) and `--carousel-gap` the space
 * between cards (default `1rem`).
 *
 * ## MIN_VIEWPORT — 320
 *
 * ## Anatomy
 *
 *   Carousel                      (section — data-slot="carousel", aria-roledescription="carousel", data-min-viewport=320)
 *     ├─ CarouselContent          (div — data-slot="carousel-content": the scrolling row, one tab stop)
 *     │   └─ CarouselItem × n     (div[role=group] — data-slot="carousel-item", aria-roledescription="slide", "n of m")
 *     ├─ CarouselPrevious         (Button — data-slot="carousel-previous", disabled at the start)
 *     └─ CarouselNext             (Button — data-slot="carousel-next", disabled at the end)
 *
 * | Rule | Concept                  | Where in this file                                  |
 * | ---- | ------------------------ | --------------------------------------------------- |
 * | R4   | Extends native el        | `section` / `div` / Button props                    |
 * | R6   | data-slot per part       | carousel / -content / -item / -previous / -next     |
 * | R7   | cn + ...rest             | `cn(BASE, className)` + `{...props}`                |
 * | R11  | Composition              | parts are children, not an `items` array prop       |
 * | R13  | Ecosystem first          | shadcn's part names; the browser's scroll snap      |
 * | R14  | Declares min viewport    | `data-min-viewport` + exported const                |
 * | R19  | Tokens only              | `--carousel-item-size`, `--carousel-gap`            |
 * | R25  | Client component         | the buttons read the scroll position                |
 * | R26  | A11y                     | APG carousel roles; no auto-rotation                |
 */

import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';

/** Smallest viable viewport (CSS px) for this pattern. */
export const MIN_VIEWPORT = 320 as const;

type Edges = { start: boolean; end: boolean };

interface CarouselContextValue {
  contentId: string;
  content: React.RefObject<HTMLDivElement | null>;
  edges: Edges;
  measure: (row: HTMLElement) => void;
  page: (by: 1 | -1) => void;
}

const CarouselContext = React.createContext<CarouselContextValue | null>(null);

function useCarousel(part: string): CarouselContextValue {
  const context = React.useContext(CarouselContext);
  if (!context) throw new Error(`${part} must be used inside <Carousel>.`);
  return context;
}

function isRtl(el: Element): boolean {
  return el.closest('[dir]')?.getAttribute('dir') === 'rtl';
}

/** Where the row stands, from its start in the reading direction. Half a pixel of slack absorbs subpixel scroll. */
function edgesOf(el: HTMLElement): Edges {
  const travelled = Math.abs(el.scrollLeft);
  const room = el.scrollWidth - el.clientWidth;
  return { start: travelled <= 0.5, end: travelled >= room - 0.5 };
}

export interface CarouselProps extends React.ComponentPropsWithoutRef<'section'> {
  /** Names the carousel for a screen reader, e.g. "Featured answers". Required unless `aria-labelledby` is set. */
  'aria-label'?: string;
}

export function Carousel({ className, children, ...props }: CarouselProps) {
  const reduced = useReducedMotion();
  const content = React.useRef<HTMLDivElement>(null);
  const contentId = `${React.useId()}-content`;
  const [edges, setEdges] = React.useState<Edges>({ start: true, end: false });

  const measure = React.useCallback((row: HTMLElement) => {
    const next = edgesOf(row);
    setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  const page = React.useCallback(
    (by: 1 | -1) => {
      const el = content.current;
      if (!el) return;
      const sign = isRtl(el) ? -by : by;
      el.scrollBy({ left: sign * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
    },
    [reduced],
  );

  const value = React.useMemo(() => ({ contentId, content, edges, measure, page }), [contentId, edges, measure, page]);

  return (
    <CarouselContext.Provider value={value}>
      <section
        data-slot="carousel"
        aria-roledescription="carousel"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn(
          'relative grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-3 [--carousel-gap:1rem] [--carousel-item-size:min(20rem,85%)]',
          className,
        )}
        {...props}
      >
        {children}
      </section>
    </CarouselContext.Provider>
  );
}

export type CarouselContentProps = React.ComponentPropsWithoutRef<'div'>;

export function CarouselContent({ className, children, onScroll, ...props }: CarouselContentProps) {
  const { contentId, content, measure } = useCarousel('CarouselContent');

  // Measure once laid out, and again whenever the row or its cards change size.
  React.useEffect(() => {
    // Effects run after the ref is attached, so the row is there.
    const el = content.current!;
    measure(el);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure(el));
    observer.observe(el);
    return () => observer.disconnect();
  }, [content, measure]);

  const count = React.Children.toArray(children).filter(React.isValidElement).length;
  let index = 0;

  return (
    <div
      ref={content}
      id={contentId}
      data-slot="carousel-content"
      // One tab stop, so a keyboard reader can scroll the row with the arrow keys (axe: scrollable-region-focusable).
      tabIndex={0}
      onScroll={(event) => {
        measure(event.currentTarget);
        onScroll?.(event);
      }}
      className={cn(
        'col-span-3 row-start-2 -mx-1 flex snap-x snap-mandatory gap-(--carousel-gap) overflow-x-auto overscroll-x-contain px-1 py-2 scroll-px-1 motion-safe:scroll-smooth',
        'rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement<CarouselItemProps>(child)) return child;
        index += 1;
        return React.cloneElement(child, { position: child.props.position ?? { index, count } });
      })}
    </div>
  );
}

export interface CarouselItemProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Set by CarouselContent: this card's place in the row, announced as "2 of 6". */
  position?: { index: number; count: number };
  /** How the place is announced. @default (index, count) => `${index} of ${count}` */
  positionLabel?: (index: number, count: number) => string;
}

export function CarouselItem({ className, position, positionLabel, ...props }: CarouselItemProps) {
  const label = position ? (positionLabel ?? ((i, n) => `${i} of ${n}`))(position.index, position.count) : undefined;
  return (
    <div
      data-slot="carousel-item"
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      className={cn('min-w-0 shrink-0 grow-0 basis-(--carousel-item-size) snap-start', className)}
      {...props}
    />
  );
}

export interface CarouselButtonProps extends Omit<React.ComponentProps<typeof Button>, 'children'> {
  /** The button's accessible name. */
  label?: string;
}

function CarouselButton({
  direction,
  label,
  className,
  onClick,
  ...props
}: CarouselButtonProps & { direction: 1 | -1 }) {
  const { contentId, edges, page } = useCarousel(direction === 1 ? 'CarouselNext' : 'CarouselPrevious');
  const atEdge = direction === 1 ? edges.end : edges.start;
  // Everything fits: there is nowhere to page, so neither button shows.
  if (edges.start && edges.end) return null;
  const Icon = direction === 1 ? ChevronRightIcon : ChevronLeftIcon;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      data-slot={direction === 1 ? 'carousel-next' : 'carousel-previous'}
      aria-controls={contentId}
      aria-label={label}
      disabled={atEdge}
      className={cn('row-start-1', direction === 1 ? 'col-start-3' : 'col-start-2', className)}
      onClick={(event) => {
        page(direction);
        onClick?.(event);
      }}
      {...props}
    >
      <Icon aria-hidden="true" className="rtl:rotate-180" />
    </Button>
  );
}

/** Pages back by one view. Sits at the inline end of the header row, before Next. */
export function CarouselPrevious({ label = 'Previous', ...props }: CarouselButtonProps) {
  return <CarouselButton direction={-1} label={label} {...props} />;
}

/** Pages on by one view. */
export function CarouselNext({ label = 'Next', ...props }: CarouselButtonProps) {
  return <CarouselButton direction={1} label={label} {...props} />;
}
