/**
 * Calendar and TimeSlotPicker: the day arithmetic and time formatting a
 * server can repeat, and the keyboard paths a reader takes.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addDays,
  addMonths,
  clampDate,
  compareDates,
  daysInMonth,
  endOfMonth,
  endOfWeek,
  firstEnabledInMonth,
  isCalendarDate,
  isDateDisabled,
  isGridKey,
  isOutOfRange,
  isSameMonth,
  monthGrid,
  moveFocus,
  startOfMonth,
  startOfWeek,
  toCalendarDate,
  todayIn,
  toUtcDate,
  weekdayOf,
  weekdayOrder,
  weekStartFor,
} from '../src/primitives/calendar-model.js';
import { Calendar, MIN_VIEWPORT as CALENDAR_MIN } from '../src/primitives/calendar.js';
import {
  formatSlot,
  groupByPeriod,
  periodOf,
  slotHour,
} from '../src/patterns/time-slot-model.js';
import {
  TimeSlotPicker,
  MIN_VIEWPORT as PICKER_MIN,
} from '../src/patterns/time-slot-picker.js';

// jsdom has no PointerEvent; Base UI's radio builds one on click.
if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = class extends MouseEvent {} as unknown as typeof PointerEvent;
}

/** Turn reduced motion on until the test ends. */
function reduceMotion() {
  window.matchMedia = ((q: string) => ({
    matches: q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.matchMedia = originalMatchMedia;
});

describe('calendar-model', () => {
  it('knows a real day from a malformed one', () => {
    expect(isCalendarDate('2026-11-24')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-04-31')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('2026-00-10')).toBe(false);
    expect(isCalendarDate('2026-01-00')).toBe(false);
    expect(isCalendarDate('2026-1-1')).toBe(false);
    expect(isCalendarDate(20261124)).toBe(false);
  });

  it('does day and month arithmetic on the calendar, not the clock', () => {
    expect(toCalendarDate(987, 3, 4)).toBe('0987-03-04');
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    // Across a daylight-saving change and a year end.
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    // Months keep the day inside the month.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-11-24', 2)).toBe('2027-01-24');
    expect(addMonths('2026-01-15', -13)).toBe('2024-12-15');
    expect(startOfMonth('2026-11-24')).toBe('2026-11-01');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(isSameMonth('2026-11-01', '2026-11-30')).toBe(true);
    expect(isSameMonth('2026-11-30', '2026-12-01')).toBe(false);
    expect(weekdayOf('2026-11-24')).toBe(2);
    expect(toUtcDate('2026-11-24').toISOString()).toBe('2026-11-24T00:00:00.000Z');
    expect(() => addDays('24/11/2026', 1)).toThrow(RangeError);
  });

  it('compares and clamps', () => {
    expect(compareDates('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareDates('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareDates('2026-01-01', '2026-01-01')).toBe(0);
    expect(clampDate('2026-01-01', '2026-02-01')).toBe('2026-02-01');
    expect(clampDate('2026-05-01', undefined, '2026-03-01')).toBe('2026-03-01');
    expect(clampDate('2026-02-15', '2026-02-01', '2026-03-01')).toBe('2026-02-15');
  });

  it('lays a month out as six full weeks from the first day of the week', () => {
    const sunday = monthGrid('2026-11-24', 0);
    expect(sunday).toHaveLength(6);
    expect(sunday.every((w) => w.length === 7)).toBe(true);
    expect(sunday[0]![0]).toBe('2026-11-01'); // 1 November 2026 is a Sunday
    const monday = monthGrid('2026-11-24', 1);
    expect(monday[0]![0]).toBe('2026-10-26');
    expect(monday[5]![6]).toBe('2026-12-06');
    expect(weekdayOrder(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(startOfWeek('2026-11-24', 1)).toBe('2026-11-23');
    expect(endOfWeek('2026-11-24', 1)).toBe('2026-11-29');
  });

  it('starts the week where the locale starts it', () => {
    expect(weekStartFor('en-US')).toBe(0);
    expect(weekStartFor('en-GB')).toBe(1);
    expect(weekStartFor('ar-EG')).toBe(6);
    expect(weekStartFor()).toEqual(expect.any(Number));
    expect(weekStartFor('not a locale!')).toBe(1);
  });

  it('falls back to the region table without week info', () => {
    const proto = Intl.Locale.prototype as unknown as Record<string, unknown>;
    const desc = Object.getOwnPropertyDescriptor(proto, 'weekInfo');
    Object.defineProperty(proto, 'weekInfo', { configurable: true, get: () => undefined });
    try {
      expect(weekStartFor('en-US')).toBe(0);
      expect(weekStartFor('ar-EG')).toBe(6);
      expect(weekStartFor('de-DE')).toBe(1);
    } finally {
      if (desc) Object.defineProperty(proto, 'weekInfo', desc);
      else delete proto.weekInfo;
    }
  });

  it('prefers getWeekInfo where the runtime has it', () => {
    const proto = Intl.Locale.prototype as unknown as Record<string, unknown>;
    proto.getWeekInfo = () => ({ firstDay: 3 });
    try {
      expect(weekStartFor('en-US')).toBe(3);
    } finally {
      delete proto.getWeekInfo;
    }
  });

  it('reads today in a time zone', () => {
    const late = new Date('2026-11-25T03:00:00Z');
    expect(todayIn('UTC', late)).toBe('2026-11-25');
    expect(todayIn('America/New_York', late)).toBe('2026-11-24');
    expect(isCalendarDate(todayIn())).toBe(true);
  });

  it('tells out-of-range days from unavailable ones', () => {
    const bounds = {
      min: '2026-11-10',
      max: '2026-11-20',
      isDateUnavailable: (d: string) => d === '2026-11-12',
    };
    expect(isOutOfRange('2026-11-09', bounds)).toBe(true);
    expect(isOutOfRange('2026-11-21', bounds)).toBe(true);
    expect(isOutOfRange('2026-11-12', bounds)).toBe(false);
    expect(isOutOfRange('2026-11-12', {})).toBe(false);
    expect(isDateDisabled('2026-11-12', bounds)).toBe(true);
    expect(isDateDisabled('2026-11-13', bounds)).toBe(false);
    expect(isDateDisabled('2026-11-13', {})).toBe(false);
    expect(firstEnabledInMonth('2026-11-10', { ...bounds, isDateUnavailable: (d) => d < '2026-11-15' })).toBe(
      '2026-11-15',
    );
    expect(firstEnabledInMonth('2026-11-01', { isDateUnavailable: () => true })).toBeNull();
  });

  it('moves focus like the APG date grid, mirrored in RTL and kept in range', () => {
    const o = { weekStartsOn: 1 as const };
    expect(isGridKey('ArrowLeft')).toBe(true);
    expect(isGridKey('Enter')).toBe(false);
    expect(moveFocus('2026-11-24', 'ArrowRight', o)).toBe('2026-11-25');
    expect(moveFocus('2026-11-24', 'ArrowLeft', o)).toBe('2026-11-23');
    expect(moveFocus('2026-11-24', 'ArrowRight', { ...o, rtl: true })).toBe('2026-11-23');
    expect(moveFocus('2026-11-24', 'ArrowLeft', { ...o, rtl: true })).toBe('2026-11-25');
    expect(moveFocus('2026-11-24', 'ArrowUp', o)).toBe('2026-11-17');
    expect(moveFocus('2026-11-24', 'ArrowDown', o)).toBe('2026-12-01');
    expect(moveFocus('2026-11-24', 'Home', o)).toBe('2026-11-23');
    expect(moveFocus('2026-11-24', 'End', o)).toBe('2026-11-29');
    expect(moveFocus('2026-11-24', 'PageUp', o)).toBe('2026-10-24');
    expect(moveFocus('2026-11-24', 'PageDown', o)).toBe('2026-12-24');
    expect(moveFocus('2026-11-24', 'PageUp', { ...o, shift: true })).toBe('2025-11-24');
    expect(moveFocus('2026-11-24', 'PageDown', { ...o, shift: true })).toBe('2027-11-24');
    expect(moveFocus('2026-11-24', 'ArrowUp', { ...o, min: '2026-11-20' })).toBe('2026-11-20');
    expect(moveFocus('2026-11-24', 'PageDown', { ...o, max: '2026-12-10' })).toBe('2026-12-10');
  });
});

const DAY = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('Calendar', () => {
  const base = { today: '2026-11-24', locale: 'en-US' } as const;

  it('renders one labelled month grid with six weeks and full date names', () => {
    render(<Calendar {...base} />);
    expect(CALENDAR_MIN).toBe(320);
    const grid = screen.getByRole('grid', { name: 'November 2026' });
    expect(grid.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(grid.querySelectorAll('[data-slot="calendar-day"]')).toHaveLength(30);
    expect(grid.querySelector('th')?.getAttribute('abbr')).toBe('Sunday');
    const today = DAY(/Tuesday, November 24, 2026, Today/);
    expect(today.getAttribute('aria-current')).toBe('date');
    expect(today.tabIndex).toBe(0);
    expect(today.dataset.state).toBe('today');
  });

  it('picks a day, uncontrolled, and reports it', () => {
    const onValueChange = vi.fn();
    render(<Calendar {...base} onValueChange={onValueChange} />);
    fireEvent.click(DAY(/November 26, 2026/));
    expect(onValueChange).toHaveBeenCalledWith('2026-11-26');
    const cell = DAY(/November 26, 2026/).closest('td')!;
    expect(cell.getAttribute('aria-selected')).toBe('true');
    expect(DAY(/November 26, 2026/).tabIndex).toBe(0);
  });

  it('follows a controlled value and month', () => {
    const onMonthChange = vi.fn();
    const { rerender } = render(
      <Calendar {...base} value="2026-11-03" month="2026-11-15" onMonthChange={onMonthChange} />,
    );
    expect(DAY(/November 3, 2026/).dataset.state).toBe('selected');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onMonthChange).toHaveBeenCalledWith('2026-12-01');
    // Still November: the parent owns the month.
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeTruthy();
    rerender(<Calendar {...base} value="2026-11-03" month="2026-12-01" />);
    expect(screen.getByRole('grid', { name: 'December 2026' })).toBeTruthy();
  });

  it('will not pick an unavailable or out-of-range day, and says why', () => {
    const onValueChange = vi.fn();
    render(
      <Calendar
        {...base}
        min="2026-11-10"
        max="2026-11-27"
        isDateUnavailable={(d) => d === '2026-11-25'}
        isDateMarked={(d) => d === '2026-11-26' || d === '2026-11-25'}
        labels={{ marked: 'Times available', unavailable: 'Closed' }}
        onValueChange={onValueChange}
      />,
    );
    const closed = DAY(/November 25, 2026, Closed$/);
    expect(closed.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(closed);
    fireEvent.click(DAY(/November 9, 2026/));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(DAY(/November 26, 2026, Times available/).dataset.marked).toBe('true');
    // Both month buttons are off: the range is inside November.
    expect((screen.getByRole('button', { name: 'Previous month' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Next month' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('walks the grid with the keyboard and turns the month at its edge', () => {
    render(<Calendar {...base} defaultValue="2026-11-29" weekStartsOn={1} />);
    const start = DAY(/November 29, 2026/);
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(DAY(/November 28, 2026/));
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' }); // not a grid key: native click handles it
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    });
    expect(screen.getByRole('grid', { name: 'December 2026' })).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-12-05');
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: 'PageUp', shiftKey: true });
    });
    expect(screen.getByRole('grid', { name: 'December 2025' })).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-date')).toBe('2025-12-05');
  });

  it('stays put at the edge of the range', () => {
    render(<Calendar {...base} min="2026-11-24" defaultValue="2026-11-24" />);
    const first = DAY(/November 24, 2026/);
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);
  });

  it('mirrors the arrows in a right-to-left page', () => {
    render(
      <div dir="rtl" style={{ direction: 'rtl' }}>
        <Calendar {...base} defaultValue="2026-11-10" />
      </div>,
    );
    const start = DAY(/November 10, 2026/);
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowLeft' });
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-11-11');
  });

  it('puts the tab stop on the first open day when today is not in the month', () => {
    render(
      <Calendar
        {...base}
        defaultMonth="2026-12-01"
        isDateUnavailable={(d) => d < '2026-12-03'}
      />,
    );
    expect(DAY(/December 3, 2026/).tabIndex).toBe(0);
  });

  it('falls back to the first day in range when the whole month is closed', () => {
    render(<Calendar {...base} defaultMonth="2026-12-01" isDateUnavailable={() => true} />);
    expect(DAY(/December 1, 2026/).tabIndex).toBe(0);
  });

  it('has no tab stop in a month wholly outside the range', () => {
    render(<Calendar {...base} month="2026-12-01" max="2026-11-30" />);
    const days = screen.getAllByRole('button').filter((b) => b.dataset.slot === 'calendar-day');
    expect(days.every((b) => b.tabIndex === -1)).toBe(true);
  });

  it('slides a new month in, and not under reduced motion', () => {
    const animate = vi.fn();
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
    try {
      render(<Calendar {...base} />);
      fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
      expect(screen.getByRole('grid', { name: 'October 2026' })).toBeTruthy();
      expect(animate).toHaveBeenCalledTimes(1);
      expect(animate.mock.calls[0]![0][0].transform).toBe('translateX(-0.75rem)');
      cleanup();
      reduceMotion();
      render(<Calendar {...base} />);
      fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
      expect(animate).toHaveBeenCalledTimes(1);
    } finally {
      delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
    }
  });

  it('works out today itself when none is passed', () => {
    render(<Calendar locale="en-US" timeZone="UTC" />);
    expect(document.querySelector('[data-today]')?.getAttribute('data-date')).toBe(todayIn('UTC'));
  });
});

describe('time-slot-model', () => {
  it('reads the hour of a wall time, an instant, or a given hour', () => {
    expect(slotHour({ value: '09:30' })).toBe(9);
    expect(slotHour({ value: '2026-11-25T14:00:00Z' }, 'UTC')).toBe(14);
    expect(slotHour({ value: '2026-11-25T14:00:00Z' }, 'America/New_York')).toBe(9);
    expect(slotHour({ value: 'slot-7', hour: 19 })).toBe(19);
    expect(slotHour({ value: 'slot-7' })).toBeNull();
    expect(slotHour({ value: '2026-13-45T99:00Z' })).toBeNull();
  });

  it('names the part of the day', () => {
    expect(periodOf(0)).toBe('morning');
    expect(periodOf(12)).toBe('afternoon');
    expect(periodOf(17)).toBe('evening');
  });

  it('says the time in the locale and zone, or leaves an id alone', () => {
    expect(formatSlot('09:30', { locale: 'en-US' })).toBe('9:30 AM');
    expect(formatSlot('09:30', { locale: 'en-GB' })).toMatch(/^0?9:30$/);
    expect(formatSlot('18:00', { locale: 'en-US', hour12: false })).toBe('18:00');
    expect(formatSlot('2026-11-25T14:00:00Z', { locale: 'en-US', timeZone: 'UTC' })).toBe('2:00 PM');
    expect(formatSlot('slot-7')).toBe('slot-7');
    expect(formatSlot('10:00')).toEqual(expect.any(String));
  });

  it('groups by part of the day, keeping order and dropping empty groups', () => {
    const groups = groupByPeriod([
      { value: '18:00' },
      { value: '09:00' },
      { value: 'x' },
      { value: '19:00' },
    ]);
    expect(groups.map((g) => g.period)).toEqual(['morning', 'evening']);
    expect(groups[0]!.slots.map((s) => s.value)).toEqual(['09:00', 'x']);
    expect(groups[1]!.slots.map((s) => s.value)).toEqual(['18:00', '19:00']);
  });
});

describe('TimeSlotPicker', () => {
  const slots = [
    { value: '09:00' },
    { value: '09:30', disabled: true },
    { value: '13:00', note: '2 places left' },
    { value: 'special', label: 'Late session', hour: 20 },
  ];

  it('is a labelled radio group of times, full ones named as full', () => {
    render(
      <TimeSlotPicker
        label="Wednesday"
        description="Eastern Time"
        slots={slots}
        locale="en-US"
        labels={{ unavailable: 'Booked' }}
      />,
    );
    expect(PICKER_MIN).toBe(320);
    const group = screen.getByRole('radiogroup', { name: 'Wednesday' });
    expect(group.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: '9:30 AM, Booked' })).toBeTruthy();
    expect(screen.getByText('2 places left').dataset.slot).toBe('time-slot-note');
    expect(screen.getByText('Late session')).toBeTruthy();
  });

  it('picks a time and reports it', () => {
    const onValueChange = vi.fn();
    render(<TimeSlotPicker label="Day" slots={slots} locale="en-US" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /1:00 PM/ }));
    expect(onValueChange).toHaveBeenCalledWith('13:00');
    expect(screen.getByRole('radio', { name: /1:00 PM/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('groups by part of the day with translatable headings', () => {
    render(
      <TimeSlotPicker
        label="Day"
        slots={slots}
        groupBy="period"
        value={null}
        labels={{ periods: { evening: 'Tonight' } }}
      />,
    );
    const headings = [...document.querySelectorAll('[data-slot="time-slot-picker-period"]')];
    expect(headings.map((h) => h.textContent)).toEqual(['Morning', 'Afternoon', 'Tonight']);
  });

  it('shows placeholders while loading and words when the day is empty', () => {
    const { rerender } = render(<TimeSlotPicker label="Day" slots={[]} loading />);
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    expect(document.querySelectorAll('[data-slot="time-slot-placeholder"]')).toHaveLength(6);
    expect(screen.getByText('Loading times')).toBeTruthy();
    rerender(<TimeSlotPicker label="Day" slots={[]} labels={{ empty: 'Nothing left' }} />);
    expect(screen.getByRole('status').textContent).toBe('Nothing left');
    rerender(<TimeSlotPicker label="Day" slots={[]} />);
    expect(screen.getByRole('status').textContent).toMatch(/No times left/);
  });

  it('fades a new day of times in once, and not under reduced motion', () => {
    const animate = vi.fn();
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
    try {
      const { rerender } = render(<TimeSlotPicker label="Day" slots={slots} />);
      expect(animate).not.toHaveBeenCalled();
      rerender(<TimeSlotPicker label="Day" slots={slots.slice(0, 2)} />);
      expect(animate).toHaveBeenCalledTimes(1);
      cleanup();
      reduceMotion();
      const second = render(<TimeSlotPicker label="Day" slots={slots} />);
      second.rerender(<TimeSlotPicker label="Day" slots={slots.slice(1)} />);
      expect(animate).toHaveBeenCalledTimes(1);
    } finally {
      delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
    }
  });
});
