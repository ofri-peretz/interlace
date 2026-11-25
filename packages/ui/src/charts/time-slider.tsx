'use client';

/**
 * @interlace/ui — TimeSlider
 *
 * Step a chart through time: a play button, a slider with one stop per
 * frame (a year, a survey wave, a season), and the current frame printed
 * large beside them. Any chart goes inside: the slider owns which frame is
 * showing, and the chart is drawn for that frame by a render function.
 *
 *   <TimeSlider frames={[2016, 2018, 2020, 2022, 2024]}>
 *     {(year) => <ShareChart categories={…} rows={rowsFor(year)} />}
 *   </TimeSlider>
 *
 * ## Content first
 *
 * The server HTML holds the chart for the opening frame (`defaultValue`,
 * the latest frame unless you say otherwise), so a reader without scripts,
 * a search engine and a screenshot all get a whole chart. The controls work
 * once scripts load.
 *
 * ## Play
 *
 * Play steps one frame every `frameDuration` ms (1200 by default) and
 * stops on the last frame, or starts over with `loop`. Pressed on the last
 * frame, it starts from the first, so play always shows a change. Nothing
 * plays on its own: the reader starts it, the same button stops it (WCAG
 * 2.2.2), and touching the slider stops it too. Under reduced motion play
 * still steps, because a step is a change of data the reader asked for,
 * not an animation; the chart inside decides how it draws the new frame.
 *
 * ## Words for every reader
 *
 * The slider's thumb speaks the frame ("2020"), not its index. The printed
 * frame is a polite live region while paused, so a keyboard step is
 * announced; while playing it is quiet, so a screen reader is not talked
 * over once a second, and the frame it stops on is announced. Every fixed
 * word comes from `labels`, and numbers print in `locale` without grouping
 * (`formatFrame` in `time-slider-model.ts`, which is pure and exported with
 * `nextFrame`, `playStart` and `clampFrame`).
 *
 * ## Right to left
 *
 * The slider reads the page's direction once it mounts and hands it to Base
 * UI, so in a right-to-left page time runs from right to left, the arrow
 * keys follow it, and the ends swap sides with it.
 *
 * ## MIN_VIEWPORT — 320
 *
 * One row: button, slider, frame. The first and last frames sit under the
 * rail's ends. A tick marks every stop while there are 40 or fewer.
 *
 * ## Anatomy
 *
 *   <div data-slot="time-slider" data-state="playing|paused">
 *     <div data-slot="time-slider-stage">{children(frame, index)}</div>
 *     <div data-slot="time-slider-controls">
 *       <Button data-slot="time-slider-play" />               (Play / Pause)
 *       <div data-slot="time-slider-scale">
 *         <Slider />                                           (one stop per frame)
 *         <div data-slot="time-slider-ticks" aria-hidden />
 *         <div data-slot="time-slider-ends" aria-hidden />     (first and last frame)
 *       </div>
 *       <output data-slot="time-slider-value" />               (the current frame)
 *     </div>
 *   </div>
 *
 * | Rule | Concept                   | Where in this file                                       |
 * | ---- | ------------------------- | -------------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                            |
 * | R6   | data-slot per part        | time-slider / -stage / -controls / -play / -scale / -ticks / -ends / -value |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                        |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onValueChange`               |
 * | R10  | Composition seam          | `children(frame, index)` draws any chart                 |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                     |
 * | R18  | Tailwind only             | zero inline `style`                                      |
 * | R19  | Tokens only               | primary, input, border, muted-foreground                 |
 * | R25  | Client component          | play timing and the slider run in the browser            |
 * | R26  | A11y                      | labelled slider with value text, named play button, quiet live region while playing |
 */

import * as React from 'react';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Pause, Play } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from '../primitives/slider.js';
import { clampFrame, formatFrame, nextFrame, playStart, type TimeFrame } from './time-slider-model.js';

export { clampFrame, formatFrame, nextFrame, playStart, type TimeFrame } from './time-slider-model.js';

export const MIN_VIEWPORT = 320 as const;

/** Ticks are drawn for every stop up to this many frames; past it the rail alone reads better. */
const MAX_TICKS = 40;
/** The fastest play allowed, so a frame is on screen long enough to read. */
const MIN_FRAME_MS = 250;

export type TimeSliderLabels = {
  /** The play button's name while paused. */
  play: string;
  /** The play button's name while playing. */
  pause: string;
  /** The slider's name. Name what the frames are, such as "Year". */
  slider: string;
};

const LABELS: TimeSliderLabels = {
  play: 'Play',
  pause: 'Pause',
  slider: 'Time',
};

export interface TimeSliderProps extends Omit<React.ComponentProps<'div'>, 'children' | 'defaultValue'> {
  /** The frames, in time order: years, dates, waves. */
  frames: readonly TimeFrame[];
  /** Draws the chart for a frame. */
  children: (frame: TimeFrame, index: number) => React.ReactNode;
  /** The showing frame's index (controlled). */
  value?: number;
  /** The opening frame's index. @default the last frame */
  defaultValue?: number;
  /** Called with the new index and its frame on every step: slider, keys or play. */
  onValueChange?: (index: number, frame: TimeFrame) => void;
  /** How long each frame shows while playing, in ms. At least 250. @default 1200 */
  frameDuration?: number;
  /** Start over from the first frame after the last one while playing. @default false */
  loop?: boolean;
  /** A BCP 47 locale for numeric frames. @default the reader's */
  locale?: string;
  /** Print a frame yourself, such as a date range. @default `formatFrame` */
  formatFrame?: (frame: TimeFrame) => string;
  /** Fixed words, for pages in another language. */
  labels?: Partial<TimeSliderLabels>;
}

export const TimeSlider = React.forwardRef<HTMLDivElement, TimeSliderProps>(function TimeSlider(
  {
    frames,
    children,
    value,
    defaultValue,
    onValueChange,
    frameDuration = 1200,
    loop = false,
    locale,
    formatFrame: formatProp,
    labels: labelsProp,
    className,
    ...props
  },
  ref,
) {
  const labels = { ...LABELS, ...labelsProp };
  const count = frames.length;
  const [own, setOwn] = React.useState(() => clampFrame(defaultValue ?? count - 1, count));
  const index = clampFrame(value ?? own, count);
  const [playing, setPlaying] = React.useState(false);
  const [direction, setDirection] = React.useState<'ltr' | 'rtl'>('ltr');
  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);

  const print = React.useCallback(
    (frame: TimeFrame) => (formatProp ? formatProp(frame) : formatFrame(frame, locale)),
    [formatProp, locale],
  );

  // The latest callback and frames, read by the play timer without restarting it.
  const latest = React.useRef({ onValueChange, frames });
  latest.current = { onValueChange, frames };

  const go = React.useCallback((next: number) => {
    const { frames: all, onValueChange: notify } = latest.current;
    const at = clampFrame(next, all.length);
    setOwn(at);
    // Only the controls call this, and they are disabled without frames.
    notify?.(at, all[at] as TimeFrame);
  }, []);

  // The page's direction decides which way time runs. Read after mount: the
  // server cannot know it, and the first paint is the same either way.
  React.useLayoutEffect(() => {
    setDirection(getComputedStyle(rootRef.current as HTMLDivElement).direction === 'rtl' ? 'rtl' : 'ltr');
  }, []);

  // One timeout per frame (not an interval), so a slow render never queues
  // steps, and pausing is just not scheduling the next one.
  const duration = Math.max(MIN_FRAME_MS, Number.isFinite(frameDuration) ? frameDuration : 1200);
  React.useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      const next = nextFrame(index, count, loop);
      if (next === null) setPlaying(false);
      else go(next);
    }, duration);
    return () => window.clearTimeout(id);
  }, [playing, index, count, loop, duration, go]);

  // Stop when the frames run out under a playing slider.
  React.useEffect(() => {
    if (count <= 1) setPlaying(false);
  }, [count]);

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    const start = playStart(index, count);
    if (start !== index) go(start);
    setPlaying(true);
  };

  const frame = frames[index];
  const current = frame === undefined ? '' : print(frame);
  // Read only when there are two frames or more.
  const first = frames[0] as TimeFrame;
  const last = frames[count - 1] as TimeFrame;

  return (
    <div
      ref={rootRef}
      data-slot="time-slider"
      data-state={playing ? 'playing' : 'paused'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex flex-col gap-4', className)}
      {...props}
    >
      <div data-slot="time-slider-stage" className="min-w-0">
        {frame === undefined ? null : children(frame, index)}
      </div>

      <div data-slot="time-slider-controls" className="flex items-center gap-4">
        <Button
          type="button"
          data-slot="time-slider-play"
          variant="outline"
          size="icon"
          aria-label={playing ? labels.pause : labels.play}
          disabled={count <= 1}
          onClick={toggle}
        >
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
        </Button>

        <div data-slot="time-slider-scale" className="flex min-w-0 flex-1 flex-col gap-1">
          <DirectionProvider direction={direction}>
            <Slider
              value={index}
              min={0}
              max={Math.max(1, count - 1)}
              step={1}
              disabled={count <= 1}
              onValueChange={(v) => {
                setPlaying(false);
                // One thumb, so Base UI hands back a number.
                go(v as number);
              }}
            >
              <SliderControl className="h-control-xs">
                <SliderTrack>
                  <SliderIndicator />
                </SliderTrack>
                <SliderThumb aria-label={labels.slider} getAriaValueText={() => current} />
              </SliderControl>
            </Slider>
          </DirectionProvider>
          {count > 1 && count <= MAX_TICKS ? (
            <div data-slot="time-slider-ticks" aria-hidden className="flex justify-between">
              {frames.map((f, i) => (
                <span
                  key={`${String(f)}-${i}`}
                  className={cn('h-1.5 w-px', i <= index ? 'bg-primary' : 'bg-input')}
                />
              ))}
            </div>
          ) : null}
          {count > 1 ? (
            <div
              data-slot="time-slider-ends"
              aria-hidden
              className="flex justify-between gap-2 text-sm tabular-nums text-muted-foreground"
            >
              <span>{print(first)}</span>
              <span>{print(last)}</span>
            </div>
          ) : null}
        </div>

        <output
          data-slot="time-slider-value"
          aria-live={playing ? 'off' : 'polite'}
          className="min-w-[4ch] text-end text-lg font-semibold tabular-nums"
        >
          {current}
        </output>
      </div>
    </div>
  );
});
TimeSlider.displayName = 'TimeSlider';
