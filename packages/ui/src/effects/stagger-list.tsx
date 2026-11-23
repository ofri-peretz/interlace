'use client';

/**
 * @interlace/ui — StaggerList
 *
 * A list whose items arrive one after another the first time it scrolls into
 * view: steps of a process, recent updates, the points of an argument. The
 * arrival gives the eye an order to read in; the list itself is ordinary.
 *
 * ## Content first
 *
 * Every item is in the HTML from the server, in a real `ul` or `ol`, so a
 * screen reader, a crawler and a reader without scripts get the whole list.
 * The motion only decides when each item becomes visible, once, and never
 * moves, removes or repeats an item. There is no loop and nothing to pause.
 *
 * ## Motion
 *
 * Before the first paint, items below the fold are set to transparent; when
 * the list enters the viewport each one fades and rises a few pixels, `step`
 * milliseconds after the one before. It runs on the Web Animations API, so
 * there are no keyframes to add. Under `prefers-reduced-motion: reduce` the
 * items are simply there. An item that receives focus before its turn shows
 * at once, so focus never lands on something invisible.
 *
 * ## Composition
 *
 *   StaggerList                        (ul or ol — data-slot="stagger-list")
 *     └─ li × n                        (one per child — data-slot="stagger-list-item")
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `ul` / `ol` props                                     |
 * | R6   | data-slot per part      | stagger-list / -item                                  |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R8   | Enums, not booleans     | `as`, `gap`                                           |
 * | R25  | Client component        | the reveal runs in the browser                        |
 * | R26  | A11y from native el     | list semantics; focus reveals at once                 |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

const GAP = { none: 'gap-0', sm: 'gap-2', md: 'gap-4', lg: 'gap-6' } as const;

export interface StaggerListProps extends React.ComponentPropsWithoutRef<'ul'> {
  /** A bulleted list, or a numbered one when the order is the point. @default 'ul' */
  as?: 'ul' | 'ol';
  /** Milliseconds between one item and the next. @default 90 */
  step?: number;
  /** Milliseconds each item takes to arrive. @default 420 */
  duration?: number;
  /** Space between items. @default 'md' */
  gap?: keyof typeof GAP;
}

export function StaggerList({
  as: List = 'ul',
  step = 90,
  duration = 420,
  gap = 'md',
  className,
  children,
  ...props
}: StaggerListProps) {
  const reduced = useReducedMotion();
  const listRef = React.useRef<HTMLUListElement & HTMLOListElement>(null);

  // Before paint: hide the items, so they can arrive instead of flashing.
  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || reduced || typeof list.animate !== 'function') return;
    if (typeof IntersectionObserver === 'undefined') return;
    const items = Array.from(list.children) as HTMLElement[];
    for (const item of items) item.style.opacity = '0';

    const reveal = (item: HTMLElement, delay: number) => {
      if (item.dataset.revealed) return;
      item.dataset.revealed = 'true';
      item.style.opacity = '';
      item.animate(
        [
          { opacity: 0, transform: 'translateY(0.5rem)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration, delay, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'backwards' },
      );
    };
    const onFocus = (event: FocusEvent) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>('[data-slot=stagger-list-item]');
      if (item) reveal(item, 0);
    };
    list.addEventListener('focusin', onFocus);

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        items.forEach((item, i) => reveal(item, i * step));
      },
      { threshold: 0.15 },
    );
    io.observe(list);

    return () => {
      io.disconnect();
      list.removeEventListener('focusin', onFocus);
      for (const item of items) {
        item.style.opacity = '';
        delete item.dataset.revealed;
        for (const a of item.getAnimations?.() ?? []) a.cancel();
      }
    };
  }, [reduced, step, duration, React.Children.count(children)]);

  return (
    <List
      ref={listRef}
      data-slot="stagger-list"
      className={cn('grid', List === 'ol' ? 'list-decimal ps-6' : 'list-none p-0', GAP[gap], className)}
      {...props}
    >
      {React.Children.map(children, (child) =>
        child === null || child === undefined || child === false ? null : (
          <li data-slot="stagger-list-item">{child}</li>
        ),
      )}
    </List>
  );
}
