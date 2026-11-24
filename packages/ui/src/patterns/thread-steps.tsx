'use client';

/**
 * @interlace/ui — ThreadSteps
 *
 * An ordered sequence held together by Interlace's woven thread: a knot for
 * each step, and two strands that cross between one knot and the next. The
 * strands draw in as the reader reaches each step, so the motion says one
 * thing only: this leads to that.
 *
 * Built for "how it works", "how we checked this", a process, a short
 * history. Give steps a `state` and the same list becomes a progress
 * tracker: complete steps are woven, the current step's knot is ringed, and
 * the thread ahead of it is a loose, dotted strand that has not been woven
 * yet.
 *
 * ## Anatomy
 *
 *   ThreadSteps                       (ol — data-min-viewport=320)
 *     └─ ThreadStep × n               (li — aria-current="step" when current)
 *         ├─ knot                     (span — the step's marker)
 *         ├─ strand                   (svg, aria-hidden — to the next knot; none after the last)
 *         ├─ title                    (p — font-medium)
 *         ├─ state text               (sr-only "Complete" / "Current step" / "Not started")
 *         └─ children                 (div — the step in words)
 *
 * ## States
 *
 * | `state`     | Knot                 | Strand to the next step          |
 * | ----------- | -------------------- | -------------------------------- |
 * | (none)      | filled               | woven (two strands crossing)     |
 * | `complete`  | filled               | woven                            |
 * | `current`   | ringed               | loose (one dotted strand)        |
 * | `upcoming`  | hollow               | loose                            |
 *
 * The state is also in words for assistive tech, so colour and shape only
 * repeat what the text says.
 *
 * ## Motion
 *
 * The woven strands are in the server HTML, fully drawn. On the client,
 * before paint, they are hidden and then drawn top to bottom when the step
 * scrolls into view: the draw verb's clip mechanism (600ms, a `clip-path`
 * inset opening downward, Web Animations API), as `weave-reveal` does for
 * TimeSeries. Not stroke-dashoffset: the strand box stretches with the step,
 * and Chromium measures dashes on a non-scaling stroke in screen pixels,
 * ignoring `pathLength` (see InterlaceWeave), so a tall step would draw as
 * dashes. Under `prefers-reduced-motion: reduce`, without
 * IntersectionObserver, or without JavaScript, the strands are simply there.
 * Loose strands never move: there is nothing to explain yet.
 *
 * ## MIN_VIEWPORT — 320
 *
 * A 1.5rem gutter and a text column that wraps; nothing has a fixed width.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `ol` / `li` props                                           |
 * | R6   | data-slot per part               | thread-steps / thread-step / -knot / -strand                |
 * | R7   | cn + ...rest                     | `cn(…, className)` + `{...props}`                           |
 * | R8   | Enums, not booleans              | `state`                                                     |
 * | R14  | Declares min viewport            | `data-min-viewport` on the root + exported const            |
 * | R19  | Tokens only                      | `stroke-strand-a/-b`, `bg-primary`, `border-border`         |
 * | R25  | Client component                 | the draw-in needs IntersectionObserver + `Element.animate`  |
 * | R26  | A11y from native el              | A real ordered list; `aria-current="step"`; state in words  |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export const MIN_VIEWPORT = 320 as const;

export type ThreadStepState = 'complete' | 'current' | 'upcoming';

const STATE_TEXT: Record<ThreadStepState, string> = {
  complete: 'Complete',
  current: 'Current step',
  upcoming: 'Not started',
};

const KNOT: Record<ThreadStepState | 'none', string> = {
  none: 'border-primary bg-primary',
  complete: 'border-primary bg-primary',
  current: 'border-primary bg-background ring-primary/30 ring-4',
  upcoming: 'border-border bg-background',
};

/** Two strands that leave a knot together, cross, and meet at the next one. */
const WOVEN = ['M6 0 C0 33, 12 67, 6 100', 'M6 0 C12 33, 0 67, 6 100'] as const;

const HIDDEN = 'inset(0 0 100% 0)';
const SHOWN = 'inset(0 0 0 0)';

function ThreadSteps({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="thread-steps"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('m-0 list-none p-0', className)}
      {...props}
    />
  );
}

type ThreadStepProps = Omit<React.ComponentProps<'li'>, 'title'> & {
  /** What happens in this step, in a few words. */
  title: React.ReactNode;
  /**
   * Where the reader is in the sequence. Leave it out for a plain sequence
   * ("how it works"); set it on every step for a progress tracker.
   */
  state?: ThreadStepState;
};

function ThreadStep({ title, state, className, children, ...props }: ThreadStepProps) {
  const ref = React.useRef<HTMLLIElement>(null);
  const reduced = useReducedMotion();
  const woven = state === undefined || state === 'complete';

  // Before paint: hide the woven strands, then draw them when the step is
  // reached. The server HTML keeps them drawn, so nothing depends on this.
  React.useLayoutEffect(() => {
    const step = ref.current;
    if (!step || !woven || reduced) return;
    if (typeof IntersectionObserver === 'undefined') return;
    // The last step has no strand on screen (`group-last/step:hidden`). Leave
    // it alone, so a step appended later shows its strand drawn, not clipped.
    if (step.matches(':last-child')) return;
    const strand = step.querySelector<HTMLElement>('[data-slot="thread-step-strand"]')!;
    if (typeof strand.animate !== 'function') return;
    strand.style.clipPath = HIDDEN;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        strand.style.clipPath = '';
        strand.animate([{ clipPath: HIDDEN }, { clipPath: SHOWN }], {
          duration: 600,
          easing: 'ease-out',
          fill: 'backwards',
        });
      },
      { threshold: 0.4 },
    );
    io.observe(step);
    return () => {
      io.disconnect();
      strand.style.clipPath = '';
      for (const a of strand.getAnimations?.() ?? []) a.cancel();
    };
  }, [woven, reduced]);

  return (
    <li
      ref={ref}
      data-slot="thread-step"
      data-state={state}
      aria-current={state === 'current' ? 'step' : undefined}
      className={cn(
        'group/step relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 pb-8 last:pb-0',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="flex justify-center pt-1.5">
        <span
          data-slot="thread-step-knot"
          className={cn('size-3 rounded-full border-2', KNOT[state ?? 'none'])}
        />
      </span>
      {/* The box sizes the strand: an <svg> is a replaced element, so
          top + bottom alone would leave it at its intrinsic height. */}
      <span
        data-slot="thread-step-strand"
        aria-hidden
        className="pointer-events-none absolute top-6 bottom-0 start-0 w-6 group-last/step:hidden"
      >
        <svg
          viewBox="0 0 12 100"
          preserveAspectRatio="none"
          fill="none"
          className="block size-full"
          aria-hidden
          focusable="false"
        >
          {woven ? (
            WOVEN.map((d, i) => (
              <path
                key={d}
                d={d}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                className={i === 0 ? 'stroke-strand-a' : 'stroke-strand-b'}
              />
            ))
          ) : (
            <path
              d="M6 0 L6 100"
              strokeWidth={1.5}
              strokeDasharray="2 4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="stroke-muted-foreground opacity-50"
            />
          )}
        </svg>
      </span>
      <div className="col-start-2 min-w-0 space-y-1">
        <p className="font-medium leading-6">
          {title}
          {state ? <span className="sr-only">{` (${STATE_TEXT[state]})`}</span> : null}
        </p>
        {children ? (
          <div className="text-muted-foreground text-sm leading-relaxed">{children}</div>
        ) : null}
      </div>
    </li>
  );
}

const ThreadStepsWithDot = Object.assign(ThreadSteps, { Step: ThreadStep });

export { ThreadStepsWithDot as ThreadSteps, ThreadStep };
export type { ThreadStepProps };
