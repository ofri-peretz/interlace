/**
 * RoomClock: minutes and seconds to a host timestamp, spoken sparingly and only when it sees a mark
 * crossed.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoomClock } from '../src/games/room-clock.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const T0 = 1_700_000_000_000;
const said = () => document.querySelector('[data-slot="room-clock-announce"]')!.textContent;
const value = () => document.querySelector('[data-slot="room-clock-value"]')!.textContent;
const state = () => screen.getByRole('timer').getAttribute('data-state');

function setup(secondsLeft: number | null, props: Partial<React.ComponentProps<typeof RoomClock>> = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  return render(<RoomClock endsAt={secondsLeft === null ? null : T0 + secondsLeft * 1000} now={Date.now} {...props} />);
}

describe('RoomClock', () => {
  it('shows minutes and seconds, named, and a timer role', () => {
    setup(462);
    expect(screen.getByRole('timer', { name: 'Time left' })).toBeTruthy();
    expect(value()).toBe('7:42');
    expect(state()).toBe('running');
  });

  it('counts down each second, turns low under ten seconds, and writes time up in words', () => {
    setup(12);
    expect(value()).toBe('0:12');
    act(() => void vi.advanceTimersByTime(3100));
    expect(value()).toBe('0:09');
    expect(state()).toBe('low');
    act(() => void vi.advanceTimersByTime(9100));
    expect(value()).toBe("Time's up");
    expect(state()).toBe('done');
  });

  it('says there is no timer when there is none', () => {
    setup(null);
    expect(value()).toBe('No timer');
    expect(state()).toBe('idle');
  });

  it('speaks a minute left, ten seconds left and time up, each once, as they are crossed', () => {
    setup(75);
    expect(said()).toBe('');
    act(() => void vi.advanceTimersByTime(15_100));
    expect(said()).toBe('1 minute left');
    act(() => void vi.advanceTimersByTime(30_000));
    expect(said()).toBe('1 minute left'); // nothing new in between
    act(() => void vi.advanceTimersByTime(21_000));
    expect(said()).toBe('10 seconds left');
    act(() => void vi.advanceTimersByTime(11_000));
    expect(said()).toBe("Time's up");
  });

  it('says nothing for a mark it never saw crossed: a phone that opens late or reloads', () => {
    setup(8);
    expect(said()).toBe('');
    cleanup();
    setup(30);
    expect(said()).toBe('');
    act(() => void vi.advanceTimersByTime(21_000));
    expect(said()).toBe('10 seconds left'); // but the one still ahead is spoken
    cleanup();
    setup(-5);
    expect(value()).toBe("Time's up");
    expect(said()).toBe('');
  });

  it('does not take more time given as a mark crossed, and speaks a mark crossed after it', () => {
    const { rerender } = setup(70);
    rerender(<RoomClock endsAt={T0 + 400_000} now={Date.now} />);
    expect(said()).toBe('');
    expect(value()).toBe('6:40');
    act(() => void vi.advanceTimersByTime(341_000));
    expect(said()).toBe('1 minute left');
  });

  it('calls onExpire once, when it sees it end, and never for a clock that opens ended', () => {
    const onExpire = vi.fn();
    setup(2, { onExpire });
    act(() => void vi.advanceTimersByTime(1000));
    expect(onExpire).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1200));
    expect(onExpire).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(5000));
    expect(onExpire).toHaveBeenCalledTimes(1);
    cleanup();
    const late = vi.fn();
    setup(-3, { onExpire: late });
    expect(late).not.toHaveBeenCalled();
  });

  it('reads the host\'s clock: a phone with the wrong one agrees', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    render(<RoomClock endsAt={T0 + 600_000} now={() => Date.now() + 90_000} />);
    expect(value()).toBe('8:30');
  });

  it('uses the app\'s words, and sets large for a big screen', () => {
    setup(30, {
      size: 'stage',
      labels: { name: 'Zeit', remaining: (s) => `noch ${s}`, done: 'Aus' },
    });
    expect(screen.getByRole('timer', { name: 'Zeit' }).className).toContain('text-6xl');
    act(() => void vi.advanceTimersByTime(21_000));
    expect(said()).toBe('noch 10');
    act(() => void vi.advanceTimersByTime(10_000));
    expect(said()).toBe('Aus');
    expect(value()).toBe('Aus');
    cleanup();
    setup(null, { labels: { idle: 'Keine Uhr' } });
    expect(value()).toBe('Keine Uhr');
  });

  it('speaks a minute as a plural-safe phrase by default, and the app\'s words for it', () => {
    setup(62, { labels: { remaining: (s) => (s >= 60 ? `${s / 60} Minute` : `${s} Sekunden`) } });
    act(() => void vi.advanceTimersByTime(3000));
    expect(said()).toBe('1 Minute');
  });
});
