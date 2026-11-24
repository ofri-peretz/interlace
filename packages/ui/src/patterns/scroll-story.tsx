'use client';

/**
 * @interlace/ui — ScrollStory
 *
 * A chart that stays in view while the story beside it scrolls: each step of
 * text the reader reaches changes the chart, one point at a time. The story
 * is told in the steps; the chart shows it.
 *
 *   <ScrollStory graphic={(step) => <DotPlot series={SERIES[step]} rows={rows} />}>
 *     <ScrollStoryStep>In 2014, most districts were under 20%.</ScrollStoryStep>
 *     <ScrollStoryStep>Ten years on, every one of them rose.</ScrollStoryStep>
 *     <ScrollStoryStep>The biggest change came where it started lowest.</ScrollStoryStep>
 *   </ScrollStory>
 *
 * ## Steps, not scroll position
 *
 * The chart changes when a step crosses the middle of the screen, and only
 * then: it is never tied to how far the page has scrolled, so there is no
 * scroll-linked motion, nothing moves while the reader holds still, and
 * scrolling back up steps back. `graphic(step)` draws the chart for a step;
 * how it moves from one to the next is the chart's own business, so it
 * follows the chart's own reduced-motion rules.
 *
 * ## Content first
 *
 * Every step's text is in the server HTML, in reading order, and the chart
 * is drawn for the first step. Without scripts the reader gets the whole
 * story and the opening chart. Write each step so it says its point in
 * words: a screen reader reads the steps in order and does not watch the
 * chart change, so the text is the story for them.
 *
 * ## Layout by container
 *
 * When the story's own box is 48rem or wider, the steps and the chart sit
 * side by side and the chart stays put in its column (`side` picks which
 * column, start or end, and follows the page's direction). Narrower, the
 * chart stays at the top of the screen and the steps pass over it as cards.
 * Each step is a screen tall, so one step is read at a time. A page with
 * its own sticky header sets `--scroll-story-offset` to that header's
 * height, and the chart sits below it.
 *
 * ## MIN_VIEWPORT — 320
 *
 * ## Anatomy
 *
 *   <div data-slot="scroll-story" data-step={n} data-side="start|end">
 *     <div data-slot="scroll-story-graphic">{graphic(step)}</div>      (sticky)
 *     <div data-slot="scroll-story-steps">
 *       <div data-slot="scroll-story-step" data-active?>               (a screen tall)
 *         <div data-slot="scroll-story-card">{children}</div>
 *       </div> × steps
 *     </div>
 *   </div>
 *
 * | Rule | Concept                   | Where in this file                                     |
 * | ---- | ------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                          |
 * | R6   | data-slot per part        | scroll-story / -graphic / -steps / -step / -card       |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                      |
 * | R8   | Enums, not booleans       | `side`                                                 |
 * | R10  | Composition seam          | `graphic(step)` draws any chart; steps hold any content |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                   |
 * | R18  | Tailwind only             | zero inline `style`                                    |
 * | R19  | Tokens only               | card, border, primary, background                      |
 * | R25  | Client component          | the step watcher (IntersectionObserver) runs in the browser |
 * | R26  | A11y                      | steps in reading order, active step not shown by colour alone (`data-active`, border weight) |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

type StoryContext = { active: number };

const StoryContext = React.createContext<StoryContext>({ active: 0 });
const StepIndex = React.createContext(-1);

export interface ScrollStoryProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  /** Draws the chart for a step, counted from 0. */
  graphic: (step: number) => React.ReactNode;
  /** The steps, each a `ScrollStoryStep`, in reading order. */
  children: React.ReactNode;
  /** Which column the chart takes when there is room for two. @default 'end' */
  side?: 'start' | 'end';
  /** Called when a new step becomes the active one. */
  onStepChange?: (step: number) => void;
}

export const ScrollStory = React.forwardRef<HTMLDivElement, ScrollStoryProps>(function ScrollStory(
  { graphic, children, side = 'end', onStepChange, className, ...props },
  ref,
) {
  const [active, setActive] = React.useState(0);
  const stepsRef = React.useRef<HTMLDivElement>(null);
  const notify = React.useRef(onStepChange);
  notify.current = onStepChange;

  const steps = React.Children.toArray(children);
  const count = steps.length;

  // A step is active while it covers the middle line of the screen. The steps
  // are a screen tall and stacked, so one of them always does once the story
  // is under way; before the first one arrives, the first step stays active.
  React.useEffect(() => {
    const root = stepsRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const at = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isInteger(at)) setActive(at);
        }
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    );
    root.querySelectorAll<HTMLElement>('[data-slot="scroll-story-step"]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [count]);

  const step = Math.min(active, Math.max(0, count - 1));
  const context = React.useMemo(() => ({ active: step }), [step]);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    notify.current?.(step);
  }, [step]);

  return (
    <div
      ref={ref}
      data-slot="scroll-story"
      data-step={step}
      data-side={side}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container/story', className)}
      {...props}
    >
      <div
        className={cn(
          'grid grid-cols-1 @3xl/story:gap-10',
          side === 'end'
            ? '@3xl/story:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'
            : '@3xl/story:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]',
        )}
      >
        <div
          data-slot="scroll-story-graphic"
          className={cn(
            'bg-background sticky top-[var(--scroll-story-offset,0px)] z-0 py-4 @3xl/story:row-start-1 @3xl/story:flex @3xl/story:min-h-[calc(100svh-var(--scroll-story-offset,0px))] @3xl/story:flex-col @3xl/story:justify-center @3xl/story:self-start',
            side === 'end' ? '@3xl/story:col-start-2' : '@3xl/story:col-start-1',
          )}
        >
          {graphic(step)}
        </div>

        <div
          ref={stepsRef}
          data-slot="scroll-story-steps"
          className={cn(
            'relative z-10 flex flex-col @3xl/story:row-start-1',
            side === 'end' ? '@3xl/story:col-start-1' : '@3xl/story:col-start-2',
          )}
        >
          <StoryContext.Provider value={context}>
            {steps.map((child, i) => (
              <StepIndex.Provider key={React.isValidElement(child) && child.key != null ? child.key : i} value={i}>
                {child}
              </StepIndex.Provider>
            ))}
          </StoryContext.Provider>
        </div>
      </div>
    </div>
  );
});
ScrollStory.displayName = 'ScrollStory';

export interface ScrollStoryStepProps extends React.ComponentProps<'div'> {}

/** One step of a `ScrollStory`: the text that goes with one state of the chart. */
export const ScrollStoryStep = React.forwardRef<HTMLDivElement, ScrollStoryStepProps>(function ScrollStoryStep(
  { className, children, ...props },
  ref,
) {
  const index = React.useContext(StepIndex);
  const { active } = React.useContext(StoryContext);
  const isActive = index === active;
  return (
    <div
      ref={ref}
      data-slot="scroll-story-step"
      data-index={index}
      data-active={isActive ? '' : undefined}
      className="flex min-h-[calc(100svh-var(--scroll-story-offset,0px))] flex-col justify-center py-10"
    >
      <div
        data-slot="scroll-story-card"
        className={cn(
          'bg-card text-card-foreground rounded-lg border p-6 shadow-sm',
          'border-s-4 motion-safe:transition-colors motion-safe:duration-(--duration-base) motion-safe:ease-enter',
          isActive ? 'border-s-primary' : 'border-s-border',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
});
ScrollStoryStep.displayName = 'ScrollStoryStep';
