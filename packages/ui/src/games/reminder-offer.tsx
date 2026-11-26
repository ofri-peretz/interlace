'use client';

/**
 * @interlace/ui — ReminderOffer
 *
 * A quiet offer of a daily nudge that the player keeps in their own
 * calendar: pick a time, add it, done. It downloads an .ics file with one
 * event that repeats daily (`reminder-model.ts`), so nothing is sent, no
 * address is asked for, and the player removes it from their calendar
 * whenever they like. "Not now" dismisses it; the app decides whether it
 * ever comes back.
 *
 * ## Anatomy
 *
 *   ReminderOffer                  (section — data-slot="reminder-offer", data-state=offer|added)
 *     ├─ h3                        (data-slot="reminder-offer-title")
 *     ├─ p                         (data-slot="reminder-offer-body")
 *     ├─ div                       (data-slot="reminder-offer-controls")
 *     │   ├─ label + input[time]   (data-slot="reminder-offer-time")
 *     │   ├─ button                (data-slot="reminder-offer-add")
 *     │   └─ button                (data-slot="reminder-offer-dismiss", with onDismiss)
 *     └─ p aria-live="polite"      (data-slot="reminder-offer-status")
 *
 * ## Gentle by design
 *
 * One offer, two plain choices, no badge, no countdown, no guilt. It does
 * not ask the browser for notification permission.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Controls stack below a 24rem container.
 *
 * | Rule | Concept                   | Where in this file                                 |
 * | ---- | ------------------------- | -------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'section'>`                  |
 * | R6   | data-slot per part        | reminder-offer / -title / -body / -controls / -time / -add / -dismiss / -status |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                  |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const               |
 * | R19  | Tokens only               | card, border, muted-foreground, input              |
 * | R25  | Client component          | builds and downloads the file                      |
 * | R26  | A11y                      | labelled time field; live status                   |
 */

import * as React from 'react';
import { BellRing } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { dayKey } from './daily.js';
import { isReminderTime, reminderIcs } from './reminder-model.js';

export const MIN_VIEWPORT = 320 as const;

interface ReminderOfferLabels {
  /** @default 'A nudge each day?' */
  title?: string;
  /** @default 'Add a daily reminder to your own calendar. Nothing is sent to us, and you can remove it there any time.' */
  body?: string;
  /** @default 'Time' */
  time?: string;
  /** @default 'Add to my calendar' */
  add?: string;
  /** @default 'Not now' */
  dismiss?: string;
  /** @default 'Added. Open the file to save it in your calendar.' */
  added?: string;
}

type ReminderOfferProps = Omit<React.ComponentProps<'section'>, 'title'> & {
  /** The calendar event's title. */
  event: string;
  /** A line under the event's title. */
  eventDescription?: string;
  /** Opens from the event. */
  url?: string;
  /** Stable id, so adding again updates the same event. */
  uid: string;
  /** "HH:MM". @default '18:30' */
  defaultTime?: string;
  /** @default 'reminder.ics' */
  fileName?: string;
  /** Called with the time after the file is made. */
  onAdd?: (time: string) => void;
  /** Shows "Not now" and is called when pressed. */
  onDismiss?: () => void;
  labels?: ReminderOfferLabels;
};

function ReminderOffer({
  event,
  eventDescription,
  url,
  uid,
  defaultTime = '18:30',
  fileName = 'reminder.ics',
  onAdd,
  onDismiss,
  labels,
  className,
  ...props
}: ReminderOfferProps) {
  const id = React.useId();
  const [time, setTime] = React.useState(isReminderTime(defaultTime) ? defaultTime : '18:30');
  const [added, setAdded] = React.useState(false);

  const add = () => {
    const chosen = isReminderTime(time) ? time : '18:30';
    const ics = reminderIcs({ title: event, description: eventDescription, url, uid, time: chosen, start: dayKey() });
    const href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = fileName;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    setAdded(true);
    onAdd?.(chosen);
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      data-slot="reminder-offer"
      data-state={added ? 'added' : 'offer'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        '@container border-border bg-card text-card-foreground grid gap-3 rounded-xl border p-5',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <BellRing aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
        <div className="grid gap-1">
          <h3 id={`${id}-title`} data-slot="reminder-offer-title" className="font-heading font-semibold">
            {labels?.title ?? 'A nudge each day?'}
          </h3>
          <p data-slot="reminder-offer-body" className="text-muted-foreground text-sm text-pretty">
            {labels?.body ??
              'Add a daily reminder to your own calendar. Nothing is sent to us, and you can remove it there any time.'}
          </p>
        </div>
      </div>
      {added ? null : (
        <div data-slot="reminder-offer-controls" className="grid gap-2 @sm:flex @sm:flex-wrap @sm:items-end">
          <label className="grid gap-1 text-sm font-medium" htmlFor={`${id}-time`}>
            {labels?.time ?? 'Time'}
            <input
              id={`${id}-time`}
              type="time"
              data-slot="reminder-offer-time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="border-input bg-background focus-visible:outline-ring h-10 rounded-md border px-3 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
          <Button type="button" data-slot="reminder-offer-add" onClick={add}>
            {labels?.add ?? 'Add to my calendar'}
          </Button>
          {onDismiss ? (
            <Button type="button" variant="ghost" data-slot="reminder-offer-dismiss" onClick={onDismiss}>
              {labels?.dismiss ?? 'Not now'}
            </Button>
          ) : null}
        </div>
      )}
      <p data-slot="reminder-offer-status" aria-live="polite" className="text-sm font-medium empty:hidden">
        {added ? (labels?.added ?? 'Added. Open the file to save it in your calendar.') : ''}
      </p>
    </section>
  );
}
ReminderOffer.displayName = 'ReminderOffer';

export { ReminderOffer };
export type { ReminderOfferProps, ReminderOfferLabels };
