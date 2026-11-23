'use client';

/**
 * @interlace/ui — DialogueStepper
 *
 * A `Dialogue` the reader steps through: one step of turns at a time, each
 * revealed by a choice ("What do I say?", "They might ask…"). A choice can
 * branch to any step, the reader can go back, reset, or show the whole
 * conversation at once. Use it for a practice conversation, an onboarding
 * script, or a support flow written as a dialogue.
 *
 * ## Progressive enhancement
 *
 * The server renders every step. In the browser only the steps on the
 * reader's path show. Without JavaScript a `<noscript>` style shows every
 * step in document order and hides the choices and controls, so the page is
 * the whole conversation, read top to bottom. Server and client start from
 * the same state, so nothing shifts when the page hydrates.
 *
 * ## Path
 *
 * The path starts at `start`. A choice appends its `next` step; choosing a
 * step that is already on the path goes back to it instead of repeating it.
 * Steps show in path order, so a branch reads in the order it was taken.
 * Only the last step's choices are live: earlier ones are hidden once the
 * reader has moved on.
 *
 * ## Server components
 *
 * Pass a step's choices through its `choices` prop, and import the named
 * parts (`DialogueStep`, `DialogueChoices`, `DialogueChoice`) rather than
 * `DialogueStepper.Step`. A server component holds only a reference to each
 * client part, so the dot form is undefined there and a `DialogueChoices`
 * child cannot be told apart from a turn. Choices written as children still
 * work when the whole tree renders on the client.
 *
 * ## Focus and announcements
 *
 * After a choice, focus moves to the first choice of the new step (or to
 * Back, when the step ends the talk), so a keyboard reader can keep going
 * without hunting. The new step's words are read out once through a polite
 * live region. Pending steps are hidden with a class, not the `hidden`
 * attribute, so the no-JS style can show them: a preflight rule for
 * `[hidden]` sits in a cascade layer, and its `!important` would beat it.
 * The step enters with a short fade and rise, behind
 * `motion-safe:`, so reduced motion shows it at once.
 *
 * ## Anatomy
 *
 *   DialogueStepper                 (div — data-slot="dialogue-stepper", data-mode)
 *     ├─ DialogueStep × n           (div role=group — data-step, data-state=current|past|pending)
 *     │   ├─ Dialogue               (ol — the step's turns, `Dialogue.Turn` children)
 *     │   └─ DialogueChoices        (div — choices for the next step)
 *     │       └─ DialogueChoice × n (button — `next` step id)
 *     ├─ controls                   (div — Back, Show the whole talk / Step through, Start over)
 *     ├─ live region                (div — polite, visually hidden)
 *     └─ noscript                   (style — every step, no choices, no controls)
 *
 * ## MIN_VIEWPORT — 320
 *
 * As `Dialogue`: bubbles cap at 85% of the column; choices and controls wrap.
 *
 * | Rule | Concept                 | Where in this file                                         |
 * | ---- | ----------------------- | ---------------------------------------------------------- |
 * | R4   | Extends native el       | `div` / `button` props                                     |
 * | R6   | data-slot per part      | dialogue-stepper / -step / -choices / -choice / -controls  |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                          |
 * | R8   | Enums, not booleans     | `mode`, `data-state`                                       |
 * | R14  | Declares min viewport   | `data-min-viewport` on the root + exported const           |
 * | R19  | Tokens only             | `--duration-base`, `ease-enter`, Dialogue's own tokens     |
 * | R25  | Client component        | Path state, focus and the live region need hooks           |
 * | R26  | A11y                    | Real buttons; polite live region; focus follows the reader |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Dialogue, DialogueSuggestions } from './dialogue.js';

export const MIN_VIEWPORT = 320 as const;

export type DialogueStepperMode = 'step' | 'all';

export interface DialogueStepperLabels {
  back: string;
  showAll: string;
  stepThrough: string;
  reset: string;
}

const DEFAULT_LABELS: DialogueStepperLabels = {
  back: 'Back',
  showAll: 'Show the whole conversation',
  stepThrough: 'Step through',
  reset: 'Start over',
};

type Ctx = {
  mode: DialogueStepperMode;
  path: string[];
  speakers: 'above' | 'inside';
  choose: (next: string) => void;
};

const StepperContext = React.createContext<Ctx | null>(null);
type StepCtx = { id: string; state: StepState };
type StepState = 'current' | 'past' | 'pending';
const StepContext = React.createContext<StepCtx | null>(null);

function useStepper(part: string): Ctx {
  const ctx = React.useContext(StepperContext);
  if (!ctx) throw new Error(`<${part}> must be inside <DialogueStepper>.`);
  return ctx;
}

type DialogueStepperProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** The id of the first step. */
  start: string;
  /** `DialogueStep` elements, each with a unique `id`. */
  children: React.ReactNode;
  /** Where each turn names its speaker, as on `Dialogue`. @default 'above' */
  speakers?: 'above' | 'inside';
  /** Open with every step shown. @default 'step' */
  defaultMode?: DialogueStepperMode;
  /** The control labels, for another language. */
  labels?: Partial<DialogueStepperLabels>;
};

function stepId(node: React.ReactNode): string | null {
  return React.isValidElement<{ id?: unknown }>(node) && typeof node.props.id === 'string'
    ? node.props.id
    : null;
}

const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/** A step's turns as one sentence each, "Speaker: words.", for the live region. */
function spoken(step: HTMLElement): string {
  return Array.from(step.querySelectorAll('[data-slot="dialogue-turn"]'))
    .map((turn) => {
      const speaker = text(turn.querySelector('[data-slot="dialogue-speaker"]'));
      const words = text(turn.querySelector('[data-slot="dialogue-bubble"]'));
      return speaker ? `${speaker}: ${words}` : words;
    })
    .join(' ');
}

function DialogueStepper({
  start,
  children,
  speakers = 'above',
  defaultMode = 'step',
  labels: labelsProp,
  className,
  ...props
}: DialogueStepperProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const [mode, setMode] = React.useState<DialogueStepperMode>(defaultMode);
  const [path, setPath] = React.useState<string[]>([start]);
  const [announcement, setAnnouncement] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement>(null);
  const backRef = React.useRef<HTMLButtonElement>(null);
  // Set by a choice, read once the new step is in the DOM.
  const pendingFocus = React.useRef<string | null>(null);

  const choose = React.useCallback((next: string) => {
    setPath((current) => {
      const at = current.indexOf(next);
      // A step already on the path: go back to it rather than repeat it.
      return at === -1 ? [...current, next] : current.slice(0, at + 1);
    });
    pendingFocus.current = next;
  }, []);

  React.useEffect(() => {
    const next = pendingFocus.current;
    if (!next || mode !== 'step') return;
    pendingFocus.current = null;
    const step = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[data-slot="dialogue-step"]') ?? [],
    ).find((el) => el.dataset.step === next);
    if (!step) return;
    setAnnouncement(spoken(step));
    const firstChoice = step.querySelector<HTMLElement>('[data-slot="dialogue-choice"]');
    (firstChoice ?? backRef.current)?.focus();
  }, [path, mode]);

  React.useEffect(() => {
    // A DialogueChoices child of a server component cannot be recognised,
    // so it lands in the step's list of turns.
    if (rootRef.current?.querySelector('[data-slot="dialogue"] [data-slot="dialogue-choices"]')) {
      console.warn(
        '<DialogueChoices> is inside a list of turns. Pass it through <DialogueStep choices={…}> when a server component renders the step.',
      );
    }
  }, []);

  const items = React.Children.toArray(children);
  const ordered =
    mode === 'step'
      ? [
          ...path.map((id) => items.find((c) => stepId(c) === id)).filter(Boolean),
          ...items.filter((c) => !path.includes(stepId(c) ?? '')),
        ]
      : items;

  const ctx = React.useMemo<Ctx>(() => ({ mode, path, speakers, choose }), [mode, path, speakers, choose]);

  const control =
    'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-control items-center rounded-full px-3 text-sm font-medium underline-offset-4 transition-[color,box-shadow] duration-(--duration-fast) outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50';

  return (
    <StepperContext.Provider value={ctx}>
      <div
        ref={rootRef}
        data-slot="dialogue-stepper"
        data-mode={mode}
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('flex flex-col gap-4', className)}
        {...props}
      >
        {ordered}
        <div data-slot="dialogue-stepper-controls" className="flex flex-wrap items-center gap-1 border-t pt-3">
          <button
            ref={backRef}
            type="button"
            className={control}
            disabled={mode !== 'step' || path.length < 2}
            onClick={() => setPath((current) => current.slice(0, -1))}
          >
            {labels.back}
          </button>
          <button
            type="button"
            className={control}
            aria-pressed={mode === 'all'}
            onClick={() => setMode((m) => (m === 'all' ? 'step' : 'all'))}
          >
            {mode === 'all' ? labels.stepThrough : labels.showAll}
          </button>
          <button
            type="button"
            className={control}
            disabled={mode === 'step' && path.length < 2}
            onClick={() => {
              setMode('step');
              setPath([start]);
            }}
          >
            {labels.reset}
          </button>
        </div>
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>
        <noscript>
          <style>{`[data-slot="dialogue-stepper"] [data-slot="dialogue-step"]{display:flex!important}[data-slot="dialogue-stepper"] [data-slot="dialogue-choices"],[data-slot="dialogue-stepper"] [data-slot="dialogue-stepper-controls"]{display:none!important}`}</style>
        </noscript>
      </div>
    </StepperContext.Provider>
  );
}

type DialogueStepProps = Omit<React.ComponentProps<'div'>, 'id'> & {
  /** Unique within the stepper; choices point at it with `next`. */
  id: string;
  /**
   * The step's `DialogueChoices`. Use this, not a child, when a server
   * component renders the step. Wins over a `DialogueChoices` child.
   */
  choices?: React.ReactNode;
  /** An accessible name for the step, read when it is announced as a group. */
  'aria-label'?: string;
};

function isChoices(node: React.ReactNode): boolean {
  return React.isValidElement(node) && node.type === DialogueChoices;
}

function DialogueStep({ id, choices, className, children, ...props }: DialogueStepProps) {
  const { mode, path, speakers } = useStepper('DialogueStep');
  const at = path.indexOf(id);
  const state: StepState =
    mode === 'all' ? 'past' : at === -1 ? 'pending' : at === path.length - 1 ? 'current' : 'past';
  const items = React.Children.toArray(children);
  const turns = items.filter((c) => !isChoices(c));
  const childChoices = items.filter(isChoices);
  const step = React.useMemo<StepCtx>(() => ({ id, state }), [id, state]);
  return (
    <StepContext.Provider value={step}>
      <div
        role="group"
        data-slot="dialogue-step"
        data-step={id}
        data-state={state}
        className={cn(
          'flex flex-col gap-3',
          // A class, not the hidden attribute: the no-JS style must win.
          state === 'pending' && 'hidden',
          // A step the reader just revealed fades and rises in; never the first.
          state === 'current' &&
            at > 0 &&
            'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-(--duration-base) motion-safe:ease-enter',
          className,
        )}
        {...props}
      >
        <Dialogue speakers={speakers}>{turns}</Dialogue>
        {/* The prop wins, so passing both never doubles the buttons. */}
        {choices ?? childChoices}
      </div>
    </StepContext.Provider>
  );
}

type DialogueChoicesProps = React.ComponentProps<'div'>;

function DialogueChoices({ className, ...props }: DialogueChoicesProps) {
  const step = React.useContext(StepContext);
  // Only the last step's choices are live; a past step drops them.
  if (step?.state === 'past') return null;
  return (
    <DialogueSuggestions data-slot="dialogue-choices" className={cn('justify-end', className)} {...props} />
  );
}

type DialogueChoiceProps = Omit<React.ComponentProps<'button'>, 'type'> & {
  /** The id of the step this choice reveals. */
  next: string;
};

const CHOICE =
  'border-primary text-primary hover:bg-primary/10 focus-visible:ring-ring/50 inline-flex min-h-control items-center rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-[background-color,box-shadow,scale] duration-(--duration-fast) ease-enter outline-none focus-visible:ring-[3px] motion-safe:active:scale-[0.97]';

function DialogueChoice({ next, className, onClick, ...props }: DialogueChoiceProps) {
  const { choose } = useStepper('DialogueChoice');
  const from = React.useContext(StepContext)?.id;
  return (
    <button
      type="button"
      data-slot="dialogue-choice"
      data-next={next}
      data-from={from ?? undefined}
      className={cn(CHOICE, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) choose(next);
      }}
      {...props}
    />
  );
}

const DialogueStepperWithParts = Object.assign(DialogueStepper, {
  Step: DialogueStep,
  Choices: DialogueChoices,
  Choice: DialogueChoice,
});

export { DialogueStepperWithParts as DialogueStepper, DialogueStep, DialogueChoices, DialogueChoice };
export type { DialogueStepperProps, DialogueStepProps, DialogueChoicesProps, DialogueChoiceProps };
