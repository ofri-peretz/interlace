'use client';

/**
 * @interlace/ui — Calendar
 *
 * One month of days to pick one from: the date grid of a booking page, a
 * date field's popup, a "when" step. Days are plain `YYYY-MM-DD` strings
 * (see `calendar-model`), so the day a reader picks is the day the server
 * stores, in every time zone.
 *
 * Base UI ships no calendar, so this is the WAI-ARIA date grid built on a
 * real table: `role="grid"`, one tab stop (roving tabindex), the arrows,
 * Home / End and Page Up / Page Down. The month and the days are named
 * through `Intl.DateTimeFormat` in `locale`, and the week starts where the
 * locale starts it.
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/
 * Visual canon: shadcn's Calendar, with Cal.com's habit of marking the days
 * that have room.
 *
 * ## Anatomy
 *
 *   Calendar                       (div — data-slot="calendar", data-min-viewport=320)
 *     ├─ header                    (data-slot="calendar-header")
 *     │   ├─ Button                (data-slot="calendar-previous", aria-label)
 *     │   ├─ caption               (data-slot="calendar-caption", aria-live="polite")
 *     │   └─ Button                (data-slot="calendar-next", aria-label)
 *     └─ table role="grid"         (data-slot="calendar-grid", aria-labelledby → caption)
 *         ├─ thead th × 7          (data-slot="calendar-weekday", abbr = full name)
 *         └─ tbody tr × 6          (always six weeks, so the height never changes)
 *             └─ td role=gridcell  (aria-selected on the picked day)
 *                 └─ button        (data-slot="calendar-day", data-state, aria-label = full date)
 *
 * Days of the neighbouring months are empty cells: the reader picks from
 * one month at a time, and the keyboard walks into the next month anyway.
 *
 * ## Keyboard
 *
 * | Key                    | Action                                              |
 * | ---------------------- | --------------------------------------------------- |
 * | Tab                    | Into the grid, on the picked day (else today, else the first open day) |
 * | ← / →                  | Previous / next day, following the reading direction |
 * | ↑ / ↓                  | Same day of the previous / next week                |
 * | Home / End             | First / last day of the week                        |
 * | Page Up / Page Down    | Same day of the previous / next month               |
 * | Shift + Page Up / Down | Same day of the previous / next year                |
 * | Enter / Space          | Pick the focused day                                |
 *
 * Focus never leaves `[min, max]`. An unavailable day can take focus (so the
 * reader hears that it is closed), but cannot be picked.
 *
 * ## Day states
 *
 * | State       | Look                                   | In words (aria-label)        |
 * | ----------- | -------------------------------------- | ---------------------------- |
 * | open        | plain number                           | the full date                |
 * | marked      | a dot under the number                 | + `labels.marked`            |
 * | today       | semibold, `text-primary`, a short bar  | + `labels.today`, `aria-current="date"` |
 * | selected    | `bg-primary` fill                      | `aria-selected` on the cell  |
 * | unavailable | muted and struck through               | + `labels.unavailable`       |
 * | outside     | before `min` / after `max`: faded      | + `labels.unavailable`       |
 *
 * Colour only ever repeats a shape or the words.
 *
 * ## Motion
 *
 * Changing month slides the weeks in from the side they came from (200ms,
 * `--ease-enter`, transform and opacity, Web Animations API), mirrored in
 * RTL. Under reduced motion the new month is simply there. The grid keeps
 * six rows, so nothing below it moves.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The seven columns share the width (`table-fixed`) and each day is a
 * square up to 2.75rem, so the month fits a 288px column and still fits at
 * 150% text.
 *
 * | Rule | Concept                          | Where in this file                                         |
 * | ---- | -------------------------------- | ---------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'div'>`                              |
 * | R6   | data-slot per part               | calendar / -header / -caption / -grid / -weekday / -day    |
 * | R7   | cn + ...rest                     | `cn(…, className)` + `{...props}`                          |
 * | R9   | Controlled + uncontrolled        | `value` / `defaultValue`, `month` / `defaultMonth`         |
 * | R14  | Declares min viewport            | `data-min-viewport` + exported const                       |
 * | R19  | Tokens only                      | `bg-primary`, `text-muted-foreground`, `ring-ring`, `--ease-enter` |
 * | R25  | Client component                 | focus, keyboard and the month slide                        |
 * | R26  | A11y                             | APG date grid; full date, today and state in words         |
 */

import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from './button.js';
import {
  addMonths,
  type CalendarDate,
  clampDate,
  type DateBounds,
  endOfMonth,
  firstEnabledInMonth,
  isDateDisabled,
  isGridKey,
  isOutOfRange,
  isSameMonth,
  monthGrid,
  moveFocus,
  startOfMonth,
  todayIn,
  toUtcDate,
  weekdayOrder,
  type Weekday,
  weekStartFor,
} from './calendar-model.js';

export const MIN_VIEWPORT = 320 as const;

/** The brand's `--ease-enter`, so WAAPI motion retunes with the CSS. */
function easeEnter(el: Element): string {
  const value = getComputedStyle(el).getPropertyValue('--ease-enter').trim();
  return value || 'cubic-bezier(0.16, 1, 0.3, 1)';
}

export interface CalendarLabels {
  /** @default 'Previous month' */
  previousMonth?: string;
  /** @default 'Next month' */
  nextMonth?: string;
  /** Said after the date of today. @default 'Today' */
  today?: string;
  /** Said after a day that cannot be picked. @default 'Unavailable' */
  unavailable?: string;
  /** Said after a marked day, e.g. 'Times available'. @default 'Marked' */
  marked?: string;
}

const DEFAULT_LABELS: Required<CalendarLabels> = {
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  today: 'Today',
  unavailable: 'Unavailable',
  marked: 'Marked',
};

type CalendarProps = Omit<React.ComponentProps<'div'>, 'defaultValue' | 'onChange'> & {
  /** The picked day, controlled. `null` for none. */
  value?: CalendarDate | null;
  /** The picked day, uncontrolled. */
  defaultValue?: CalendarDate | null;
  /** Fires with the day the reader picks. */
  onValueChange?: (date: CalendarDate) => void;
  /** Any day of the month on show, controlled. */
  month?: CalendarDate;
  /** Any day of the month to open on. @default the picked day, else today */
  defaultMonth?: CalendarDate;
  /** Fires with the first day of the month the reader moved to. */
  onMonthChange?: (month: CalendarDate) => void;
  /** First day that can be picked. Days before it are not offered. */
  min?: CalendarDate;
  /** Last day that can be picked. */
  max?: CalendarDate;
  /** A day inside the range that cannot be picked: full, closed, a holiday. */
  isDateUnavailable?: (date: CalendarDate) => boolean;
  /** A day to mark with a dot, e.g. one with open times. */
  isDateMarked?: (date: CalendarDate) => boolean;
  /**
   * Today. Pass it from the server (in the venue's time zone) so the server
   * HTML and the browser agree. @default today in `timeZone`
   */
  today?: CalendarDate;
  /** Time zone for working out today. @default the browser's */
  timeZone?: string;
  /** BCP 47 locale for month, weekday and day names. @default the browser's */
  locale?: string;
  /** First column. @default the locale's first day of the week */
  weekStartsOn?: Weekday;
  /** Every word the calendar says, for translation. */
  labels?: CalendarLabels;
};

type DayState = 'open' | 'today' | 'selected' | 'unavailable' | 'outside';

function dayState(
  date: CalendarDate,
  ctx: {
    bounds: DateBounds;
    value: CalendarDate | null;
    today: CalendarDate;
    isDateMarked?: (date: CalendarDate) => boolean;
  },
) {
  const outside = isOutOfRange(date, ctx.bounds);
  const disabled = outside || isDateDisabled(date, ctx.bounds);
  const selected = ctx.value === date;
  const isToday = date === ctx.today;
  const marked = !disabled && Boolean(ctx.isDateMarked?.(date));
  let state: DayState = 'open';
  if (selected) state = 'selected';
  else if (outside) state = 'outside';
  else if (disabled) state = 'unavailable';
  else if (isToday) state = 'today';
  return { disabled, selected, isToday, marked, state };
}

/** Reading direction from the nearest `dir`, as `:dir()` resolves it. */
function isRtl(el: Element): boolean {
  return el.closest('[dir]')?.getAttribute('dir') === 'rtl';
}

function useControllable<T>(
  controlled: T | undefined,
  initial: T,
  onChange?: (value: T) => void,
): [T, (next: T) => void] {
  const [inner, setInner] = React.useState(initial);
  const value = controlled !== undefined ? controlled : inner;
  const set = React.useCallback(
    (next: T) => {
      if (controlled === undefined) setInner(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );
  return [value, set];
}

const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(function Calendar(
  {
    value: valueProp,
    defaultValue = null,
    onValueChange,
    month: monthProp,
    defaultMonth,
    onMonthChange,
    min,
    max,
    isDateUnavailable,
    isDateMarked,
    today: todayProp,
    timeZone,
    locale,
    weekStartsOn: weekStartsOnProp,
    labels: labelsProp,
    className,
    ...props
  },
  ref,
) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const [fallbackToday] = React.useState(() => todayIn(timeZone));
  const today = todayProp ?? fallbackToday;
  const weekStartsOn = weekStartsOnProp ?? weekStartFor(locale);
  const bounds = React.useMemo(
    () => ({ min, max, isDateUnavailable }),
    [min, max, isDateUnavailable],
  );

  const [value, setValue] = useControllable<CalendarDate | null>(valueProp, defaultValue, (d) => {
    if (d) onValueChange?.(d);
  });
  const [monthRaw, setMonthRaw] = useControllable<CalendarDate>(
    monthProp,
    startOfMonth(clampDate(defaultMonth ?? value ?? today, min, max)),
    onMonthChange,
  );
  const month = startOfMonth(monthRaw);

  // The day that holds the grid's one tab stop. Kept only while it is in
  // the month on show; otherwise the stop falls back as documented above.
  const [focused, setFocused] = React.useState<CalendarDate | null>(null);
  const focusOnRender = React.useRef(false);
  const slide = React.useRef<0 | 1 | -1>(0);

  const tabStop = React.useMemo(() => {
    if (focused && isSameMonth(focused, month)) return focused;
    if (value && isSameMonth(value, month) && !isOutOfRange(value, bounds)) return value;
    if (isSameMonth(today, month) && !isDateDisabled(today, bounds)) return today;
    const firstInRange = clampDate(month, min, max);
    if (!isSameMonth(firstInRange, month)) return null;
    return firstEnabledInMonth(firstInRange, bounds) ?? firstInRange;
  }, [focused, month, value, today, min, max, bounds]);

  const gridRef = React.useRef<HTMLTableElement>(null);
  const bodyRef = React.useRef<HTMLTableSectionElement>(null);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (!focusOnRender.current) return;
    focusOnRender.current = false;
    const target = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${tabStop}"]`);
    target?.focus();
  }, [tabStop, month]);

  React.useLayoutEffect(() => {
    const dir = slide.current;
    slide.current = 0;
    const body = bodyRef.current;
    if (!dir || reduced || !body || typeof body.animate !== 'function') return;
    const rtl = isRtl(body);
    const from = `${(rtl ? -dir : dir) * 0.75}rem`;
    body.animate(
      [
        { transform: `translateX(${from})`, opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 200, easing: easeEnter(body) },
    );
  }, [month, reduced]);

  const goToMonth = (next: CalendarDate) => {
    const target = startOfMonth(next);
    if (target === month) return;
    slide.current = target > month ? 1 : -1;
    setMonthRaw(target);
  };

  const canGoBack = !min || startOfMonth(min) < month;
  const canGoForward = !max || endOfMonth(max) > endOfMonth(month);

  // Built once per locale, not on every arrow key.
  const fmt = React.useMemo(() => {
    const make = (o: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' });
    return {
      caption: make({ month: 'long', year: 'numeric' }),
      day: make({ day: 'numeric' }),
      full: make({ dateStyle: 'full' }),
      weekdayShort: make({ weekday: 'short' }),
      weekdayLong: make({ weekday: 'long' }),
    };
  }, [locale]);
  // 2023-01-01 was a Sunday: weekday n is 1 + n January 2023.
  const weekdayDate = (d: Weekday) => toUtcDate(`2023-01-0${d + 1}`);

  const captionId = React.useId();
  const weeks = monthGrid(month, weekStartsOn);

  const pick = (date: CalendarDate) => {
    if (isDateDisabled(date, bounds)) return;
    setFocused(date);
    setValue(date);
  };

  const onDayKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, date: CalendarDate) => {
    if (!isGridKey(event.key)) return;
    event.preventDefault();
    const rtl = isRtl(event.currentTarget);
    const next = moveFocus(date, event.key, {
      weekStartsOn,
      rtl,
      shift: event.shiftKey,
      min,
      max,
    });
    focusOnRender.current = true;
    setFocused(next);
    if (!isSameMonth(next, month)) goToMonth(next);
    else if (next === date) {
      focusOnRender.current = false;
    } else {
      // Same month: move focus now, no re-render of the month needed.
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus();
      focusOnRender.current = false;
    }
  };

  return (
    <div
      ref={ref}
      data-slot="calendar"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('w-full max-w-96 text-foreground', className)}
      {...props}
    >
      <div data-slot="calendar-header" className="flex items-center justify-between gap-2 pb-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-slot="calendar-previous"
          aria-label={labels.previousMonth}
          disabled={!canGoBack}
          onClick={() => goToMonth(addMonths(month, -1))}
        >
          <ChevronLeftIcon aria-hidden="true" className="rtl:rotate-180" />
        </Button>
        <div
          id={captionId}
          data-slot="calendar-caption"
          aria-live="polite"
          className="min-w-0 truncate text-center text-sm font-semibold"
        >
          {fmt.caption.format(toUtcDate(month))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-slot="calendar-next"
          aria-label={labels.nextMonth}
          disabled={!canGoForward}
          onClick={() => goToMonth(addMonths(month, 1))}
        >
          <ChevronRightIcon aria-hidden="true" className="rtl:rotate-180" />
        </Button>
      </div>
      <table
        ref={gridRef}
        role="grid"
        aria-labelledby={captionId}
        data-slot="calendar-grid"
        className="w-full table-fixed border-collapse"
      >
        <thead>
          <tr>
            {weekdayOrder(weekStartsOn).map((d) => (
              <th
                key={d}
                scope="col"
                abbr={fmt.weekdayLong.format(weekdayDate(d))}
                data-slot="calendar-weekday"
                className="text-muted-foreground pb-1 text-xs font-normal"
              >
                {fmt.weekdayShort.format(weekdayDate(d))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((date) => {
                if (!isSameMonth(date, month)) {
                  return <td key={date} role="gridcell" className="p-0.5" />;
                }
                const { disabled, selected, isToday, marked, state } = dayState(date, {
                  bounds,
                  value,
                  today,
                  isDateMarked,
                });
                const name = [
                  fmt.full.format(toUtcDate(date)),
                  isToday && labels.today,
                  disabled && labels.unavailable,
                  marked && labels.marked,
                ]
                  .filter(Boolean)
                  .join(', ');
                return (
                  <td
                    key={date}
                    role="gridcell"
                    aria-selected={selected || undefined}
                    className="p-0.5"
                  >
                    <button
                      type="button"
                      data-slot="calendar-day"
                      data-date={date}
                      data-state={state}
                      data-today={isToday || undefined}
                      data-marked={marked || undefined}
                      tabIndex={date === tabStop ? 0 : -1}
                      aria-label={name}
                      aria-current={isToday ? 'date' : undefined}
                      aria-disabled={disabled || undefined}
                      onClick={() => pick(date)}
                      onKeyDown={(e) => onDayKeyDown(e, date)}
                      onFocus={() => setFocused(date)}
                      className={cn(
                        'relative mx-auto flex aspect-square w-full max-w-11 min-w-0 items-center justify-center rounded-lg text-sm tabular-nums outline-none',
                        'transition-[color,background-color,box-shadow,scale] duration-(--duration-fast) ease-enter',
                        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        state === 'open' && 'hover:bg-accent hover:text-accent-foreground',
                        state === 'today' &&
                          'text-primary font-semibold hover:bg-accent hover:text-accent-foreground',
                        state === 'selected' &&
                          'bg-primary text-primary-foreground font-semibold motion-safe:active:scale-[0.97]',
                        state === 'unavailable' &&
                          'text-muted-foreground cursor-not-allowed line-through decoration-from-font',
                        state === 'outside' && 'text-muted-foreground cursor-not-allowed opacity-60',
                        (state === 'open' || state === 'today') && 'motion-safe:active:scale-[0.97]',
                      )}
                    >
                      {fmt.day.format(toUtcDate(date))}
                      {(marked || isToday) && (
                        <span
                          aria-hidden="true"
                          data-slot="calendar-day-mark"
                          className={cn(
                            'absolute bottom-1 start-1/2 h-1 -translate-x-1/2 rounded-full rtl:translate-x-1/2',
                            isToday && !marked ? 'w-3' : 'w-1',
                            selected ? 'bg-primary-foreground' : 'bg-primary',
                          )}
                        />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export { Calendar };
export type { CalendarProps };
export type { CalendarDate, Weekday } from './calendar-model.js';
