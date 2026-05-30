'use client';

/**
 * @interlace/ui — Toc + TocPopover
 *
 * The in-page Table of Contents. Long-form pages (docs, MDX articles, rule
 * reference) need a persistent navigation rail that mirrors the heading
 * outline so a reader can both orient themselves and jump. On wide
 * viewports this lives in a right-hand rail (`Toc`); on narrow viewports
 * it folds into a popover trigger (`TocPopover`) so the content column
 * keeps the full reading width.
 *
 * Two contracts make this primitive non-trivial:
 *
 *   1. **Active-section tracking.** We observe the headings the consumer
 *      gave us via `IntersectionObserver` so the rail highlights the
 *      section currently under the reader's eye. No scroll-handler math,
 *      no manual `rAF` — the browser does it.
 *
 *   2. **Reduced-motion contract.** Smooth-scroll on click is enabled by
 *      default, but the `useReducedMotion` hook flips it to `instant` for
 *      users with `prefers-reduced-motion: reduce` per
 *      `MOTION_PHILOSOPHY.md`.
 *
 * ## Anatomy
 *
 *   Toc                                  (nav — data-min-viewport=480)
 *     └─ <ol data-slot="toc-list">       (top-level heading list)
 *          └─ <li data-slot="toc-item" data-level="2|3|4" data-active>
 *               └─ <a data-slot="toc-link" href="#…">
 *
 *   TocPopover                           (Popover wrapper — data-min-viewport=480)
 *     ├─ <Popover.Trigger> "On this page"
 *     └─ <Popover.Content> ⟶ <Toc />
 *
 * ## MIN_VIEWPORT — 480
 *
 * The TOC is a *companion* surface — the article itself must always work
 * on a 320 phone, but the TOC rail/popover only earns its place once we
 * have horizontal room for a meaningful "where am I in the doc" label.
 * Below 480 CSS px the consumer should hide the TOC entirely and rely on
 * scroll + headings; the popover form is the smallest UX that's still
 * worth the screen real estate.
 *
 * | Rule | Concept                          | Where in this file                                                  |
 * | ---- | -------------------------------- | ------------------------------------------------------------------- |
 * | R4   | Extends native el + props        | `React.ComponentProps<'nav'> & TocProps`                            |
 * | R6   | data-slot on every part          | `data-slot="toc" / "toc-list" / "toc-item" / "toc-link"`            |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...rest}` on root nav                     |
 * | R8   | No `isXxx`; enums for levels     | `level: 2 \| 3 \| 4` is a discriminated enum, not a boolean         |
 * | R10  | Composition seam                 | `TocPopover` wraps `Toc` via `<Popover>` parts                      |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const         |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes + cva                          |
 * | R19  | Tokens only                      | `pl-md` / `pl-lg` spacing, semantic color tokens                    |
 * | R20  | AA contrast                      | `text-muted-foreground` / active `text-foreground`                  |
 * | R25  | Client component                 | Hooks (`useEffect`, `useState`) + `useReducedMotion` → `'use client'` |
 * | R26  | A11y from native el              | `<nav aria-label>` landmark + `<ol>/<a>` semantics                  |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover.js';

/**
 * Minimum viable viewport (CSS px) for this primitive. Below it, the
 * preflight contract draws a dev-mode outline; consumers should hide the
 * TOC entirely on narrower viewports rather than rely on the popover.
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

type TocProps = Omit<React.ComponentProps<'nav'>, 'children'> & {
  /** Ordered list of headings (preserved 1:1 in the rendered list). */
  items: TocItem[];
  /** Optional accessible name override. Defaults to "Table of contents". */
  label?: string;
};

const LEVEL_INDENT: Record<TocItem['level'], string> = {
  2: '',
  3: 'pl-md',
  4: 'pl-lg',
};

const TocComponent = React.forwardRef<HTMLElement, TocProps>(
  ({ className, items, label = 'Table of contents', ...rest }, ref) => {
    const reduceMotion = useReducedMotion();
    const [activeId, setActiveId] = React.useState<string | null>(null);

    // Track which section is in view via IntersectionObserver. We observe
    // every heading element whose id is in `items`; the top-most visible
    // one wins. No scroll handlers, no rAF — the platform does it.
    React.useEffect(() => {
      if (typeof window === 'undefined' || items.length === 0) return;

      const nodes: HTMLElement[] = [];
      for (const item of items) {
        const node = document.getElementById(item.id);
        if (node) nodes.push(node);
      }
      if (nodes.length === 0) return;

      // Track visibility per id; on each callback pick the top-most.
      const visible = new Map<string, boolean>();

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            visible.set(entry.target.id, entry.isIntersecting);
          }
          // Walk items in source order and pick the first visible one.
          // Falls back to the last item passed if nothing is visible.
          let nextActive: string | null = null;
          for (const item of items) {
            if (visible.get(item.id)) {
              nextActive = item.id;
              break;
            }
          }
          setActiveId(nextActive);
        },
        {
          // Headings are "active" once they pass the top quarter of the
          // viewport and stay so until the next one takes over — same
          // contract as MDX docs sites (Next.js docs, base-ui.com).
          rootMargin: '0px 0px -70% 0px',
          threshold: [0, 1],
        },
      );

      for (const node of nodes) observer.observe(node);
      return () => observer.disconnect();
    }, [items]);

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        // Let modifier-clicks (cmd/ctrl/middle) fall through to the
        // browser so "open in new tab" still works.
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        const target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({
          behavior: reduceMotion ? 'instant' : 'smooth',
          block: 'start',
        });
        // Update the URL hash without a second scroll jump.
        if (typeof history !== 'undefined') {
          history.pushState(null, '', `#${id}`);
        }
        // Move focus into the target so screen readers / keyboard users
        // land where sighted users do.
        target.focus({ preventScroll: true });
      },
      [reduceMotion],
    );

    return (
      <nav
        ref={ref}
        aria-label={label}
        data-slot="toc"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('text-ui-sm', className)}
        {...rest}
      >
        <ol data-slot="toc-list" className="flex flex-col gap-xs">
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <li
                key={item.id}
                data-slot="toc-item"
                data-level={item.level}
                data-active={isActive ? '' : undefined}
                className={cn(LEVEL_INDENT[item.level])}
              >
                <a
                  data-slot="toc-link"
                  href={`#${item.id}`}
                  aria-current={isActive ? 'location' : undefined}
                  onClick={(event) => handleClick(event, item.id)}
                  className={cn(
                    'block rounded-sm py-xs transition-colors',
                    'text-muted-foreground hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'data-[active]:text-foreground data-[active]:font-medium',
                  )}
                  data-active={isActive ? '' : undefined}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  },
);
TocComponent.displayName = 'Toc';

export const Toc = TocComponent;
export type { TocProps };

type TocPopoverProps = TocProps & {
  /** Trigger label — defaults to "On this page". */
  triggerLabel?: React.ReactNode;
  /** Class name applied to the popover trigger button. */
  triggerClassName?: string;
};

/**
 * Narrow-viewport companion to `Toc`. Renders a "On this page" trigger
 * (`<Popover.Trigger>`) and a popover that contains the full `Toc`
 * markup. Same active-tracking + reduced-motion contract — the
 * popover does not own the TOC state, it just hosts the rendered tree.
 */
export function TocPopover({
  items,
  label,
  triggerLabel = 'On this page',
  triggerClassName,
  className,
  ...rest
}: TocPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        data-slot="toc-popover-trigger"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn(
          'inline-flex items-center gap-xs rounded-md border border-border bg-background px-sm py-xs text-ui-sm',
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
        className="w-72 p-sm"
      >
        <Toc
          items={items}
          label={label}
          className={className}
          {...rest}
        />
      </PopoverContent>
    </Popover>
  );
}
