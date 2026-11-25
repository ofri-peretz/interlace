'use client';

/**
 * @interlace/ui — MultiStepForm
 *
 * One form, a few steps, a last look before it is sent: a booking flow
 * (when, who, check), a sign-up, a request. Every step is a real part of
 * one `<form>`, kept in the page and hidden while it is not the current
 * one, so what the reader typed survives going back, and the submit posts
 * every field at once as `FormData`.
 * Inspiration: Stripe Checkout's quiet steps, Cal.com's "confirm" screen.
 *
 * ## Anatomy
 *
 *   MultiStepForm                    (form — data-slot="multi-step-form", @container, data-min-viewport=320)
 *     ├─ progress                    (ol — data-slot="multi-step-form-progress")
 *     │   └─ li × n                  (data-state=complete|current|upcoming, aria-current="step")
 *     │       └─ button | span       (a done step is a button back to it)
 *     ├─ MultiStepFormStep × n       (section — data-slot="multi-step-form-step", hidden unless current)
 *     │   ├─ h2 tabIndex=-1          (data-slot="multi-step-form-title": takes focus on arrival)
 *     │   ├─ description             (data-slot="multi-step-form-description")
 *     │   ├─ children                (the step's fields)
 *     │   └─ error                   (data-slot="multi-step-form-error", role=alert)
 *     └─ footer                      (data-slot="multi-step-form-footer": Back, Continue / Submit)
 *
 *   MultiStepFormSummary             (dl — data-slot="multi-step-form-summary": the answers, each with Change)
 *
 * ## Moving between steps
 *
 * Continue checks the current step first: every native constraint on its
 * fields (`required`, `type="email"`, `pattern` …), then the step's own
 * `validate`. The first problem takes focus, and a message from `validate`
 * shows under the step and is read out. Back never checks. A step already
 * done is a link in the progress list, so the reader can jump back to it;
 * steps ahead cannot be skipped to. `MultiStepFormSummary` lists answers
 * with a Change button that goes straight to the step that asked.
 *
 * On every step change focus moves to the new step's heading, so a screen
 * reader hears "Step 2 of 3, Your details" and a keyboard reader starts at
 * the top of the step.
 *
 * ## Motion
 *
 * The new step slides in from the side it lies on (forward from the end,
 * back from the start; mirrored in RTL), 200ms on transform and opacity,
 * and the progress line fills on `--duration-medium`. Under reduced motion
 * the step is simply there.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The progress list queries the form's width: in a phone column it is one
 * line, "Step 2 of 3 · Your details" over a segmented bar; from 32rem every
 * step is named.
 *
 * | Rule | Concept                   | Where in this file                                         |
 * | ---- | ------------------------- | ---------------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'form'>`                             |
 * | R6   | data-slot per part        | multi-step-form / -progress / -step / -title / -footer / -summary |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                          |
 * | R9   | Controlled + uncontrolled | `step` / `defaultStep` / `onStepChange`                    |
 * | R11  | Composition               | steps are `MultiStepFormStep` children                     |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                       |
 * | R19  | Tokens only               | `bg-primary`, `border-border`, `--duration-medium`         |
 * | R26  | A11y                      | a real form; aria-current="step"; focus to the heading; errors announced |
 */

import * as React from 'react';
import { CheckIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';

export const MIN_VIEWPORT = 320 as const;

export interface MultiStepFormLabels {
  /** @default 'Back' */
  back?: string;
  /** @default 'Continue' */
  next?: string;
  /** The last step's button. @default 'Submit' */
  submit?: string;
  /** While `submitting`. @default 'Sending…' */
  submitting?: string;
  /** @default (current, total) => `Step ${current} of ${total}` */
  stepOf?: (current: number, total: number) => string;
  /** Names the progress list. @default 'Progress' */
  progress?: string;
  /** Said after a finished step in the progress list. @default 'Done' */
  complete?: string;
  /** The summary's link back to a step. @default 'Change' */
  edit?: string;
}

const DEFAULT_LABELS: Required<MultiStepFormLabels> = {
  back: 'Back',
  next: 'Continue',
  submit: 'Submit',
  submitting: 'Sending…',
  stepOf: (current, total) => `Step ${current} of ${total}`,
  progress: 'Progress',
  complete: 'Done',
  edit: 'Change',
};

interface StepInfo {
  id: string;
  title: React.ReactNode;
  /** Plain text for the progress list and the heading's step count. */
  text: string;
}

interface MultiStepFormContextValue {
  steps: StepInfo[];
  current: string;
  index: number;
  goTo: (id: string) => void;
  labels: Required<MultiStepFormLabels>;
  errors: Record<string, string | undefined>;
  headingRef: (id: string) => (el: HTMLHeadingElement | null) => void;
}

const MultiStepFormContext = React.createContext<MultiStepFormContextValue | null>(null);

/** The form's state, for a step that needs to move on by itself or show where it is. */
function useMultiStepForm(): Pick<MultiStepFormContextValue, 'steps' | 'current' | 'index' | 'goTo'> {
  const ctx = React.useContext(MultiStepFormContext);
  if (!ctx) throw new Error('useMultiStepForm must be used inside a MultiStepForm');
  const { steps, current, index, goTo } = ctx;
  return { steps, current, index, goTo };
}

type MultiStepFormStepProps = Omit<React.ComponentProps<'section'>, 'title'> & {
  /** Stable id: the value of `step`, and what the summary links back to. */
  id: string;
  title: React.ReactNode;
  /** Plain text for the progress list, when `title` is not a string. */
  text?: string;
  description?: React.ReactNode;
  /**
   * Runs on Continue after the native checks pass. Return a message to stay
   * on the step and show it, or nothing to move on.
   */
  validate?: () => string | undefined | null | false;
};

function MultiStepFormStep({
  id,
  title,
  text: _text,
  description,
  validate: _validate,
  className,
  children,
  ...props
}: MultiStepFormStepProps) {
  const ctx = React.useContext(MultiStepFormContext);
  if (!ctx) throw new Error('MultiStepFormStep must be used inside a MultiStepForm');
  const index = ctx.steps.findIndex((s) => s.id === id);
  const active = ctx.current === id;
  const titleId = `${id}-title`;
  const error = ctx.errors[id];
  return (
    <section
      data-slot="multi-step-form-step"
      data-step={id}
      data-state={active ? 'current' : index < ctx.index ? 'complete' : 'upcoming'}
      aria-labelledby={titleId}
      hidden={!active}
      className={cn('flex flex-col gap-4', className)}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <h2
          ref={ctx.headingRef(id)}
          id={titleId}
          tabIndex={-1}
          data-slot="multi-step-form-title"
          className="text-h3 font-heading font-semibold text-balance outline-none"
        >
          <span className="sr-only">{ctx.labels.stepOf(index + 1, ctx.steps.length)}, </span>
          {title}
        </h2>
        {description && (
          <p data-slot="multi-step-form-description" className="text-muted-foreground text-sm">
            {description}
          </p>
        )}
      </div>
      {children}
      <p
        role="alert"
        data-slot="multi-step-form-error"
        className={cn('text-destructive text-sm font-medium', !error && 'sr-only')}
      >
        {error}
      </p>
    </section>
  );
}

function stepsOf(children: React.ReactNode): (StepInfo & { validate?: MultiStepFormStepProps['validate'] })[] {
  const out: (StepInfo & { validate?: MultiStepFormStepProps['validate'] })[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<MultiStepFormStepProps>(child) || child.type !== MultiStepFormStep) return;
    const { id, title, text, validate } = child.props;
    out.push({ id, title, text: text ?? (typeof title === 'string' ? title : id), validate });
  });
  return out;
}

/** What can take focus when a step has a problem. */
const FIELDS = 'input:not([type="hidden"]), select, textarea, [role="radio"]';

type MultiStepFormProps = Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  /** The current step's id, controlled. */
  step?: string;
  /** The step to open on. @default the first */
  defaultStep?: string;
  /** Fires with the id of the step the reader moved to. */
  onStepChange?: (id: string) => void;
  /**
   * The last step's submit, with every field of every step. Submit checks only the last
   * step: earlier ones were checked by Continue. If you jump to the last step with a
   * controlled `step`, validate the earlier answers yourself.
   */
  onSubmit?: (data: FormData, event: React.FormEvent<HTMLFormElement>) => void;
  /** Disable the buttons and say `labels.submitting` while you send. */
  submitting?: boolean;
  labels?: MultiStepFormLabels;
  children: React.ReactNode;
};

const MultiStepForm = React.forwardRef<HTMLFormElement, MultiStepFormProps>(function MultiStepForm(
  {
    step: stepProp,
    defaultStep,
    onStepChange,
    onSubmit,
    submitting = false,
    labels: labelsProp,
    className,
    children,
    ...props
  },
  ref,
) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const steps = stepsOf(children);
  const [inner, setInner] = React.useState(defaultStep ?? steps[0]?.id ?? '');
  const wanted = stepProp ?? inner;
  // An unknown id falls back to the first step, so a step always shows.
  const current = steps.some((s) => s.id === wanted) ? wanted : (steps[0]?.id ?? '');
  const index = Math.max(
    0,
    steps.findIndex((s) => s.id === current),
  );
  const last = index === steps.length - 1;
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({});

  const formRef = React.useRef<HTMLFormElement | null>(null);
  const headings = React.useRef(new Map<string, HTMLHeadingElement>());
  const direction = React.useRef<0 | 1 | -1>(0);
  const reduced = useReducedMotion();

  const setRefs = (el: HTMLFormElement | null) => {
    formRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  const headingRef = React.useCallback(
    (id: string) => (el: HTMLHeadingElement | null) => {
      if (el) headings.current.set(id, el);
      else headings.current.delete(id);
    },
    [],
  );

  const goTo = React.useCallback(
    (id: string) => {
      if (id === current || !steps.some((s) => s.id === id)) return;
      const to = steps.findIndex((s) => s.id === id);
      direction.current = to > index ? 1 : -1;
      if (stepProp === undefined) setInner(id);
      onStepChange?.(id);
    },
    // `steps` is rebuilt from children on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, index, stepProp, onStepChange, children],
  );

  React.useLayoutEffect(() => {
    const dir = direction.current;
    if (!dir) return;
    direction.current = 0;
    const heading = headings.current.get(current);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ block: 'nearest' });
    const section = heading?.closest('section');
    if (reduced || !section || typeof section.animate !== 'function') return;
    const rtl = section.closest('[dir]')?.getAttribute('dir') === 'rtl';
    section.animate(
      [
        { transform: `translateX(${(rtl ? -dir : dir) * 1}rem)`, opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
  }, [current, reduced]);

  /** Native checks, then the step's own. Returns true when the step may be left. */
  const check = (): boolean => {
    const step = steps[index];
    const section = [
      ...formRef.current!.querySelectorAll<HTMLElement>('[data-slot="multi-step-form-step"]'),
    ].find((el) => el.dataset.step === current);
    if (section) {
      const controls = [...section.querySelectorAll<HTMLInputElement>('input, select, textarea')];
      const invalid = controls.filter((c) => !c.disabled && !c.checkValidity());
      if (invalid.length > 0) {
        const first = invalid[0]!;
        // A hidden input (a radio group's value) cannot take focus: its group can.
        const target =
          first.type === 'hidden' || first.getAttribute('aria-hidden') === 'true'
            ? (first.parentElement?.querySelector<HTMLElement>('[role="radio"]') ?? first)
            : first;
        target.focus();
        return false;
      }
    }
    const message = step?.validate?.() || undefined;
    setErrors((prev) => ({ ...prev, [current]: message }));
    if (message) {
      section?.querySelector<HTMLElement>(FIELDS)?.focus();
      return false;
    }
    return true;
  };

  const next = () => {
    if (!check()) return;
    const to = steps[index + 1];
    if (to) goTo(to.id);
  };

  // Back only shows from the second step on.
  const back = () => goTo(steps[index - 1]!.id);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!last) {
      next();
      return;
    }
    if (!check()) return;
    onSubmit?.(new FormData(event.currentTarget), event);
  };

  const ctx: MultiStepFormContextValue = { steps, current, index, goTo, labels, errors, headingRef };

  return (
    <MultiStepFormContext.Provider value={ctx}>
      <form
        ref={setRefs}
        data-slot="multi-step-form"
        data-min-viewport={String(MIN_VIEWPORT)}
        noValidate
        onSubmit={handleSubmit}
        className={cn('@container flex w-full min-w-0 flex-col gap-6', className)}
        {...props}
      >
        <nav aria-label={labels.progress} className="flex flex-col gap-2">
          <p
            aria-hidden="true"
            className="text-muted-foreground flex min-w-0 gap-1 text-sm @lg:hidden"
          >
            <span className="shrink-0">{labels.stepOf(index + 1, steps.length)}</span>
            <span className="shrink-0">·</span>
            <span className="text-foreground truncate font-medium">{steps[index]?.text}</span>
          </p>
          <div
            aria-hidden="true"
            data-slot="multi-step-form-bar"
            className="grid auto-cols-fr grid-flow-col gap-1 @lg:hidden"
          >
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  'h-1 rounded-full transition-colors duration-(--duration-medium) ease-move',
                  i <= index ? 'bg-primary' : 'bg-border',
                )}
              />
            ))}
          </div>
          <ol
            data-slot="multi-step-form-progress"
            className="hidden @lg:grid @lg:grid-flow-col @lg:auto-cols-fr @lg:gap-2"
          >
            {steps.map((s, i) => {
              const state = i < index ? 'complete' : i === index ? 'current' : 'upcoming';
              const marker = (
                <>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors duration-(--duration-medium) ease-move',
                      state === 'complete' && 'bg-primary border-primary text-primary-foreground',
                      state === 'current' && 'border-primary text-primary border-2',
                      state === 'upcoming' && 'border-input text-muted-foreground',
                    )}
                  >
                    {state === 'complete' ? <CheckIcon className="size-3.5" /> : i + 1}
                  </span>
                  <span className={cn('min-w-0 truncate', state === 'upcoming' && 'text-muted-foreground')}>
                    {s.text}
                  </span>
                  {state === 'complete' && <span className="sr-only">, {labels.complete}</span>}
                </>
              );
              return (
                <li
                  key={s.id}
                  data-state={state}
                  aria-current={state === 'current' ? 'step' : undefined}
                  className={cn(
                    'border-t-2 pt-2 text-sm font-medium transition-colors duration-(--duration-medium) ease-move',
                    state === 'upcoming' ? 'border-border' : 'border-primary',
                  )}
                >
                  {state === 'complete' ? (
                    <button
                      type="button"
                      onClick={() => goTo(s.id)}
                      className="hover:text-primary -m-1 flex w-[calc(100%+0.5rem)] min-w-0 items-center gap-2 rounded-md p-1 text-start outline-none transition-colors duration-(--duration-fast) ease-enter focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {marker}
                    </button>
                  ) : (
                    <span className="flex min-w-0 items-center gap-2">{marker}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <div data-slot="multi-step-form-steps" className="min-w-0">
          {children}
        </div>
        <div
          data-slot="multi-step-form-footer"
          className="border-border flex flex-wrap-reverse items-center justify-between gap-3 border-t pt-4"
        >
          {index > 0 ? (
            <Button type="button" variant="ghost" onClick={back} disabled={submitting}>
              {labels.back}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={submitting} aria-busy={submitting || undefined}>
            {last ? (submitting ? labels.submitting : labels.submit) : labels.next}
          </Button>
        </div>
      </form>
    </MultiStepFormContext.Provider>
  );
});

interface SummaryItem {
  /** What was asked, e.g. "Date". */
  label: React.ReactNode;
  /** The answer. Empty answers read `emptyText`. */
  value: React.ReactNode;
  /** The step that asked: adds a Change button back to it. */
  step?: string;
}

type MultiStepFormSummaryProps = React.ComponentProps<'dl'> & {
  items: readonly SummaryItem[];
  /** Said for an empty answer. @default 'Not given' */
  emptyText?: string;
};

/** The answers, each with a way back to the step that asked. Put it in the last step. */
function MultiStepFormSummary({
  items,
  emptyText = 'Not given',
  className,
  ...props
}: MultiStepFormSummaryProps) {
  const ctx = React.useContext(MultiStepFormContext);
  const id = React.useId();
  return (
    <dl
      data-slot="multi-step-form-summary"
      className={cn('divide-border border-border divide-y rounded-lg border', className)}
      {...props}
    >
      {items.map((item, i) => {
        const empty = item.value === null || item.value === undefined || item.value === '';
        return (
          <div key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
            <dt id={`${id}-${i}`} className="text-muted-foreground w-full text-sm @md:w-32 @md:shrink-0">
              {item.label}
            </dt>
            <dd className={cn('min-w-0 flex-1 text-sm font-medium', empty && 'text-muted-foreground font-normal')}>
              {empty ? emptyText : item.value}
            </dd>
            {item.step && ctx && (
              <dd className="ms-auto">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => ctx.goTo(item.step!)}
                  // A text label names the button "Change: Email"; any other label is read
                  // from its <dt>, so every Change button still says which answer it changes.
                  {...(typeof item.label === 'string'
                    ? { 'aria-label': `${ctx.labels.edit}: ${item.label}` }
                    : { id: `${id}-${i}-edit`, 'aria-labelledby': `${id}-${i}-edit ${id}-${i}` })}
                  className="h-auto px-0"
                >
                  {ctx.labels.edit}
                </Button>
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}

export { MultiStepForm, MultiStepFormStep, MultiStepFormSummary, useMultiStepForm };
export type { MultiStepFormProps, MultiStepFormStepProps, MultiStepFormSummaryProps, SummaryItem };
