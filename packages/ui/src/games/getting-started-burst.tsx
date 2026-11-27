'use client';

/**
 * @interlace/ui — GettingStartedBurst
 *
 * The short burst behind `celebrate="full"`: 16 small marks that fly out from the middle once, on
 * transform and opacity only, in 1.2 seconds, never looping and never flashing. It is lazy-loaded
 * and `GettingStarted` does not mount it under reduced motion at all, so the finish is then the
 * banner in words and nothing else. It is hidden from assistive technology and never takes a click.
 */

import * as React from 'react';

import { motionEase } from '../lib/motion-token.js';

const MARKS = 16;
const DURATION_MS = 1200;

export default function GettingStartedBurst() {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const root = ref.current;
    if (!root || typeof root.animate !== 'function') return;
    const easing = motionEase(root, 'enter');
    const animations = Array.from(root.children).map((mark, i) => {
      const angle = (i / MARKS) * Math.PI * 2;
      const distance = 56 + (i % 3) * 18;
      return (mark as HTMLElement).animate(
        [
          { transform: 'translate(0, 0) scale(0.6)', opacity: 1 },
          { transform: `translate(${Math.round(Math.cos(angle) * distance)}px, ${Math.round(Math.sin(angle) * distance)}px) scale(1)`, opacity: 0 },
        ],
        { duration: DURATION_MS, easing, fill: 'forwards' },
      );
    });
    return () => animations.forEach((a) => a.cancel());
  }, []);
  return (
    <span
      ref={ref}
      aria-hidden
      data-slot="getting-started-burst"
      className="pointer-events-none absolute inset-0 flex items-center justify-center forced-colors:hidden"
    >
      {Array.from({ length: MARKS }, (_, i) => (
        <span
          key={i}
          className={`absolute size-2 rounded-full ${i % 2 ? 'bg-primary' : 'bg-accent-foreground'} opacity-0`}
        />
      ))}
    </span>
  );
}
