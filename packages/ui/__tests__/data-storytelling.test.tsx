/**
 * Data storytelling: the time slider's pure steps, its play button and
 * slider, and the scroll story's step watcher.
 */
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clampFrame, formatFrame, nextFrame, playStart } from '../src/charts/time-slider-model.js';
import { TimeSlider, MIN_VIEWPORT as SLIDER_MIN } from '../src/charts/time-slider.js';
import { ScrollStory, ScrollStoryStep, MIN_VIEWPORT as STORY_MIN } from '../src/patterns/scroll-story.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('time-slider-model', () => {
  it('clamps an index into the frames', () => {
    expect(clampFrame(-3, 5)).toBe(0);
    expect(clampFrame(9, 5)).toBe(4);
    expect(clampFrame(2.4, 5)).toBe(2);
    expect(clampFrame(Number.NaN, 5)).toBe(4);
    expect(clampFrame(3, 0)).toBe(0);
  });

  it('steps forward, stops at the end, or loops', () => {
    expect(nextFrame(0, 3)).toBe(1);
    expect(nextFrame(2, 3)).toBeNull();
    expect(nextFrame(2, 3, true)).toBe(0);
    expect(nextFrame(0, 1, true)).toBeNull();
    expect(nextFrame(0, 0)).toBeNull();
  });

  it('starts play from the first frame when on the last', () => {
    expect(playStart(4, 5)).toBe(0);
    expect(playStart(1, 5)).toBe(1);
  });

  it('prints numeric frames without grouping, in the locale', () => {
    expect(formatFrame(2024, 'en-US')).toBe('2024');
    expect(formatFrame(2024, 'ar-EG')).toBe('٢٠٢٤');
    expect(formatFrame('Q1 2024')).toBe('Q1 2024');
    expect(formatFrame(Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('TimeSlider', () => {
  const FRAMES = [2016, 2018, 2020];
  const chart = (frame: string | number, index: number) => <p data-testid="chart">{`${frame}:${index}`}</p>;

  it('renders the latest frame in the server HTML', () => {
    const html = renderToString(<TimeSlider frames={FRAMES} locale="en-US">{chart}</TimeSlider>);
    expect(html).toContain('2020:2');
    expect(html).toContain(`data-min-viewport="${SLIDER_MIN}"`);
    expect(html).toContain('data-state="paused"');
  });

  it('plays one frame at a time from the start, and stops on the last', () => {
    vi.useFakeTimers();
    const onValueChange = vi.fn();
    render(
      <TimeSlider frames={FRAMES} frameDuration={500} onValueChange={onValueChange} locale="en-US">
        {chart}
      </TimeSlider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    // On the last frame, play starts over from the first.
    expect(screen.getByTestId('chart').textContent).toBe('2016:0');
    expect(onValueChange).toHaveBeenLastCalledWith(0, 2016);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    // Quiet while playing.
    expect(screen.getByText('2016', { selector: 'output' }).getAttribute('aria-live')).toBe('off');

    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId('chart').textContent).toBe('2018:1');
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId('chart').textContent).toBe('2020:2');
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    expect(screen.getByText('2020', { selector: 'output' }).getAttribute('aria-live')).toBe('polite');
  });

  it('loops when asked, and pause stops the clock', () => {
    vi.useFakeTimers();
    render(
      <TimeSlider frames={FRAMES} defaultValue={1} frameDuration={300} loop>
        {chart}
      </TimeSlider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    act(() => vi.advanceTimersByTime(300));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByTestId('chart').textContent).toBe('2016:0');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByTestId('chart').textContent).toBe('2016:0');
  });

  it('never plays faster than 250ms a frame', () => {
    vi.useFakeTimers();
    render(
      <TimeSlider frames={FRAMES} defaultValue={0} frameDuration={10}>
        {chart}
      </TimeSlider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByTestId('chart').textContent).toBe('2016:0');
    act(() => vi.advanceTimersByTime(50));
    expect(screen.getByTestId('chart').textContent).toBe('2018:1');
  });

  it('follows a controlled value and names the slider by its frame', () => {
    render(
      <TimeSlider frames={FRAMES} value={1} labels={{ slider: 'Year', play: 'Start' }}>
        {chart}
      </TimeSlider>,
    );
    expect(screen.getByTestId('chart').textContent).toBe('2018:1');
    const slider = screen.getByRole('slider', { name: 'Year' });
    expect(slider.getAttribute('aria-valuetext')).toBe('2018');
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
  });

  it('a keyboard step on the slider moves the frame and stops play', () => {
    vi.useFakeTimers();
    render(
      <TimeSlider frames={FRAMES} defaultValue={0} frameDuration={1000}>
        {chart}
      </TimeSlider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(screen.getByTestId('chart').textContent).toBe('2020:2');
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('disables the controls with a single frame', () => {
    render(<TimeSlider frames={[2024]}>{chart}</TimeSlider>);
    expect(screen.getByTestId('chart').textContent).toBe('2024:0');
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('takes a custom frame printer', () => {
    render(
      <TimeSlider frames={['2023-24', '2024-25']} formatFrame={(f) => `Season ${f}`}>
        {chart}
      </TimeSlider>,
    );
    expect(screen.getByText('Season 2024-25', { selector: 'output' })).toBeTruthy();
  });
});

describe('ScrollStory', () => {
  let callback: IntersectionObserverCallback | undefined;
  const observed: Element[] = [];

  beforeEach(() => {
    callback = undefined;
    observed.length = 0;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb;
        }
        observe(el: Element) {
          observed.push(el);
        }
        disconnect() {}
        unobserve() {}
        takeRecords() {
          return [];
        }
      },
    );
  });

  const story = (onStepChange?: (step: number) => void) => (
    <ScrollStory graphic={(step) => <p data-testid="graphic">{`step ${step}`}</p>} onStepChange={onStepChange}>
      <ScrollStoryStep>First point.</ScrollStoryStep>
      <ScrollStoryStep>Second point.</ScrollStoryStep>
      <ScrollStoryStep>Third point.</ScrollStoryStep>
    </ScrollStory>
  );

  it('puts every step and the first chart in the server HTML', () => {
    const html = renderToString(story());
    expect(html).toContain('First point.');
    expect(html).toContain('Third point.');
    expect(html).toContain('step 0');
    expect(html).toContain(`data-min-viewport="${STORY_MIN}"`);
  });

  it('changes the chart when a step crosses the middle of the screen', () => {
    const onStepChange = vi.fn();
    render(story(onStepChange));
    expect(observed).toHaveLength(3);
    expect(screen.getByTestId('graphic').textContent).toBe('step 0');
    expect(observed[0]!.hasAttribute('data-active')).toBe(true);

    act(() =>
      callback?.([{ isIntersecting: true, target: observed[2] } as unknown as IntersectionObserverEntry], {} as IntersectionObserver),
    );
    expect(screen.getByTestId('graphic').textContent).toBe('step 2');
    expect(observed[2]!.hasAttribute('data-active')).toBe(true);
    expect(observed[0]!.hasAttribute('data-active')).toBe(false);
    expect(onStepChange).toHaveBeenCalledWith(2);

    // A step leaving the line changes nothing.
    act(() =>
      callback?.([{ isIntersecting: false, target: observed[1] } as unknown as IntersectionObserverEntry], {} as IntersectionObserver),
    );
    expect(screen.getByTestId('graphic').textContent).toBe('step 2');
    expect(onStepChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the first step without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(story());
    expect(screen.getByTestId('graphic').textContent).toBe('step 0');
  });

  it('puts the chart in the start column when asked', () => {
    const { container } = render(
      <ScrollStory side="start" graphic={() => null}>
        <ScrollStoryStep>One.</ScrollStoryStep>
      </ScrollStory>,
    );
    expect(container.querySelector('[data-slot="scroll-story"]')?.getAttribute('data-side')).toBe('start');
  });
});

describe('TimeSlider edges', () => {
  const chart = (frame: string | number) => <p data-testid="chart">{String(frame)}</p>;

  it('draws nothing and disables play without frames', () => {
    render(<TimeSlider frames={[]}>{chart}</TimeSlider>);
    expect(screen.queryByTestId('chart')).toBeNull();
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('falls back to 1200ms for a frame duration that is not a number', () => {
    vi.useFakeTimers();
    render(
      <TimeSlider frames={[1, 2]} defaultValue={0} frameDuration={Number.NaN}>
        {chart}
      </TimeSlider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    act(() => vi.advanceTimersByTime(1199));
    expect(screen.getByTestId('chart').textContent).toBe('1');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId('chart').textContent).toBe('2');
  });

  it('forwards its ref and reads a right-to-left page', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <div dir="rtl">
        {/* jsdom does not inherit computed direction, so the slider carries it here. */}
        <TimeSlider ref={ref} frames={[1, 2, 3]} style={{ direction: 'rtl' }}>
          {chart}
        </TimeSlider>
      </div>,
    );
    expect(ref.current?.getAttribute('data-slot')).toBe('time-slider');
    // In a right-to-left page, ArrowLeft moves forward in time.
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(screen.getByTestId('chart').textContent).toBe('1');
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(screen.getByTestId('chart').textContent).toBe('2');
  });
});
