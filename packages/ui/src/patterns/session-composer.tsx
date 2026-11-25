'use client';

/**
 * @interlace/ui — SessionComposer
 *
 * Build a session out of modules: pick what goes in, put it in order, and
 * see at every step how long it runs against the time you have. For a
 * workshop host planning a morning, a community lead booking a session, a
 * teacher putting a lesson together. Modules a group has already had are
 * marked, so nobody sits through the same hour twice.
 *
 * ## Anatomy
 *
 *   SessionComposer                (div @container — data-slot="session-composer", data-over)
 *     ├─ section                   (data-slot="session-composer-catalogue")
 *     │   ├─ h2|h3                 (catalogue heading)
 *     │   └─ ul
 *     │       └─ li × n            (data-slot="session-composer-module", data-in, data-seen, data-fits)
 *     │           ├─ p             (title; minutes, "Seen before", "Always included")
 *     │           ├─ p?            (summary)
 *     │           └─ Button        (data-slot="session-composer-toggle": Add / Remove, aria-pressed)
 *     ├─ section                   (data-slot="session-composer-plan")
 *     │   ├─ h2|h3                 (plan heading)
 *     │   ├─ Meter                 (data-slot="meter": minutes of the limit, negative tone when over)
 *     │   ├─ ol                    (data-slot="session-composer-plan-list")
 *     │   │   └─ li × n            (data-slot="session-composer-step", data-required)
 *     │   │       ├─ span          (position, title, minutes)
 *     │   │       └─ div role=group (move up, move down, remove; none on a required module)
 *     │   ├─ p                     (data-slot="session-composer-empty", before anything is in)
 *     │   └─ div?                  (data-slot="session-composer-footer": e.g. "Request this session")
 *     └─ span aria-live            (data-slot="session-composer-announce": "Added Logs. 75 of 90 minutes.")
 *
 * ## Data
 *
 * A plan is an ordered list of module ids: `value` / `defaultValue` /
 * `onValueChange`. The rules (what fits, where an added module goes, how a
 * move clamps, which modules can never leave) are in
 * `patterns/session-plan-model`, so a server can check a submitted plan the
 * same way. `required` modules (an opening, a close) are always in and stay
 * where they are. `seen` ids are modules the group had before.
 *
 * ## Motion
 *
 * A module added to the plan grows in by scale (240ms). Transform only; off
 * under reduced motion. Moving keeps focus on the moved module's control.
 *
 * ## MIN_VIEWPORT — 320
 *
 * One column under 48rem of its own width; catalogue and plan side by side
 * from there.
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                        |
 * | R6   | data-slot per part        | session-composer-*                                   |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onValueChange`           |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | named controls per module; every change announced    |
 */

import * as React from 'react';
import { ArrowDown, ArrowUp, Check, Plus, X } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { Meter } from '../primitives/meter.js';
import {
  addToPlan,
  canMove,
  cleanPlan,
  fitsPlan,
  movePlan,
  removeFromPlan,
  summarizePlan,
  type PlanOptions,
} from './session-plan-model.js';

export const MIN_VIEWPORT = 320 as const;

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

interface SessionModule {
  id: string;
  title: string;
  minutes: number;
  summary?: React.ReactNode;
}

interface SessionComposerLabels {
  /** @default 'Modules' */
  catalogue?: string;
  /** @default 'Your session' */
  plan?: string;
  /** @default 'Add' */
  add?: string;
  /** @default 'Remove' */
  remove?: string;
  /** @default (title) => `Move ${title} up` */
  moveUp?: (title: string) => string;
  /** @default (title) => `Move ${title} down` */
  moveDown?: (title: string) => string;
  /** @default (title) => `Remove ${title}` */
  removeNamed?: (title: string) => string;
  /** @default (n) => `${n} min` */
  minutes?: (minutes: number, formatted: string) => string;
  /** @default 'Seen before' */
  seen?: string;
  /** @default 'Always included' */
  required?: string;
  /** @default 'Session length' */
  length?: string;
  /** The meter's printed value. */
  total?: (minutes: string, max: string | null) => string;
  /** Under the meter when the plan runs long. */
  over?: (minutes: string) => string;
  /** Why a module cannot be added. */
  noRoom?: (needs: string, left: string) => string;
  /** @default 'Add modules to build the session.' */
  empty?: string;
  /** Announced after a change. */
  added?: (title: string, total: string) => string;
  removed?: (title: string, total: string) => string;
  moved?: (title: string, position: number, count: number) => string;
}

type SessionComposerProps = Omit<React.ComponentProps<'div'>, 'children' | 'defaultValue' | 'onChange'> & {
  modules: readonly SessionModule[];
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (ids: string[]) => void;
  /** The most minutes the session may run. */
  maxMinutes?: number | null;
  /** Always in, in place, and not removable. */
  required?: readonly string[];
  /** Modules this group had before. */
  seen?: readonly string[];
  /** Under the plan: the next step, e.g. a request button. */
  footer?: React.ReactNode;
  /** Heading level for the two sections. @default 'h2' */
  headingAs?: 'h2' | 'h3' | 'h4';
  locale?: string;
  labels?: SessionComposerLabels;
};

function SessionComposer({
  modules,
  value: valueProp,
  defaultValue = [],
  onValueChange,
  maxMinutes = null,
  required = [],
  seen = [],
  footer,
  headingAs: Heading = 'h2',
  locale,
  labels,
  className,
  ...props
}: SessionComposerProps) {
  const options: PlanOptions = { maxMinutes, required };
  const [uncontrolled, setUncontrolled] = React.useState<string[]>(() => cleanPlan(modules, defaultValue, options));
  const ids = cleanPlan(modules, valueProp ?? uncontrolled, options);
  const summary = summarizePlan(modules, ids, options);
  const byId = new Map(modules.map((m) => [m.id, m]));
  const seenSet = new Set(seen);
  const requiredSet = new Set(required);
  const reduced = useReducedMotion();
  const [announce, setAnnounce] = React.useState('');
  const planRef = React.useRef<HTMLOListElement>(null);
  const planHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const grow = React.useRef<string | null>(null);
  const focusAfter = React.useRef<{ id: string; control: 'up' | 'down' | 'remove' } | 'heading' | null>(null);
  const catalogueId = React.useId();
  const planId = React.useId();
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const min = (n: number) => (labels?.minutes ?? ((_: number, f: string) => `${f} min`))(n, nf.format(n));
  const limit = typeof maxMinutes === 'number' && Number.isFinite(maxMinutes) && maxMinutes > 0 ? maxMinutes : null;
  const maxText = limit === null ? null : min(limit);
  const totalLabel = labels?.total ?? ((t: string, max: string | null) => (max ? `${t} of ${max}` : t));
  const stepEl = (id: string) =>
    [...(planRef.current?.querySelectorAll<HTMLElement>('[data-step-id]') ?? [])].find((el) => el.dataset.stepId === id);

  const commit = (next: string[]) => {
    if (valueProp === undefined) setUncontrolled(next);
    onValueChange?.(next);
  };

  React.useLayoutEffect(() => {
    const id = grow.current;
    grow.current = null;
    if (id && !reduced) {
      const el = stepEl(id);
      if (el && typeof el.animate === 'function') {
        el.animate([{ transform: 'scale(0.92)' }, { transform: 'scale(1)' }], { duration: 240, easing: EASE });
      }
    }
    const f = focusAfter.current;
    focusAfter.current = null;
    if (f === 'heading') planHeadingRef.current?.focus();
    else if (f) {
      const step = stepEl(f.id);
      const want = step?.querySelector<HTMLButtonElement>(`[data-control="${f.control}"]`);
      const fallback = step?.querySelector<HTMLButtonElement>('[data-control]:not(:disabled)');
      (want && !want.disabled ? want : fallback)?.focus();
    }
  });

  const totalAfter = (next: string[]) => totalLabel(min(summarizePlan(modules, next, options).minutes), maxText);

  const add = (m: SessionModule) => {
    const next = addToPlan(modules, ids, m.id, options);
    grow.current = m.id;
    setAnnounce((labels?.added ?? ((t, total) => `Added ${t}. ${total}.`))(m.title, totalAfter(next)));
    commit(next);
  };

  const remove = (m: SessionModule, from: 'catalogue' | 'plan') => {
    const next = removeFromPlan(modules, ids, m.id, options);
    if (from === 'plan') {
      const at = ids.indexOf(m.id);
      const neighbour = next.slice(at).find((x) => !requiredSet.has(x)) ?? next.slice(0, at).reverse().find((x) => !requiredSet.has(x));
      focusAfter.current = neighbour ? { id: neighbour, control: 'remove' } : 'heading';
    }
    setAnnounce((labels?.removed ?? ((t, total) => `Removed ${t}. ${total}.`))(m.title, totalAfter(next)));
    commit(next);
  };

  const move = (m: SessionModule, delta: -1 | 1) => {
    const next = movePlan(modules, ids, m.id, delta, options);
    focusAfter.current = { id: m.id, control: delta < 0 ? 'up' : 'down' };
    setAnnounce(
      (labels?.moved ?? ((t, p, n) => `${t} moved to ${p} of ${n}.`))(m.title, next.indexOf(m.id) + 1, next.length),
    );
    commit(next);
  };

  return (
    <div
      data-slot="session-composer"
      data-over={summary.over > 0 ? '' : undefined}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container', className)}
      {...props}
    >
      <div className="grid gap-8 @3xl:grid-cols-2 @3xl:gap-10">
        <section data-slot="session-composer-catalogue" aria-labelledby={catalogueId} className="grid content-start gap-4">
          <Heading id={catalogueId} className="font-heading text-lg font-semibold">
            {labels?.catalogue ?? 'Modules'}
          </Heading>
          <ul className="grid gap-3">
            {modules.map((m) => {
              const isIn = ids.includes(m.id);
              const isRequired = requiredSet.has(m.id);
              const fits = isIn || fitsPlan(modules, ids, m.id, options);
              const titleId = `${catalogueId}-${m.id}`;
              const noRoom =
                !fits && summary.remaining !== null
                  ? (labels?.noRoom ?? ((needs, left) => `Needs ${needs}; ${left} left.`))(min(m.minutes), min(summary.remaining))
                  : null;
              return (
                <li
                  key={m.id}
                  data-slot="session-composer-module"
                  data-in={isIn ? '' : undefined}
                  data-seen={seenSet.has(m.id) ? '' : undefined}
                  data-fits={fits ? '' : undefined}
                  className={cn(
                    'bg-card text-card-foreground grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 rounded-xl border p-4',
                    isIn && 'border-primary',
                  )}
                >
                  <p id={titleId} className="min-w-0 font-medium text-pretty">
                    {m.title}
                  </p>
                  <div className="row-span-3 self-center">
                    {isRequired ? null : (
                      <Button
                        type="button"
                        size="sm"
                        variant={isIn ? 'secondary' : 'outline'}
                        data-slot="session-composer-toggle"
                        aria-describedby={titleId}
                        disabled={!isIn && !fits}
                        onClick={() => (isIn ? remove(m, 'catalogue') : add(m))}
                      >
                        {isIn ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                        {isIn ? (labels?.remove ?? 'Remove') : (labels?.add ?? 'Add')}
                      </Button>
                    )}
                  </div>
                  <p className="text-muted-foreground flex flex-wrap gap-x-3 text-sm">
                    <span className="tabular-nums">{min(m.minutes)}</span>
                    {seenSet.has(m.id) ? <span>{labels?.seen ?? 'Seen before'}</span> : null}
                    {isRequired ? <span>{labels?.required ?? 'Always included'}</span> : null}
                    {noRoom ? <span>{noRoom}</span> : null}
                  </p>
                  {m.summary ? <p className="text-muted-foreground text-sm text-pretty">{m.summary}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section data-slot="session-composer-plan" aria-labelledby={planId} className="grid content-start gap-4">
          <Heading
            ref={planHeadingRef as React.Ref<HTMLHeadingElement>}
            id={planId}
            tabIndex={-1}
            className="font-heading focus-visible:outline-ring rounded-sm text-lg font-semibold outline-offset-4 focus-visible:outline-2"
          >
            {labels?.plan ?? 'Your session'}
          </Heading>
          {limit === null ? (
            <p data-slot="session-composer-length" className="text-sm">
              <span className="text-muted-foreground">{labels?.length ?? 'Session length'}: </span>
              <span className="font-medium tabular-nums">{min(summary.minutes)}</span>
            </p>
          ) : (
            <Meter
              label={labels?.length ?? 'Session length'}
              value={summary.minutes}
              max={limit}
              tone={summary.over > 0 ? 'negative' : 'default'}
              display={totalLabel(min(summary.minutes), maxText)}
              note={
                summary.over > 0
                  ? (labels?.over ?? ((t) => `${t} over. Remove a module to fit.`))(min(summary.over))
                  : undefined
              }
            />
          )}
          {ids.length ? (
            <ol ref={planRef} data-slot="session-composer-plan-list" className="grid gap-2">
              {ids.map((id, i) => {
                const m = byId.get(id)!;
                const isRequired = requiredSet.has(id);
                return (
                  <li
                    key={id}
                    data-slot="session-composer-step"
                    data-step-id={id}
                    data-required={isRequired ? '' : undefined}
                    className="bg-card text-card-foreground flex items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <span aria-hidden="true" className="text-muted-foreground w-5 text-end text-sm tabular-nums">
                      {nf.format(i + 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-pretty">{m.title}</span>
                      <span className="text-muted-foreground block text-sm tabular-nums">
                        {min(m.minutes)}
                        {isRequired ? ` · ${labels?.required ?? 'Always included'}` : ''}
                      </span>
                    </span>
                    {isRequired ? null : (
                      <div role="group" aria-label={m.title} className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          data-control="up"
                          aria-label={(labels?.moveUp ?? ((t) => `Move ${t} up`))(m.title)}
                          disabled={!canMove(modules, ids, id, -1, options)}
                          onClick={() => move(m, -1)}
                        >
                          <ArrowUp aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          data-control="down"
                          aria-label={(labels?.moveDown ?? ((t) => `Move ${t} down`))(m.title)}
                          disabled={!canMove(modules, ids, id, 1, options)}
                          onClick={() => move(m, 1)}
                        >
                          <ArrowDown aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          data-control="remove"
                          aria-label={(labels?.removeNamed ?? ((t) => `Remove ${t}`))(m.title)}
                          onClick={() => remove(m, 'plan')}
                        >
                          <X aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p data-slot="session-composer-empty" className="text-muted-foreground text-sm">
              {labels?.empty ?? 'Add modules to build the session.'}
            </p>
          )}
          {footer ? <div data-slot="session-composer-footer">{footer}</div> : null}
        </section>
      </div>
      <span data-slot="session-composer-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
SessionComposer.displayName = 'SessionComposer';

export { SessionComposer };
export type { SessionComposerProps, SessionComposerLabels, SessionModule };
