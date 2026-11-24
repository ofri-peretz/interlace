'use client';

/**
 * @interlace/ui — Toc + TocBar + TocPopover
 *
 * The in-page Table of Contents. A long read needs a quiet map of its
 * headings that shows where the reader is and lets them jump. On a wide
 * layout it is a rail beside the text (`Toc`); on a narrow one it is a slim
 * bar that names the current section and opens the full list in a bottom
 * sheet (`TocBar`). `TocPopover` stays for pages that want a small button.
 *
 * ## Where the reader is
 *
 * One scroll-spy drives every form. A section is current once its heading
 * has crossed a reading line a little below the top of the screen (30% of
 * its height, at least 140px), and it stays current until the next heading
 * crosses, so the rail never goes blank in a long section. At the foot of
 * the page the last heading on screen wins, so a short last section can
 * still be reached. Scroll events are passive and read once per frame.
 *
 * A pick from the list sets the current section at once and holds it until
 * the jump has settled, so the marker goes straight to the pick instead of
 * stepping through every section the smooth scroll passes.
 *
 * A pick also moves focus to its heading. A heading with no `tabindex` gets
 * `tabindex="-1"` (focusable by script, never by Tab) and keeps it; one that
 * already has a `tabindex` keeps its own. Set `tabIndex={-1}` on headings to
 * have them render that way from the server.
 *
 * ## The rail
 *
 * A hairline track runs down the start edge of the list. A marker in the
 * primary colour sits beside the current entry and slides to the next one
 * (`ease-move`, `--duration-medium`), and the track above it fills as the
 * reader goes through the page, so the rail is also a progress bar. Long
 * outlines (`collapse`, by default above 10 entries) show their sub-headings
 * only under the current section; the rest fold away and leave the tab
 * order.
 *
 * ## The bar
 *
 * A one-line button that reads "On this page" and, once the reader is in a
 * section, that section's title, with a hairline along its foot that fills
 * with the page. It keeps its height whatever the title, so nothing below it
 * moves. It opens the list in a `Drawer` from the bottom; a pick closes the
 * sheet first and then jumps, with focus on the heading.
 *
 * ## Motion
 *
 * The marker, the fill, the fold and the title change animate only under
 * `motion-safe`; with reduced motion they land at once and a jump is
 * instant. The server HTML holds the whole list; the marker appears once it
 * has been measured.
 *
 * ## Anatomy
 *
 *   Toc                                  (nav — data-slot="toc", data-min-viewport=480)
 *     ├─ <p data-slot="toc-title">       (optional `title`)
 *     └─ <div data-slot="toc-track">     (the hairline track)
 *          ├─ <span data-slot="toc-progress" aria-hidden>  (the read part of the track)
 *          ├─ <span data-slot="toc-indicator" aria-hidden> (the current-entry marker)
 *          └─ <ol data-slot="toc-list">
 *               └─ <li data-slot="toc-item" data-level data-active data-collapsed>
 *                    └─ <a data-slot="toc-link" aria-current="location">
 *
 *   TocBar                               (div — data-slot="toc-bar")
 *     ├─ <button data-slot="toc-bar-trigger">  (label, current section, chevron)
 *     ├─ <span data-slot="toc-bar-progress" aria-hidden>
 *     └─ Drawer (bottom) → title + Toc
 *
 *   TocPopover                           (Popover — data-slot="toc-popover-trigger")
 *
 * ## MIN_VIEWPORT — 480
 *
 * The rail needs room beside the text; below 480 CSS px use `TocBar`, which
 * reads on the narrowest phone.
 *
 * | Rule | Concept                          | Where in this file                                                  |
 * | ---- | -------------------------------- | ------------------------------------------------------------------- |
 * | R4   | Extends native el + props        | `React.ComponentProps<'nav'> & TocProps`                            |
 * | R6   | data-slot on every part          | `toc`, `toc-track`, `toc-indicator`, `toc-item`, `toc-bar`, …      |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...rest}` on the root                     |
 * | R8   | No `isXxx`; enums                | `level: 2 \| 3 \| 4`, `collapse: 'auto' \| 'always' \| 'never'`    |
 * | R10  | Composition seam                 | `TocBar` hosts `Toc` in a `Drawer`, `TocPopover` in a `Popover`     |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const         |
 * | R18  | Tailwind only                    | Measured positions are CSS variables set on the element, read by utilities |
 * | R19  | Tokens only                      | `--duration-*`, `ease-move`, semantic colours                       |
 * | R20  | AA contrast                      | `text-muted-foreground` / current `text-foreground`                 |
 * | R25  | Client component                 | Scroll-spy hooks → `'use client'`                                   |
 * | R26  | A11y from native el              | `<nav aria-label>`, `<ol>/<a>`, `aria-current="location"`           |
 */

import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from './drawer.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';

/**
 * Minimum viable viewport (CSS px) for the rail. Below it, use `TocBar`.
 */
export const MIN_VIEWPORT = 480 as const;

/**
 * One heading entry. `id` must match the `id` attribute on the heading
 * element in the document (the same anchor the reader hits via `#id`).
 */
export type TocItem = {
  /** Heading element id — same value as the `<h2 id="…">` attribute. */
  id: string;
  /** Visible label — usually the heading text itself. */
  label: React.ReactNode;
  /** Heading level. h1 is the page title and never appears in a TOC. */
  level: 2 | 3 | 4;
};

/** When sub-headings fold under their section. `auto` folds above 10 entries. */
export type TocCollapse = 'auto' | 'always' | 'never';

const COLLAPSE_AUTO_ABOVE = 10;

// ─────────────────────────────────────────────────────────────────
// Scroll-spy
// ─────────────────────────────────────────────────────────────────

type Spy = {
  /** The current section's id, or null above the first heading. */
  activeId: string | null;
  /** How far through the page the reader is, 0 to 1. */
  progress: number;
  /** How far through the current section the reader is, 0 to 1. */
  sectionProgress: number;
  /** Mark `id` current now and hold it until the jump to it has settled. */
  hold: (id: string) => void;
};

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

function useTocSpy(items: TocItem[]): Spy {
  const [state, setState] = React.useState({
    activeId: null as string | null,
    progress: 0,
    sectionProgress: 0,
  });
  const held = React.useRef<string | null>(null);
  const settle = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const measure = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    if (items.length === 0) return;
    let frame = 0;

    const read = () => {
      frame = 0;
      const headings = items
        .map((item) => document.getElementById(item.id))
        .filter((node): node is HTMLElement => node !== null);
      if (headings.length === 0) return;

      const viewport = window.innerHeight;
      const line = Math.max(140, viewport * 0.3);
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - viewport;
      const atEnd = maxScroll > 0 && window.scrollY >= maxScroll - 2;
      const tops = headings.map((node) => node.getBoundingClientRect().top);

      let index = -1;
      for (let i = 0; i < tops.length; i++) {
        if (tops[i]! <= (atEnd ? viewport : line)) index = i;
      }

      const firstTop = tops[0]! + window.scrollY - line;
      const progress = maxScroll > firstTop ? clamp01((window.scrollY - firstTop) / (maxScroll - firstTop)) : 1;
      let sectionProgress = 0;
      if (index >= 0) {
        const start = tops[index]!;
        const end = index + 1 < tops.length ? tops[index + 1]! : doc.scrollHeight - window.scrollY;
        sectionProgress = atEnd ? 1 : clamp01((line - start) / Math.max(1, end - start));
      }

      const activeId = held.current ?? (index >= 0 ? headings[index]!.id : null);
      setState((prev) =>
        prev.activeId === activeId &&
        Math.abs(prev.progress - progress) < 0.002 &&
        Math.abs(prev.sectionProgress - sectionProgress) < 0.002
          ? prev
          : { activeId, progress, sectionProgress },
      );
    };

    const schedule = () => {
      // While a picked jump is still scrolling, keep holding its target and
      // let go once the scroll has been quiet for a moment.
      if (held.current) {
        clearTimeout(settle.current);
        settle.current = setTimeout(() => {
          held.current = null;
          schedule();
        }, 120);
      }
      if (!frame) frame = requestAnimationFrame(read);
    };

    measure.current = schedule;
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle.current);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [items]);

  const hold = React.useCallback((id: string) => {
    held.current = id;
    setState((prev) => ({ ...prev, activeId: id }));
    measure.current();
  }, []);

  return { ...state, hold };
}

/** Scroll to a heading, put it in the URL, and move focus to it. */
function jumpTo(id: string, reduceMotion: boolean): boolean {
  const target = document.getElementById(id);
  if (!target) return false;
  target.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' });
  // Update the URL hash without a second scroll jump.
  history.pushState(null, '', `#${id}`);
  // A heading is not focusable on its own, so it takes tabindex=-1:
  // focusable by script, not by Tab. Screen readers land where eyes do.
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  return true;
}

/** A plain click: not a modifier-click meant for a new tab. */
function isPlainClick(event: React.MouseEvent) {
  return !(
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

/** The level-2 entry each entry belongs to (itself for a level 2). */
function sectionOf(items: TocItem[]) {
  const owner = new Map<string, string>();
  let current: string | null = null;
  for (const item of items) {
    if (item.level === 2) current = item.id;
    owner.set(item.id, current ?? item.id);
  }
  return owner;
}

// ─────────────────────────────────────────────────────────────────
// Toc (the rail)
// ─────────────────────────────────────────────────────────────────

type TocProps = Omit<React.ComponentProps<'nav'>, 'children' | 'title'> & {
  /** Ordered list of headings (preserved 1:1 in the rendered list). */
  items: TocItem[];
  /** Optional accessible name override. Defaults to "Table of contents". */
  label?: string;
  /** A small visible heading above the list, such as "On this page". */
  title?: React.ReactNode;
  /** Fold sub-headings under their section. @default 'auto' (above 10 entries) */
  collapse?: TocCollapse;
  /** Called after a link scrolls to its heading and moves focus there. */
  onNavigate?: (id: string) => void;
};

type TocInternals = {
  /** Picks are handed here instead of jumping (the sheet closes first). */
  onPick?: (id: string) => void;
  /** A spy shared with a host that shows the same state. */
  spy?: Spy;
};

const LEVEL_INDENT: Record<TocItem['level'], string> = {
  2: 'ps-3',
  3: 'ps-6',
  4: 'ps-9',
};

const TocView = React.forwardRef<HTMLElement, TocProps & TocInternals>(
  (
    {
      className,
      items,
      label = 'Table of contents',
      title,
      collapse = 'auto',
      onNavigate,
      onPick,
      spy: hostSpy,
      ...rest
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();
    const ownSpy = useTocSpy(hostSpy ? [] : items);
    const spy = hostSpy ?? ownSpy;
    const { activeId, sectionProgress } = spy;
    const listRef = React.useRef<HTMLOListElement>(null);
    const trackRef = React.useRef<HTMLDivElement>(null);

    const owner = React.useMemo(() => sectionOf(items), [items]);
    const folds =
      collapse === 'always' ||
      (collapse === 'auto' && items.length > COLLAPSE_AUTO_ABOVE);
    const openSection = activeId ? owner.get(activeId) : undefined;

    // Place the marker and the fill. Positions are measured, so they are
    // CSS variables on the track that utilities read: no inline style prop.
    React.useLayoutEffect(() => {
      const track = trackRef.current;
      const list = listRef.current;
      if (!track || !list) return;
      const place = () => {
        const item = activeId
          ? Array.from(list.children).find((node) => (node as HTMLElement).dataset.id === activeId)
          : undefined;
        const link = item?.querySelector<HTMLElement>('[data-slot="toc-link"]') ?? null;
        if (!link) {
          track.style.setProperty('--toc-read', '0px');
          track.removeAttribute('data-placed');
          return;
        }
        const top = link.getBoundingClientRect().top - track.getBoundingClientRect().top;
        const height = link.offsetHeight;
        track.style.setProperty('--toc-y', `${top}px`);
        track.style.setProperty('--toc-h', `${height}px`);
        track.style.setProperty('--toc-read', `${top + height * sectionProgress}px`);
        track.setAttribute('data-placed', '');
        // Keep the current entry in view when the rail scrolls on its own.
        const scroller = track.closest<HTMLElement>('[data-toc-scroller]');
        if (scroller) {
          const box = scroller.getBoundingClientRect();
          const rect = link.getBoundingClientRect();
          if (rect.top < box.top + 24 || rect.bottom > box.bottom - 24) {
            scroller.scrollTop += rect.top - box.top - box.height / 3;
          }
        }
      };
      place();
      // Folds open and close over --duration-medium; follow them.
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
      observer?.observe(list);
      return () => observer?.disconnect();
    }, [activeId, sectionProgress, openSection]);

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      if (!isPlainClick(event) || !document.getElementById(id)) return;
      event.preventDefault();
      spy.hold(id);
      if (onPick) {
        onPick(id);
        return;
      }
      jumpTo(id, reduceMotion);
      onNavigate?.(id);
    };

    return (
      <nav
        ref={ref}
        aria-label={label}
        data-slot="toc"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('text-ui-sm', className)}
        {...rest}
      >
        {title ? (
          <p
            data-slot="toc-title"
            className="text-foreground mb-3 ps-3 text-caption font-medium"
          >
            {title}
          </p>
        ) : null}
        <div
          ref={trackRef}
          data-slot="toc-track"
          className="group/toc border-border relative border-s"
        >
          <span
            aria-hidden
            data-slot="toc-progress"
            className={cn(
              'bg-foreground/25 pointer-events-none absolute -start-px top-0 w-px',
              'h-(--toc-read,0px) motion-safe:transition-[height] motion-safe:duration-(--duration-medium) motion-safe:ease-move',
            )}
          />
          <span
            aria-hidden
            data-slot="toc-indicator"
            className={cn(
              'bg-primary pointer-events-none absolute -start-px top-0 w-0.5 rounded-full opacity-0',
              'h-(--toc-h,0px) translate-y-(--toc-y,0px) group-data-[placed]/toc:opacity-100',
              'motion-safe:transition-[translate,height,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-move',
            )}
          />
          <ol ref={listRef} data-slot="toc-list" className="flex flex-col">
            {items.map((item) => {
              const isActive = item.id === activeId;
              const folded = folds && item.level > 2 && owner.get(item.id) !== openSection;
              return (
                <li
                  key={item.id}
                  data-slot="toc-item"
                  data-id={item.id}
                  data-level={item.level}
                  data-active={isActive ? '' : undefined}
                  data-collapsed={folded ? '' : undefined}
                  inert={folded || undefined}
                  className={cn(
                    // Height to auto by grid rows (0fr ↔ 1fr), per the motion budget.
                    'grid grid-rows-[1fr] opacity-100',
                    'motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-move',
                    'data-[collapsed]:grid-rows-[0fr] data-[collapsed]:opacity-0',
                  )}
                >
                  <div className="min-h-0 in-data-[collapsed]:overflow-hidden">
                    <a
                      data-slot="toc-link"
                      href={`#${item.id}`}
                      aria-current={isActive ? 'location' : undefined}
                      data-active={isActive ? '' : undefined}
                      onClick={(event) => handleClick(event, item.id)}
                      className={cn(
                        'block rounded-sm py-1.5 pe-2 leading-snug',
                        LEVEL_INDENT[item.level],
                        'text-muted-foreground hover:text-foreground motion-safe:transition-colors motion-safe:duration-(--duration-fast)',
                        'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                        'data-[active]:text-foreground data-[active]:font-medium',
                      )}
                    >
                      {item.label}
                    </a>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    );
  },
);
TocView.displayName = 'Toc';

/** The rail: the heading list with a sliding current-section marker. */
export const Toc = React.forwardRef<HTMLElement, TocProps>((props, ref) => (
  <TocView ref={ref} {...props} />
));
Toc.displayName = 'Toc';
export type { TocProps };

// ─────────────────────────────────────────────────────────────────
// TocBar (narrow layouts)
// ─────────────────────────────────────────────────────────────────

type TocBarProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** Ordered list of headings. */
  items: TocItem[];
  /** The list's accessible name. @default 'Table of contents' */
  label?: string;
  /** The bar's label and the sheet's title. @default 'On this page' */
  triggerLabel?: React.ReactNode;
  /** Called after a pick scrolls to its heading and moves focus there. */
  onNavigate?: (id: string) => void;
};

/**
 * Narrow layouts: a one-line bar naming the current section, with the
 * page's progress along its foot, that opens the list in a bottom sheet.
 */
export function TocBar({
  items,
  label,
  triggerLabel = 'On this page',
  onNavigate,
  className,
  ...rest
}: TocBarProps) {
  const reduceMotion = useReducedMotion();
  const spy = useTocSpy(items);
  const [open, setOpen] = React.useState(false);
  const pending = React.useRef<string | null>(null);
  const current = items.find((item) => item.id === spy.activeId);
  const barRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    barRef.current?.style.setProperty('--toc-progress', String(spy.progress));
  }, [spy.progress]);

  // A pick closes the sheet first; the jump waits until the page is no
  // longer held still behind it, then lands with focus on the heading.
  const handlePick = (id: string) => {
    pending.current = id;
    setOpen(false);
  };
  const handleOpenChangeComplete = (isOpen: boolean) => {
    const id = pending.current;
    if (isOpen || !id) return;
    pending.current = null;
    if (jumpTo(id, reduceMotion)) onNavigate?.(id);
  };

  return (
    <div
      ref={barRef}
      data-slot="toc-bar"
      className={cn('relative', className)}
      {...rest}
    >
      <Drawer open={open} onOpenChange={setOpen} onOpenChangeComplete={handleOpenChangeComplete}>
        <DrawerTrigger
          data-slot="toc-bar-trigger"
          className={cn(
            'group/bar flex min-h-12 w-full items-center gap-3 rounded-md px-1 py-1 text-start',
            'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span
              className={cn(
                'text-muted-foreground text-caption',
                // Alone, the label is the line; with a section it is its eyebrow.
                !current && 'text-foreground text-ui-sm font-medium',
              )}
            >
              {triggerLabel}
            </span>
            {current ? (
              <span
                key={current.id}
                data-slot="toc-bar-current"
                className={cn(
                  'text-foreground text-ui-sm truncate font-medium',
                  'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-(--duration-base) motion-safe:ease-enter',
                )}
              >
                {current.label}
              </span>
            ) : null}
          </span>
          <ChevronDownIcon
            aria-hidden
            className="text-muted-foreground size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-(--duration-base) group-data-[popup-open]/bar:rotate-180"
          />
        </DrawerTrigger>
        <span
          aria-hidden
          data-slot="toc-bar-progress"
          className={cn(
            'bg-primary pointer-events-none absolute inset-x-0 -bottom-px h-px origin-left rtl:origin-right',
            'scale-x-(--toc-progress,0) motion-safe:transition-transform motion-safe:duration-(--duration-fast)',
          )}
        />
        <DrawerContent data-slot="toc-bar-sheet" finalFocus={false} className="max-h-[80dvh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle>{triggerLabel}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <TocView items={items} label={label} collapse="never" spy={spy} onPick={handlePick} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
export type { TocBarProps };

// ─────────────────────────────────────────────────────────────────
// TocPopover (a small button)
// ─────────────────────────────────────────────────────────────────

type TocPopoverProps = TocProps & {
  /** Trigger label — defaults to "On this page". */
  triggerLabel?: React.ReactNode;
  /** Class name applied to the popover trigger button. */
  triggerClassName?: string;
};

/**
 * A compact companion to `Toc`: an "On this page" button that opens the
 * list in a popover. `TocBar` is the fuller narrow-layout form.
 */
export function TocPopover({
  items,
  label,
  triggerLabel = 'On this page',
  triggerClassName,
  className,
  onNavigate,
  ...rest
}: TocPopoverProps) {
  const [open, setOpen] = React.useState(false);
  // A picked link closes the popover so it stops covering the text. Focus
  // has already moved to the heading, outside the popup, so it stays there.
  const handleNavigate = React.useCallback(
    (id: string) => {
      setOpen(false);
      onNavigate?.(id);
    },
    [onNavigate],
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-slot="toc-popover-trigger"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-ui-sm',
          'text-foreground hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          triggerClassName,
        )}
      >
        {triggerLabel}
      </PopoverTrigger>
      <PopoverContent
        data-slot="toc-popover-content"
        align="start"
        // A long outline scrolls inside the room the screen has left.
        className="max-h-(--available-height) w-72 overflow-y-auto overscroll-contain p-4"
      >
        <Toc
          items={items}
          label={label}
          className={className}
          collapse="never"
          onNavigate={handleNavigate}
          {...rest}
        />
      </PopoverContent>
    </Popover>
  );
}
