'use client';

/**
 * @interlace/ui — DebateCorners
 *
 * Pick a corner, then defend it. A statement with two to four positions, one for each corner of the
 * room: each person stands in the corner they pick, can move until the host locks the corners, and
 * the host calls one corner at a time to defend its position. After picking, the room's spread is
 * shown (how many are in each corner, yours marked), so a person sees they are not alone and not
 * everyone is with them. It is a poll with a place to stand; the host points at the real corners.
 *
 * ## Anatomy
 *
 *   DebateCorners                      (div — data-slot="debate-corners", data-state=choosing|picked|locked)
 *     ├─ p                             (data-slot="debate-corners-statement", id ← the group's label)
 *     ├─ RadioGroup                    (data-slot="debate-corners-options": one radio per corner, arrows move)
 *     │    └─ Radio                    (data-slot="debate-corners-option": letter, label, count, bar)
 *     └─ p aria-live                   (data-slot="debate-corners-status": where you are, who is defending)
 *
 * ## Data
 *
 * `corners` are two to four `{ id, label }`; `counts` are how many are in each (from your store, with
 * this viewer's pick, as `useRoomCorners` gives them). `value` is this viewer's corner (controlled);
 * `defaultValue` starts uncontrolled; `onPick` fires with the corner's id each time they pick or move.
 * `speaking` is the corner the host called. `locked` stops moving. `minResponses` keeps the spread
 * hidden until that many have picked.
 *
 * Every corner is named by a letter, a word and a count: nothing relies on colour alone, and the
 * corner being defended carries the word `Defending`.
 *
 * ## Motion
 *
 * Bars lengthen to their share (`--duration-fast`); under reduced motion they are simply there.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                         |
 * | ---- | ------------------------- | ---------------------------------------------------------- |
 * | R4   | Extends native el         | `div` props                                                |
 * | R6   | data-slot per part        | debate-corners / -statement / -options / -option / -status |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                          |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onPick`                        |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                       |
 * | R26  | A11y                      | radio group with names and counts; status announced        |
 */

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import * as React from 'react';

import { cn } from '../lib/cn.js';
import type { Corner } from './debate-corners-model.js';

export const MIN_VIEWPORT = 320 as const;

interface DebateCornersLabels {
  /** Under a corner's name. @default (n) => `${n} ${n === 1 ? 'person' : 'people'}` */
  count?: (n: number) => string;
  /** The word on the corner being defended. @default 'Defending' */
  defending?: string;
  /**
   * After picking, once the spread shows. @default ({ corner, count, total }) => `You are in ${corner}. ${count} of ${total} are there with you.`
   */
  status?: (s: { corner: string; count: number; total: number }) => string;
  /** After picking, while fewer than `minResponses` have. @default (min) => `Thanks. The room shows once ${min} people have picked.` */
  pending?: (min: number) => string;
  /** Once the host locks it. @default 'The corners are locked.' */
  locked?: string;
  /** When the host calls a corner. @default (corner) => `${corner} is defending its position.` */
  speaking?: (corner: string) => string;
}

type DebateCornersProps = Omit<React.ComponentProps<'div'>, 'children' | 'defaultValue' | 'onChange'> & {
  statement: React.ReactNode;
  /** Two to four corners, in the order they are drawn. */
  corners: readonly Corner[];
  /** How many are in each corner, by corner id. */
  counts?: Readonly<Record<string, number>>;
  /** The viewer's corner id, controlled. null before they pick. */
  value?: string | null;
  /** The viewer's corner id, uncontrolled. */
  defaultValue?: string | null;
  /** Called with the corner's id each time the viewer picks or moves. */
  onPick?: (corner: string) => void;
  /** The corner the host called to defend its position. */
  speaking?: string | null;
  /** The host locked the corners: nobody moves. @default false */
  locked?: boolean;
  /** Hide the spread until this many have picked. @default 1 */
  minResponses?: number;
  labels?: DebateCornersLabels;
};

const LETTERS = ['A', 'B', 'C', 'D'] as const;
const COUNT: NonNullable<DebateCornersLabels['count']> = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;
const STATUS: NonNullable<DebateCornersLabels['status']> = ({ corner, count, total }) =>
  `You are in ${corner}. ${count} of ${total} are there with you.`;
const PENDING: NonNullable<DebateCornersLabels['pending']> = (min) => `Thanks. The room shows once ${min} people have picked.`;
const SPEAKING: NonNullable<DebateCornersLabels['speaking']> = (corner) => `${corner} is defending its position.`;

function DebateCorners({
  statement,
  corners,
  counts = {},
  value: valueProp,
  defaultValue = null,
  onPick,
  speaking = null,
  locked = false,
  minResponses = 1,
  labels,
  className,
  ...props
}: DebateCornersProps) {
  const [own, setOwn] = React.useState<string | null>(defaultValue);
  const mine = valueProp === undefined ? own : valueProp;
  const statementId = React.useId();
  const count = labels?.count ?? COUNT;

  const total = corners.reduce((sum, c) => sum + (counts[c.id] ?? 0), 0);
  const shown = mine !== null && total >= minResponses;
  const mineCorner = corners.find((c) => c.id === mine);
  const speakingCorner = corners.find((c) => c.id === speaking);

  const status = [
    mineCorner
      ? shown
        ? (labels?.status ?? STATUS)({ corner: mineCorner.label, count: counts[mineCorner.id] ?? 0, total })
        : (labels?.pending ?? PENDING)(minResponses)
      : '',
    speakingCorner ? (labels?.speaking ?? SPEAKING)(speakingCorner.label) : '',
    locked ? (labels?.locked ?? 'The corners are locked.') : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      data-slot="debate-corners"
      data-state={locked ? 'locked' : mine === null ? 'choosing' : 'picked'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container grid gap-4', className)}
      {...props}
    >
      <p id={statementId} data-slot="debate-corners-statement" className="font-heading text-lg font-semibold text-balance">
        {statement}
      </p>

      <RadioGroup
        data-slot="debate-corners-options"
        aria-labelledby={statementId}
        value={mine ?? ''}
        disabled={locked}
        onValueChange={(v) => {
          const id = v as string;
          if (id === mine) return;
          if (valueProp === undefined) setOwn(id);
          onPick?.(id);
        }}
        className="grid gap-2 @md:grid-cols-2"
      >
        {corners.map((c, i) => {
          const n = counts[c.id] ?? 0;
          const isSpeaking = c.id === speaking;
          const countId = `${statementId}-${c.id}`;
          return (
            <Radio.Root
              key={c.id}
              value={c.id}
              aria-label={c.label}
              aria-describedby={shown ? countId : undefined}
              data-slot="debate-corners-option"
              data-speaking={isSpeaking ? '' : undefined}
              className={cn(
                'bg-background text-foreground relative grid min-h-16 gap-1 overflow-hidden rounded-lg border p-3 text-start',
                'motion-safe:transition-colors motion-safe:duration-(--duration-fast) hover:bg-muted',
                'data-[checked]:border-primary data-[checked]:ring-primary data-[checked]:ring-1',
                'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70',
                'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
                isSpeaking && 'border-foreground border-2',
              )}
            >
              <span className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="bg-muted text-muted-foreground grid size-7 shrink-0 place-items-center rounded-md text-sm font-semibold"
                >
                  {LETTERS[i]}
                </span>
                <span className="min-w-0 flex-1 text-base font-semibold text-balance break-words">{c.label}</span>
              </span>
              {isSpeaking ? (
                <span data-slot="debate-corners-speaking" className="text-foreground ps-10 text-sm font-semibold">
                  {labels?.defending ?? 'Defending'}
                </span>
              ) : null}
              {shown ? (
                <span id={countId} data-slot="debate-corners-count" className="text-muted-foreground ps-10 text-sm tabular-nums">
                  {count(n)}
                </span>
              ) : null}
              {shown ? (
                <span aria-hidden className="bg-muted absolute inset-x-0 bottom-0 h-1">
                  <span
                    data-slot="debate-corners-bar"
                    className="bg-primary block h-full motion-safe:transition-[inline-size] motion-safe:duration-(--duration-fast)"
                    style={{ inlineSize: `${total > 0 ? (n / total) * 100 : 0}%` }}
                  />
                </span>
              ) : null}
            </Radio.Root>
          );
        })}
      </RadioGroup>

      <p data-slot="debate-corners-status" aria-live="polite" className="text-sm empty:hidden">
        {status}
      </p>
    </div>
  );
}
DebateCorners.displayName = 'DebateCorners';

export { DebateCorners };
export type { DebateCornersProps, DebateCornersLabels };
