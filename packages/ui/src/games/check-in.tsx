'use client';

/**
 * @interlace/ui — CheckIn
 *
 * "How are you arriving?" Pick the face that fits. Everyone answers in one tap, in the lobby while
 * the room fills or at the start of a session, and the room's mood shows as a spread: how many chose
 * each, the one most chose, and, when the same question was asked earlier, how the room's mood moved
 * since. People can change their pick until the host closes it. Every face has a word, so nothing
 * depends on seeing a drawing.
 *
 * ## Not anonymous
 *
 * On a live room each pick is held by the person's id (so they can change it), which the host, and
 * anyone reading the room's state directly, can see. The screens never show names, and the
 * component says so before the person picks (`labels.privacy`); it is not a promise of anonymity.
 *
 * ## Anatomy
 *
 *   CheckIn                          (div — data-slot="check-in", data-state=choosing|picked|closed)
 *     ├─ p                           (data-slot="check-in-prompt", id ← the group's label)
 *     ├─ RadioGroup                  (data-slot="check-in-moods": one radio per mood, arrows move)
 *     │    └─ Radio                  (data-slot="check-in-mood": the face, the word)
 *     ├─ div aria-hidden             (data-slot="check-in-spread": one bar per mood, after picking)
 *     └─ p aria-live                 (data-slot="check-in-status": the picture in one sentence)
 *
 * ## Data
 *
 * `moods` are from `check-in-model` (`DEFAULT_MOODS` is five). `picks` are the room's picks for this
 * round (mood id by player id), `before` an earlier round of the same question. `value` is this
 * viewer's mood (controlled), `defaultValue` starts uncontrolled, `onPick` fires with the mood's id
 * each time they pick or change. `faces` draws a face per mood id: the consumer's icons, since the
 * kit ships none. `minResponses` hides the spread until that many have picked.
 *
 * ## Motion
 *
 * Bars lengthen to their share (`--duration-fast`); under reduced motion they are simply there.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `div` props                                          |
 * | R6   | data-slot per part        | check-in / -prompt / -moods / -mood / -spread / -status |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onPick`                  |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | radio group with words; status announced             |
 */

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import * as React from 'react';

import { cn } from '../lib/cn.js';
import { moodShift, summarizeMoods, type Mood } from './check-in-model.js';

export const MIN_VIEWPORT = 320 as const;

interface CheckInLabels {
  /**
   * After picking, once the spread shows.
   * @default ({ count, top, mine }) => `${count} checked in. Most chose ${top}. You chose ${mine}.`
   */
  status?: (s: { count: string; top: string; mine: string }) => string;
  /** When the mood moved since `before`. `shift` is signed, to one decimal. @default (shift) => `The room's mood moved ${shift} since before.` */
  shift?: (shift: string) => string;
  /** While fewer than `minResponses` have picked. @default (min) => `Thanks. The room shows once ${min} people have checked in.` */
  pending?: (min: number) => string;
  /** Once the host closes it. @default 'The check-in is closed.' */
  closed?: string;
  /**
   * What a person is told about who can see their pick. The room holds each pick by the person's id
   * so they can change it, so the host can see who chose what: this says so. Set it to '' only when
   * your own server aggregates the picks and the host cannot.
   * @default 'The host can see who chose which face.'
   */
  privacy?: string;
}

type CheckInProps = Omit<React.ComponentProps<'div'>, 'children' | 'defaultValue' | 'onChange'> & {
  /** The question. */
  prompt: React.ReactNode;
  moods: readonly Mood[];
  /** The room's picks this round: mood id by player id. */
  picks?: Readonly<Record<string, string>>;
  /** An earlier round of the same question, to show how the room's mood moved. */
  before?: Readonly<Record<string, string>>;
  /** The viewer's mood id, controlled. null before they pick. */
  value?: string | null;
  /** The viewer's mood id, uncontrolled. */
  defaultValue?: string | null;
  onPick?: (mood: string) => void;
  /** A face for each mood id, drawn by you. */
  faces?: Readonly<Record<string, React.ReactNode>>;
  /** The host closed it: nobody changes. @default false */
  closed?: boolean;
  /** Hide the spread until this many have picked. @default 1 */
  minResponses?: number;
  locale?: string;
  labels?: CheckInLabels;
};

const STATUS: NonNullable<CheckInLabels['status']> = ({ count, top, mine }) => `${count} checked in. Most chose ${top}. You chose ${mine}.`;
const SHIFT: NonNullable<CheckInLabels['shift']> = (shift) => `The room's mood moved ${shift} since before.`;
const PENDING: NonNullable<CheckInLabels['pending']> = (min) => `Thanks. The room shows once ${min} people have checked in.`;

function CheckIn({
  prompt,
  moods,
  picks = {},
  before,
  value: valueProp,
  defaultValue = null,
  onPick,
  faces,
  closed = false,
  minResponses = 1,
  locale,
  labels,
  className,
  ...props
}: CheckInProps) {
  const [own, setOwn] = React.useState<string | null>(defaultValue);
  const mine = valueProp === undefined ? own : valueProp;
  const promptId = React.useId();
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const signed = React.useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' }), [locale]);

  const room = summarizeMoods(moods, picks);
  const shown = mine !== null && room.count >= minResponses;
  const mineMood = moods.find((m) => m.id === mine);
  const topMood = moods.find((m) => m.id === room.top);
  const shift = before && Object.keys(before).length > 0 ? moodShift(moods, before, picks) : null;

  const status = [
    mineMood ? (shown && topMood ? (labels?.status ?? STATUS)({ count: nf.format(room.count), top: topMood.label, mine: mineMood.label }) : (labels?.pending ?? PENDING)(minResponses)) : '',
    mineMood && shown && shift !== null ? (labels?.shift ?? SHIFT)(signed.format(shift)) : '',
    closed ? (labels?.closed ?? 'The check-in is closed.') : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      data-slot="check-in"
      data-state={closed ? 'closed' : mine === null ? 'choosing' : 'picked'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      <p id={promptId} data-slot="check-in-prompt" className="font-heading text-lg font-semibold text-balance">
        {prompt}
      </p>

      <RadioGroup
        data-slot="check-in-moods"
        aria-labelledby={promptId}
        value={mine}
        disabled={closed}
        onValueChange={(v) => {
          const id = v as string;
          if (id === mine) return;
          if (valueProp === undefined) setOwn(id);
          onPick?.(id);
        }}
        className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-1.5"
      >
        {moods.map((m) => (
          <Radio.Root
            key={m.id}
            value={m.id}
            data-slot="check-in-mood"
            className={cn(
              'bg-background text-foreground grid min-h-16 place-items-center content-center gap-1 rounded-lg border p-2 text-sm font-semibold',
              'motion-safe:transition-colors motion-safe:duration-(--duration-fast) hover:bg-muted',
              'data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[checked]:border-primary',
              'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70',
              'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
              '[&_svg]:size-6',
            )}
          >
            {faces?.[m.id] ? <span aria-hidden>{faces[m.id]}</span> : null}
            <span>{m.label}</span>
          </Radio.Root>
        ))}
      </RadioGroup>

      {shown ? (
        <div aria-hidden data-slot="check-in-spread" className="flex h-16 items-end gap-1.5 border-b">
          {room.counts.map((c) => (
            <span
              key={c.id}
              data-slot="check-in-bar"
              data-mine={c.id === mine ? '' : undefined}
              className={cn(
                'block flex-1 rounded-t-sm motion-safe:transition-[height] motion-safe:duration-(--duration-fast)',
                c.id === mine ? 'bg-primary' : 'bg-foreground/25',
              )}
              style={{ height: `${Math.max(room.count > 0 ? (c.count / Math.max(...room.counts.map((x) => x.count), 1)) * 100 : 0, c.count > 0 ? 6 : 0)}%` }}
            />
          ))}
        </div>
      ) : null}

      {mine === null && (labels?.privacy ?? 'The host can see who chose which face.') ? (
        <p data-slot="check-in-privacy" className="text-muted-foreground text-sm">
          {labels?.privacy ?? 'The host can see who chose which face.'}
        </p>
      ) : null}

      <p data-slot="check-in-status" aria-live="polite" className="text-sm empty:hidden">
        {status}
      </p>
    </div>
  );
}
CheckIn.displayName = 'CheckIn';

export { CheckIn };
export type { CheckInProps, CheckInLabels };
