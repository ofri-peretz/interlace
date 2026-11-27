'use client';

/**
 * @interlace/ui — SetupChecklist, SetupTask
 *
 * The few things a new member does to get going (add a photo, pick topics,
 * try a first game), in a card that shows how far they are and what to do
 * next. Tasks can be done in any order; the first one not yet done is the
 * next, and it is the one the card puts forward: by default only it shows
 * its description and action, so the card asks for one thing at a time
 * (`expand="all"` opens every undone task). When every task is done the
 * card says so, and can be put away.
 *
 * ## Content first
 *
 * The card is a `section` named by its title, the tasks an ordered list.
 * Each done task says "Done" in words, not only with its tick. The progress
 * bar is a `progressbar` whose value is read as "2 of 5 done", and the same
 * words sit beside it, in a polite live region, so finishing a task is heard.
 * The next task carries `aria-current="step"`.
 *
 * ## Motion
 *
 * The bar grows to its new length and a task's tick pops in when it is done,
 * timed by `--duration-medium` on `--ease-enter`. A task already done when
 * the card first paints is simply ticked. Under reduced motion both simply
 * change.
 *
 * ## MIN_VIEWPORT — 320
 *
 * A task's action sits under its words, so nothing has to share a narrow row.
 *
 * ## Anatomy
 *
 *   SetupChecklist                 (section — data-slot="setup-checklist", data-complete)
 *     ├─ header
 *     │   ├─ title                 (h2 — data-slot="setup-checklist-title")
 *     │   ├─ description?
 *     │   └─ dismiss?              (Button — when complete and `onDismiss` is given)
 *     ├─ progress                  (data-slot="setup-checklist-progress": count in words + bar)
 *     └─ ol
 *         └─ SetupTask × n         (li — data-slot="setup-task", data-done, data-next, aria-current)
 *             ├─ mark              (tick when done, ring otherwise, aria-hidden)
 *             ├─ title + "Done"    (sr-only when done)
 *             ├─ reward?           (e.g. "+20 XP")
 *             ├─ description?      (shown on the next task, or every undone one with expand="all")
 *             └─ action?           (the same, e.g. a link or button)
 *
 * | Rule | Concept                 | Where in this file                                  |
 * | ---- | ----------------------- | --------------------------------------------------- |
 * | R4   | Extends native el       | `section` / `li` props                               |
 * | R6   | data-slot per part      | setup-checklist / -title / -progress / setup-task    |
 * | R7   | cn + ...rest            | `cn(BASE, className)` + `{...props}`                 |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const                 |
 * | R19  | Tokens only             | `--primary`, `--muted`, `--duration-medium`          |
 * | R26  | A11y from native el     | named section, ol, progressbar, words for each state |
 */

import * as React from 'react';
import { CheckIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';

/** Smallest viable viewport (CSS px) for this pattern. */
export const MIN_VIEWPORT = 320 as const;

export interface SetupTaskProps extends Omit<React.ComponentPropsWithoutRef<'li'>, 'title'> {
  /** What to do, e.g. "Add a profile photo". */
  title: React.ReactNode;
  /** One line on why or how, shown while the task is not done. */
  description?: React.ReactNode;
  /** Whether the member has done it. */
  done?: boolean;
  /** What doing it does, e.g. a link or button; shown while the task is not done. */
  action?: React.ReactNode;
  /** What doing it earns, e.g. "+20 XP". */
  reward?: React.ReactNode;
  /** The word said for a done task. @default 'Done' */
  doneLabel?: string;
}

interface TaskPlace {
  next: boolean;
  /** Whether undone tasks other than the next show their description and action. */
  expandAll: boolean;
}

const TaskContext = React.createContext<TaskPlace | null>(null);

export function SetupTask({
  title,
  description,
  done = false,
  action,
  reward,
  doneLabel = 'Done',
  className,
  ...props
}: SetupTaskProps) {
  const place = React.useContext(TaskContext);
  const next = place?.next ?? false;
  const open = !done && (next || (place?.expandAll ?? true));
  // A task already done when the card first paints is simply ticked; only one done here pops.
  const [doneAtFirst] = React.useState(done);
  return (
    <li
      data-slot="setup-task"
      data-done={done ? '' : undefined}
      data-next={next ? '' : undefined}
      aria-current={next ? 'step' : undefined}
      className={cn(
        'grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg px-3 py-2.5',
        'data-[next]:bg-muted/60',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        data-slot="setup-task-mark"
        className={cn(
          'mt-0.5 flex size-5 items-center justify-center rounded-full border',
          done ? 'bg-primary border-primary text-primary-foreground' : 'border-input',
          next && 'border-primary border-2',
        )}
      >
        {done ? (
          <CheckIcon
            className={cn(
              'size-3.5',
              !doneAtFirst &&
                'motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-(--duration-medium) motion-safe:ease-enter',
            )}
          />
        ) : null}
      </span>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
        <span data-slot="setup-task-title" className={cn('font-medium', done && 'text-muted-foreground font-normal')}>
          {title}
          {done ? <span className="sr-only">{`, ${doneLabel}`}</span> : null}
        </span>
        {reward ? (
          <span data-slot="setup-task-reward" className="text-muted-foreground shrink-0 text-sm tabular-nums">
            {reward}
          </span>
        ) : null}
      </div>
      {open && (description || action) ? (
        <div className="col-start-2 flex flex-col items-start gap-2">
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
          {action ? <div data-slot="setup-task-action">{action}</div> : null}
        </div>
      ) : null}
    </li>
  );
}

export interface SetupChecklistProps extends Omit<React.ComponentPropsWithoutRef<'section'>, 'title'> {
  /** The card's heading, e.g. "Get started". */
  title: React.ReactNode;
  /** One line under it. */
  description?: React.ReactNode;
  /** The heading once every task is done. Defaults to `title`. */
  completeTitle?: React.ReactNode;
  /** The line once every task is done. */
  completeDescription?: React.ReactNode;
  /** Put the card away; offered once every task is done. */
  onDismiss?: () => void;
  /** The dismiss button's words. @default 'Close' */
  dismissLabel?: string;
  /** The progress in words. @default (done, total) => `${done} of ${total} done` */
  progressLabel?: (done: number, total: number) => string;
  /**
   * Which undone tasks show their description and action: only the next one,
   * so the card asks for one thing at a time, or all of them. @default 'next'
   */
  expand?: 'next' | 'all';
  /** Heading level for the title. @default 2 */
  headingLevel?: 2 | 3 | 4;
  /** `SetupTask`s, in the order the member should do them. */
  children?: React.ReactNode;
}

export function SetupChecklist({
  title,
  description,
  completeTitle,
  completeDescription,
  onDismiss,
  dismissLabel = 'Close',
  progressLabel = (done, total) => `${done} of ${total} done`,
  headingLevel = 2,
  expand = 'next',
  className,
  children,
  ...props
}: SetupChecklistProps) {
  const id = React.useId();
  const tasks = React.Children.toArray(children).filter(React.isValidElement<SetupTaskProps>);
  const total = tasks.length;
  const done = tasks.filter((task) => task.props.done).length;
  const nextIndex = tasks.findIndex((task) => !task.props.done);
  const complete = total > 0 && done === total;
  const Heading = `h${headingLevel}` as const;
  const words = progressLabel(done, total);

  return (
    <section
      data-slot="setup-checklist"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-complete={complete ? '' : undefined}
      aria-labelledby={`${id}-title`}
      className={cn('bg-card text-card-foreground flex flex-col gap-4 rounded-xl border p-4 sm:p-5', className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Heading id={`${id}-title`} data-slot="setup-checklist-title" className="text-lg font-semibold">
            {complete && completeTitle ? completeTitle : title}
          </Heading>
          {(complete ? (completeDescription ?? description) : description) ? (
            <p className="text-muted-foreground text-sm">
              {complete ? (completeDescription ?? description) : description}
            </p>
          ) : null}
        </div>
        {complete && onDismiss ? (
          <Button type="button" variant="ghost" size="sm" data-slot="setup-checklist-dismiss" onClick={onDismiss}>
            {dismissLabel}
          </Button>
        ) : null}
      </div>

      <div data-slot="setup-checklist-progress" className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-labelledby={`${id}-title`}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-valuetext={words}
          className="bg-foreground/10 h-2 flex-1 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full origin-left rounded-full transition-transform duration-(--duration-medium) ease-enter motion-reduce:transition-none rtl:origin-right"
            style={{ transform: `scaleX(${total ? done / total : 0})` }}
          />
        </div>
        <p aria-live="polite" className="text-muted-foreground shrink-0 text-sm tabular-nums">
          {words}
        </p>
      </div>

      <ol className="-mx-3 flex flex-col gap-1">
        {tasks.map((task, index) => (
          <TaskContext.Provider key={task.key} value={{ next: index === nextIndex, expandAll: expand === 'all' }}>
            {task}
          </TaskContext.Provider>
        ))}
      </ol>
    </section>
  );
}
