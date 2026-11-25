'use client';

/**
 * @interlace/ui — ScrollText
 *
 * A statement that the reader brings into focus by scrolling: its words go
 * from the muted text colour to the full one, in reading order, as the
 * paragraph moves up the screen. For one large sentence a page is built
 * around (a mission, a finding, a promise), not for body copy.
 *
 * ## Content first
 *
 * The sentence is in the server HTML once, as plain text, for a screen reader
 * and a crawler. The word-by-word copy is `aria-hidden`. Every word is always
 * readable: it starts at `--muted-foreground`, which already meets AA contrast
 * on the page, and ends at `--foreground`. Nothing fades from invisible.
 *
 * ## Motion
 *
 * The reader is the timeline. Each word gets one Web Animations API colour
 * animation on a `ViewTimeline`, so the browser drives it from the scroll
 * position off the main thread, with no scroll listener and no keyframes to
 * add. Words share the range between `start` and `end` (percentages of the
 * paragraph's pass through the viewport), so the colour runs through the
 * sentence like a reader's eye. Without `ViewTimeline`, or under
 * `prefers-reduced-motion: reduce`, the sentence is simply in full colour.
 *
 * ## Composition
 *
 *   ScrollText                          (p by default — data-slot="scroll-text")
 *     ├─ text                           (sr-only, the sentence once)
 *     └─ visual                         (aria-hidden — data-slot="scroll-text-visual")
 *         └─ word × n                   (data-slot="scroll-text-word")
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `as` element props                                   |
 * | R6   | data-slot per part      | scroll-text / -visual / -word                        |
 * | R7   | cn + ...rest            | `cn(className)` + `{...props}`                       |
 * | R19  | Tokens only             | `--muted-foreground` → `--foreground`                |
 * | R25  | Client component        | the timeline is built in the browser                 |
 * | R26  | A11y                    | read once; every word always at AA contrast          |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

type ScrollTextElement = 'p' | 'h1' | 'h2' | 'h3' | 'blockquote' | 'div';

export interface ScrollTextProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** The sentence, as plain text. */
  children: string;
  /** The element to render. @default 'p' */
  as?: ScrollTextElement;
  /** Where the first word starts to fill, as a percentage of the paragraph's pass through the viewport. @default 20 */
  start?: number;
  /** Where the last word is full, as a percentage of that pass. @default 60 */
  end?: number;
}

interface ViewTimelineLike {
  new (options: { subject: Element; axis?: 'block' | 'inline' }): AnimationTimeline;
}

function viewTimeline(): ViewTimelineLike | undefined {
  return (globalThis as { ViewTimeline?: ViewTimelineLike }).ViewTimeline;
}

export function ScrollText({ children, as: Tag = 'p', start = 20, end = 60, className, ...props }: ScrollTextProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);
  const words = children.split(/(\s+)/);

  React.useLayoutEffect(() => {
    const el = ref.current;
    const Timeline = viewTimeline();
    if (!el || reduced || !Timeline || typeof el.animate !== 'function') return;
    el.dataset.live = '';
    const pieces = Array.from(el.querySelectorAll<HTMLElement>('[data-slot="scroll-text-word"]'));
    const timeline = new Timeline({ subject: el, axis: 'block' });
    const from = Math.max(0, Math.min(100, start));
    const to = Math.max(from, Math.min(100, end));
    const step = pieces.length > 0 ? (to - from) / pieces.length : 0;
    const animations = pieces.map((piece, i) =>
      // var() keyframes stay live, so a theme switch mid-page recolours the sentence.
      piece.animate([{ color: 'var(--muted-foreground)' }, { color: 'var(--foreground)' }], {
        fill: 'both',
        easing: 'linear',
        timeline,
        rangeStart: `cover ${from + i * step}%`,
        rangeEnd: `cover ${from + (i + 1) * step}%`,
      } as KeyframeAnimationOptions),
    );
    return () => {
      delete el.dataset.live;
      for (const a of animations) a.cancel();
    };
  }, [reduced, start, end, children]);

  return (
    <Tag ref={ref as React.Ref<never>} data-slot="scroll-text" className={cn(className)} {...props}>
      <span className="sr-only">{children}</span>
      <span data-slot="scroll-text-visual" aria-hidden="true">
        {words.map((word, i) => {
          if (word === '') return null;
          if (/^\s+$/.test(word)) return word;
          return (
            <span key={`${i}-${word}`} data-slot="scroll-text-word">
              {word}
            </span>
          );
        })}
      </span>
    </Tag>
  );
}
