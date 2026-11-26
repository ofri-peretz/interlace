'use client';

/**
 * @interlace/ui — RotatingText
 *
 * One word in a headline that changes every few seconds ("Build for
 * [teams / founders / students]"). It is a familiar pattern done carefully:
 * the line never jumps, a screen reader hears the sentence once, and the
 * reader can stop it.
 *
 * ## No layout shift
 *
 * Every word is rendered into the same grid cell, and only the current one
 * is visible. The cell is therefore as wide as the widest word from the
 * first paint, so the sentence around it never reflows (CLS 0), and the
 * server HTML already has the right width.
 *
 * ## Accessibility
 *
 * The rotating words are `aria-hidden`. Assistive tech reads one stable
 * label instead (by default the words joined, "teams, founders or
 * students"), so nothing is announced every few seconds. Rotation pauses
 * while the pointer is over the words or focus is inside them, and while
 * the tab is hidden. Under `prefers-reduced-motion: reduce` the first word
 * stays and nothing rotates.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `span` props, minus children                          |
 * | R6   | data-slot per part      | rotating-text / -word                                 |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R23  | CLS=0                   | all words share one grid cell                         |
 * | R25  | Client component        | timers and `Element.animate`                          |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { motionEase } from '../lib/motion-token.js';

export interface RotatingTextProps
  extends Omit<React.ComponentPropsWithoutRef<'span'>, 'children'> {
  /** The words to cycle through, in order. */
  words: readonly string[];
  /** Milliseconds each word stays, at least 1000 so every word can be read. @default 2800 */
  interval?: number;
  /** What assistive tech reads instead of the moving words. @default the words, joined with "or" */
  label?: string;
  /** Pause while hovered or focused. @default true */
  pauseOnHover?: boolean;
  /** Called with the index of the word now showing. */
  onIndexChange?: (index: number) => void;
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
}

export function RotatingText({
  words,
  interval = 2800,
  label,
  pauseOnHover = true,
  onIndexChange,
  className,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...props
}: RotatingTextProps) {
  const [index, setIndex] = React.useState(0);
  const [held, setHeld] = React.useState(false);
  const reduced = useReducedMotion();
  const wordRefs = React.useRef<Array<HTMLSpanElement | null>>([]);
  const changeRef = React.useRef(onIndexChange);
  changeRef.current = onIndexChange;

  const rotating = words.length > 1 && !reduced && !(pauseOnHover && held);

  React.useEffect(() => {
    if (!rotating) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((i) => (i + 1) % words.length);
    }, Math.max(1000, interval));
    return () => window.clearInterval(id);
  }, [rotating, interval, words.length]);

  // Entrance for the word that just became current. Skipped on mount, so
  // the server-rendered first word does not animate in.
  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    changeRef.current?.(index);
    const node = wordRefs.current[index];
    if (reduced || !node || typeof node.animate !== 'function') return;
    node.animate(
      [
        { opacity: 0, transform: 'translateY(0.35em)', filter: 'blur(3px)' },
        { opacity: 1, transform: 'none', filter: 'none' },
      ],
      { duration: 320, easing: motionEase(node, 'enter') },
    );
  }, [index, reduced]);

  const current = index % Math.max(words.length, 1);

  return (
    <span
      data-slot="rotating-text"
      className={cn('inline-grid align-baseline', className)}
      onPointerEnter={(e) => {
        setHeld(true);
        onPointerEnter?.(e);
      }}
      onPointerLeave={(e) => {
        setHeld(false);
        onPointerLeave?.(e);
      }}
      onFocus={(e) => {
        setHeld(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setHeld(false);
        onBlur?.(e);
      }}
      {...props}
    >
      <span className="sr-only">{label ?? joinWords(words)}</span>
      {words.map((word, i) => (
        <span
          key={`${i}-${word}`}
          ref={(node) => {
            wordRefs.current[i] = node;
          }}
          aria-hidden
          data-slot="rotating-text-word"
          data-current={i === current ? '' : undefined}
          className={cn('col-start-1 row-start-1', i === current ? 'visible' : 'invisible')}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
