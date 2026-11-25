'use client';

/**
 * @interlace/ui — FlipGroup
 *
 * Items that glide to their new place when a list is sorted, filtered or
 * reordered, instead of jumping there: a leaderboard that re-ranks, results
 * that narrow as a filter is typed, cards that swap. The motion tells the
 * reader where each item went, which a jump hides.
 *
 * ## How to use it
 *
 * Wrap the list and give each moving item a stable `data-flip-id` (its key is
 * a good choice). Render the list in its new order as you normally would;
 * FlipGroup measures where each item was and where it is now, and plays the
 * difference. Items that are new fade in where they land.
 *
 *   <FlipGroup render={<ol />}>
 *     {rows.map((row) => <li key={row.id} data-flip-id={row.id}>…</li>)}
 *   </FlipGroup>
 *
 * ## Content first
 *
 * The list is the list: its markup, order and semantics are yours, and the
 * DOM order is the new order the moment React commits, so a screen reader
 * and Tab follow the real order while the eye follows the glide.
 *
 * ## Motion
 *
 * FLIP (first, last, invert, play): one layout read per item before paint,
 * then a Web Animations API `transform` from the old place to none, which the
 * compositor runs. A move that is interrupted by the next change settles and
 * glides again from its last resting place. Under `prefers-reduced-motion: reduce`,
 * or without `element.animate`, items simply take their new place.
 *
 * ## Composition
 *
 *   FlipGroup                           (div by default, or `render` — data-slot="flip-group")
 *     └─ [data-flip-id] × n             (your items)
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `div` props                                          |
 * | R6   | data-slot per part      | flip-group                                           |
 * | R7   | cn + ...rest            | `cn(className)` + `{...props}` + `useRender`         |
 * | R13  | Ecosystem first         | `useRender` to be the `ul`/`ol` itself               |
 * | R25  | Client component        | measures layout in the browser                       |
 * | R26  | A11y from native el     | DOM order is the new order                           |
 */

import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export interface FlipGroupProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Milliseconds each glide takes. @default 400 */
  duration?: number;
  /** Replace the rendered element, e.g. `<ul />` or `<ol />`, so the group is the list itself. */
  render?: useRender.RenderProp;
}

const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

function items(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-flip-id]'));
}

export function FlipGroup({ duration = 400, render, className, ...props }: FlipGroupProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);
  const last = React.useRef(new Map<string, DOMRect>());
  // Only the glides this group started: a consumer's own transitions on an item are left alone.
  const glides = React.useRef(new Map<string, Animation>());

  // Every commit: compare each item's place now with its place at the last
  // commit, play the difference, then remember where everything is.
  React.useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const before = last.current;
    const now = new Map<string, DOMRect>();
    for (const el of items(root)) {
      // Measure the layout, not a glide still in flight from the last change.
      const id = el.dataset.flipId!;
      glides.current.get(id)?.cancel();
      glides.current.delete(id);
      now.set(id, el.getBoundingClientRect());
    }
    last.current = now;
    if (reduced || before.size === 0 || typeof root.animate !== 'function') return;

    for (const el of items(root)) {
      const id = el.dataset.flipId!;
      const to = now.get(id)!;
      const from = before.get(id);
      if (!from) {
        glides.current.set(id, el.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: EASE }));
        continue;
      }
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      glides.current.set(
        id,
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
          duration,
          easing: EASE,
        }),
      );
    }
  });

  return useRender({
    render: render ?? <div />,
    ref,
    props: {
      'data-slot': 'flip-group',
      className: cn(className),
      ...props,
    },
  });
}
