'use client';

/**
 * @interlace/ui — TimeSlotPicker
 *
 * The times open on one day, as tiles to pick one from: the second half of
 * a booking page, next to a `Calendar`. Built on Base UI's radio group, so
 * it is one tab stop, the arrows move between times, and a form posts the
 * picked slot's `value` under `name`.
 * Mirrors: https://base-ui.com/react/components/radio
 * Inspiration: Cal.com's column of times, Stripe's quiet tiles.
 *
 * ## Anatomy
 *
 *   TimeSlotPicker                  (div — data-slot="time-slot-picker", @container, data-min-viewport=320)
 *     ├─ label                      (data-slot="time-slot-picker-label", names the group)
 *     ├─ description                (data-slot="time-slot-picker-description", e.g. the time zone)
 *     └─ RadioGroup                 (data-slot="time-slot-picker-group", aria-busy while loading)
 *         ├─ heading per period     (data-slot="time-slot-picker-period", with `groupBy="period"`)
 *         └─ Radio × n              (data-slot="time-slot", data-state, button[role=radio])
 *             ├─ time               (the slot's start, in `locale` and `timeZone`)
 *             └─ note               (data-slot="time-slot-note", e.g. "2 places left")
 *
 * ## States
 *
 * | State      | What shows                                                    |
 * | ---------- | ------------------------------------------------------------- |
 * | `loading`  | tile-shaped placeholders, the group `aria-busy`               |
 * | no slots   | `labels.empty` in words, never a blank box                    |
 * | slots      | tiles; a full slot is muted, struck through and says so       |
 *
 * ## Keyboard (owned by Base UI)
 *
 * | Key         | Action                                   |
 * | ----------- | ---------------------------------------- |
 * | Tab         | Into the group, on the picked time       |
 * | ← → ↑ ↓     | Pick the previous / next open time       |
 * | Space       | Pick the focused time                    |
 *
 * ## Motion
 *
 * When the list of times changes (a new day), the tiles fade up into place
 * once (200ms, transform and opacity). The picked tile takes its fill in
 * `--duration-fast`. Under reduced motion both are simply there.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The tiles query the picker's own width: two columns in a phone column,
 * three from 28rem, four from 42rem. A sidebar and a full page both work.
 *
 * | Rule | Concept                   | Where in this file                                          |
 * | ---- | ------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                               |
 * | R6   | data-slot per part        | time-slot-picker / -label / -group / -period / time-slot     |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                           |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onValueChange`                  |
 * | R12  | Reuse over wrap           | Base UI owns roving focus, ARIA and the form value          |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                        |
 * | R19  | Tokens only               | `border-input`, `bg-primary`, `text-muted-foreground`        |
 * | R26  | A11y                      | labelled radiogroup; full slots say why in their name       |
 */

import * as React from 'react';
import { Radio } from '@base-ui/react/radio';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { motionEase } from '../lib/motion-token.js';
import { RadioGroup } from '../primitives/radio-group.js';
import { type DayPeriod, formatSlot, groupByPeriod } from './time-slot-model.js';

export const MIN_VIEWPORT = 320 as const;

export interface TimeSlot {
  /** What your store keys the slot by: `HH:MM`, an ISO instant, or your own id. */
  value: string;
  /** What the tile says. @default the start time, from `value` */
  label?: React.ReactNode;
  /** Plain text for the slot's accessible name, when `label` is not a string. */
  text?: string;
  /** A short line under the time, e.g. "2 places left". */
  note?: React.ReactNode;
  /** Full or closed: shown, but cannot be picked. */
  disabled?: boolean;
  /** Hour (0 to 23) for `groupBy="period"`, when `value` is your own id. */
  hour?: number;
}

export interface TimeSlotPickerLabels {
  /** Shown when the day has no times. @default 'No times left on this day. Try another day.' */
  empty?: string;
  /** Said after a slot that cannot be picked. @default 'Full' */
  unavailable?: string;
  /** Headings for `groupBy="period"`. */
  periods?: Partial<Record<DayPeriod, string>>;
  /** Said while loading. @default 'Loading times' */
  loading?: string;
}

const DEFAULT_PERIODS: Record<DayPeriod, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

type TimeSlotPickerProps = Omit<React.ComponentProps<'div'>, 'defaultValue' | 'onChange'> & {
  /** Names the group, e.g. "Times on Tuesday 24 November". */
  label: React.ReactNode;
  /** A line under the label, e.g. the time zone the times are in. */
  description?: React.ReactNode;
  slots: readonly TimeSlot[];
  /** The picked slot's value, controlled. `null` for none. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  /** Form field name; the picked `value` is posted under it. */
  name?: string;
  /** A slot must be picked before the form submits. */
  required?: boolean;
  /** Placeholders while the day's times load. */
  loading?: boolean;
  /** `period` puts headings over morning, afternoon and evening. @default 'none' */
  groupBy?: 'none' | 'period';
  /** BCP 47 locale for the times. @default the browser's */
  locale?: string;
  /** Zone to show ISO instants in. @default the browser's */
  timeZone?: string;
  /** Force a 12-hour (`true`) or 24-hour (`false`) clock. @default the locale's */
  hour12?: boolean;
  labels?: TimeSlotPickerLabels;
};

const TILE =
  'relative flex min-h-control-lg w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 text-center text-sm font-medium tabular-nums outline-none transition-[color,background-color,border-color,box-shadow,scale] duration-(--duration-fast) ease-enter focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const TimeSlotPicker = React.forwardRef<HTMLDivElement, TimeSlotPickerProps>(
  function TimeSlotPicker(
    {
      label,
      description,
      slots,
      value,
      defaultValue,
      onValueChange,
      name,
      required,
      loading = false,
      groupBy = 'none',
      locale,
      timeZone,
      hour12,
      labels,
      className,
      ...props
    },
    ref,
  ) {
    const labelId = React.useId();
    const descriptionId = React.useId();
    const groupRef = React.useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const signature = slots.map((s) => s.value).join('|');
    const mounted = React.useRef(false);

    React.useLayoutEffect(() => {
      // The first paint is content, not an entrance: only a new list moves.
      if (!mounted.current) {
        mounted.current = true;
        return;
      }
      const group = groupRef.current;
      if (reduced || loading || !group || typeof group.animate !== 'function') return;
      group.animate(
        [
          { transform: 'translateY(0.25rem)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 },
        ],
        { duration: 200, easing: motionEase(group, 'enter') },
      );
    }, [signature, reduced, loading]);

    const unavailable = labels?.unavailable ?? 'Full';
    const periods = { ...DEFAULT_PERIODS, ...labels?.periods };
    const groups =
      groupBy === 'period'
        ? groupByPeriod(slots, timeZone)
        : [{ period: null as DayPeriod | null, slots: [...slots] }];

    const tiles = (list: readonly TimeSlot[]) => (
      <div className="grid grid-cols-2 gap-2 @md:grid-cols-3 @2xl:grid-cols-4">
        {list.map((slot) => {
          const time = formatSlot(slot.value, { locale, timeZone, hour12 });
          const text = slot.text ?? (typeof slot.label === 'string' ? slot.label : time);
          return (
            <Radio.Root
              key={slot.value}
              value={slot.value}
              disabled={slot.disabled}
              data-slot="time-slot"
              aria-label={slot.disabled ? `${text}, ${unavailable}` : undefined}
              className={cn(
                TILE,
                'border-input bg-background text-foreground hover:border-ring hover:bg-accent hover:text-accent-foreground motion-safe:active:scale-[0.97]',
                'data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground',
                'data-[disabled]:text-muted-foreground data-[disabled]:cursor-not-allowed data-[disabled]:border-dashed data-[disabled]:bg-transparent data-[disabled]:hover:border-input data-[disabled]:hover:bg-transparent data-[disabled]:hover:text-muted-foreground data-[disabled]:active:scale-100',
              )}
            >
              <span
                dir="auto"
                className={cn('truncate', slot.disabled && 'line-through decoration-from-font')}
              >
                {slot.label ?? time}
              </span>
              {slot.note && (
                <span
                  dir="auto"
                  data-slot="time-slot-note"
                  className="truncate text-xs font-normal opacity-90"
                >
                  {slot.note}
                </span>
              )}
            </Radio.Root>
          );
        })}
      </div>
    );

    return (
      <div
        ref={ref}
        data-slot="time-slot-picker"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('@container flex w-full min-w-0 flex-col gap-3', className)}
        {...props}
      >
        <div className="flex flex-col gap-0.5">
          <div id={labelId} data-slot="time-slot-picker-label" className="text-sm font-semibold">
            {label}
          </div>
          {description && (
            <div
              id={descriptionId}
              data-slot="time-slot-picker-description"
              className="text-muted-foreground text-sm"
            >
              {description}
            </div>
          )}
        </div>
        {loading ? (
          <div
            data-slot="time-slot-picker-group"
            aria-busy="true"
            aria-labelledby={labelId}
            role="status"
            className="grid grid-cols-2 gap-2 @md:grid-cols-3 @2xl:grid-cols-4"
          >
            <span className="sr-only">{labels?.loading ?? 'Loading times'}</span>
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                aria-hidden="true"
                data-slot="time-slot-placeholder"
                className="bg-muted min-h-control-lg w-full rounded-lg motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p
            data-slot="time-slot-picker-empty"
            role="status"
            className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-6 text-center text-sm"
          >
            {labels?.empty ?? 'No times left on this day. Try another day.'}
          </p>
        ) : (
          <RadioGroup
            ref={groupRef}
            data-slot="time-slot-picker-group"
            aria-labelledby={labelId}
            aria-describedby={description ? descriptionId : undefined}
            value={value === undefined ? undefined : value}
            defaultValue={defaultValue ?? undefined}
            onValueChange={(v) => onValueChange?.(v as string)}
            name={name}
            required={required}
            className="flex flex-col gap-4"
          >
            {groups.map((g) =>
              g.period ? (
                <div key={g.period} className="flex flex-col gap-2">
                  <div
                    data-slot="time-slot-picker-period"
                    className="text-muted-foreground text-xs font-medium"
                  >
                    {periods[g.period]}
                  </div>
                  {tiles(g.slots)}
                </div>
              ) : (
                <React.Fragment key="all">{tiles(g.slots)}</React.Fragment>
              ),
            )}
          </RadioGroup>
        )}
      </div>
    );
  },
);

export { TimeSlotPicker };
export type { TimeSlotPickerProps };
