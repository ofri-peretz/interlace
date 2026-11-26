'use client';

/**
 * @interlace/ui — GroupCard and GroupGrid
 *
 * Pairs, small groups and teams. `GroupCard` is what one person's phone
 * shows: which group they are in, who they are with, what to talk about and
 * for how long. `GroupGrid` is the shared screen: every group with its
 * people, where a reshuffle glides each name to its new group, so the room
 * can follow who moved.
 *
 * Build the groups with `games/groups-model` (`makeGroups`, `joinGroups`,
 * `leaveGroups`); for team standings, pass `teamTotals` to `Leaderboard`.
 *
 * ## Anatomy
 *
 *   GroupCard                    (section — data-slot="group-card", data-state=grouped|waiting)
 *     ├─ p                       (data-slot="group-card-label": "Team 2", "Your pair")
 *     ├─ ul                      (data-slot="group-card-members": the others, as chips)
 *     ├─ p                       (data-slot="group-card-prompt")
 *     ├─ TimerRing (deadline)    (data-slot="timer-ring")
 *     └─ span sr-only aria-live  (data-slot="group-card-announce": "You're with Dana and Sam.")
 *   GroupGrid                    (div @container — data-slot="group-grid")
 *     └─ ul (FlipGroup) > li × n                  (data-slot="group-grid-group", aria-current on the viewer's group)
 *          └─ ul > li × m        (data-flip-id per person: names glide between groups)
 *
 * ## Motion
 *
 * A changed group on the phone rises in (200ms; the first one is simply there) and its names follow within
 * 150ms in total. On the screen, a reshuffle glides each name from its old
 * group to its new one (FlipGroup, 400ms). Under reduced motion everything
 * is simply in place.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                              |
 * | ---- | ------------------------- | ----------------------------------------------- |
 * | R4   | Extends native el         | `section` / `div` props                         |
 * | R6   | data-slot per part        | group-card / -label / -members / -prompt / -announce; group-grid / -group |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`               |
 * | R8   | Enums, not booleans       | `size`                                          |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const            |
 * | R26  | A11y                      | names read as a list; group change announced once |
 */

import * as React from 'react';

import { FlipGroup } from '../effects/flip-group.js';
import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { TimerRing } from './timer-ring.js';

export const MIN_VIEWPORT = 320 as const;

// --- GroupCard (phone) -----------------------------------------------------------

interface GroupCardLabels {
  /** Read when the group is set. @default (names) => `You're with ${names}.` */
  with?: (names: string) => string;
  /** No one else in the group yet. @default 'Waiting for someone to join you.' */
  waiting?: string;
  /** Names the timer. @default 'Time to talk' */
  timer?: string;
}

type GroupCardProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  /** What the group is called: "Team 2", "Your pair", a colour. */
  label: React.ReactNode;
  /** The other people in the group, by name. */
  members: readonly string[];
  /** What to talk about or do. */
  prompt?: React.ReactNode;
  /** When the talk ends, as a timestamp; shows a TimerRing. */
  deadline?: number | null;
  /** The talk's whole length, in seconds, for the ring. @default 120 */
  seconds?: number;
  onExpire?: () => void;
  locale?: string;
  labels?: GroupCardLabels;
};

function useRiseIn(key: string, reduced: boolean) {
  const ref = React.useRef<HTMLElement | null>(null);
  // The group shown on mount is already the state: only a change rises in.
  const shown = React.useRef(key);
  React.useEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    const el = ref.current;
    if (!el || reduced || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: 'translateY(8px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      {
        duration: 200,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    );
    const chips = el.querySelectorAll<HTMLElement>('[data-slot="group-card-member"]');
    // 150ms in total across the names, however many there are.
    const step = chips.length > 1 ? 150 / (chips.length - 1) : 0;
    chips.forEach((chip, i) => {
      if (typeof chip.animate !== 'function') return;
      chip.animate(
        [
          { transform: 'scale(0.9)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        {
          duration: 200,
          delay: Math.round(i * step),
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'backwards',
        },
      );
    });
  }, [key, reduced]);
  return ref;
}

function GroupCard({
  label,
  members,
  prompt,
  deadline,
  seconds = 120,
  onExpire,
  locale,
  labels,
  className,
  ...props
}: GroupCardProps) {
  const reduced = useReducedMotion();
  const key = members.join('\u0000');
  const ref = useRiseIn(key, reduced);
  const list = React.useMemo(() => new Intl.ListFormat(locale, { type: 'conjunction' }), [locale]);
  const waiting = members.length === 0;
  const sentence = waiting
    ? (labels?.waiting ?? 'Waiting for someone to join you.')
    : (labels?.with ?? ((n: string) => `You're with ${n}.`))(list.format(members));

  return (
    <section
      ref={ref as React.Ref<HTMLElement>}
      data-slot="group-card"
      data-state={waiting ? 'waiting' : 'grouped'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('bg-card text-card-foreground grid gap-4 rounded-xl border p-5', className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <p data-slot="group-card-label" className="font-heading text-2xl font-semibold text-balance">
          {label}
        </p>
        {deadline !== undefined ? (
          <TimerRing
            seconds={seconds}
            deadline={deadline}
            onExpire={onExpire}
            labels={{ name: labels?.timer ?? 'Time to talk' }}
          />
        ) : null}
      </div>
      {waiting ? (
        <p className="text-muted-foreground text-sm">{sentence}</p>
      ) : (
        <ul data-slot="group-card-members" className="flex flex-wrap gap-2">
          {members.map((name) => (
            <li
              key={name}
              data-slot="group-card-member"
              className="bg-primary/10 text-foreground rounded-full px-3 py-1 text-sm font-medium"
            >
              {name}
            </li>
          ))}
        </ul>
      )}
      {prompt ? (
        <p data-slot="group-card-prompt" className="text-lg text-pretty">
          {prompt}
        </p>
      ) : null}
      <span data-slot="group-card-announce" aria-live="polite" className="sr-only">
        {waiting ? '' : sentence}
      </span>
    </section>
  );
}
GroupCard.displayName = 'GroupCard';

// --- GroupGrid (screen) ----------------------------------------------------------

interface GridGroup {
  id: string;
  label: React.ReactNode;
  /** People in the group, as `{ id, name }` so a name can glide when it moves. */
  members: readonly { id: string; name: string }[];
}

type GroupGridProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  groups: readonly GridGroup[];
  /** The viewer's group, marked. */
  current?: string;
  /** `stage` for a shared screen. @default 'default' */
  size?: 'default' | 'stage';
};

function GroupGrid({ groups, current, size = 'default', className, ...props }: GroupGridProps) {
  const stage = size === 'stage';
  return (
    <div
      data-slot="group-grid"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container', className)}
      {...props}
    >
      <FlipGroup render={<ul />} className={cn('grid gap-3 @md:grid-cols-2 @4xl:grid-cols-3', stage && 'gap-4')}>
        {groups.map((g) => (
          <li
            key={g.id}
            data-slot="group-grid-group"
            aria-current={current === g.id ? 'true' : undefined}
            className={cn(
              'grid content-start gap-2 rounded-lg border p-4',
              current === g.id ? 'border-primary bg-primary/5' : 'bg-card',
            )}
          >
            <p className={cn('font-heading font-semibold', stage ? 'text-xl' : 'text-base')}>{g.label}</p>
            <ul className="flex flex-wrap gap-1.5">
              {g.members.map((m) => (
                <li
                  key={m.id}
                  data-flip-id={m.id}
                  className={cn('bg-muted rounded-full px-2.5 py-0.5', stage ? 'text-base' : 'text-sm')}
                >
                  {m.name}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </FlipGroup>
    </div>
  );
}
GroupGrid.displayName = 'GroupGrid';

export { GroupCard, GroupGrid };
export type { GroupCardProps, GroupCardLabels, GroupGridProps, GridGroup };
