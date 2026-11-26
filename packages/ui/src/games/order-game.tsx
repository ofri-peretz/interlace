'use client';

/**
 * @interlace/ui — OrderGame
 *
 * Put a handful of items in order: events from earliest to latest, places
 * from smallest to largest. The player drags rows by their handle, or moves
 * them with the arrow keys or the up and down buttons, then locks in. The
 * rows then glide into the right order, each one showing its value and
 * whether the player had it in the right place. Dealing and scoring live in
 * `order-model.ts` and are exported, so a server deals and scores the same
 * round.
 *
 * ## Anatomy
 *
 *   OrderGame                        (div — data-slot="order-game", data-state=ordering|revealed)
 *     ├─ p                           (data-slot="order-game-question", id ← the list's label)
 *     ├─ span                        (data-slot="order-game-end": the first end, e.g. "Earliest")
 *     ├─ ol                          (data-slot="order-game-list")
 *     │   └─ li × n                  (data-slot="order-game-item", data-dragging, data-place=right|wrong)
 *     │       ├─ button              (data-slot="order-game-handle": drag, or arrow keys)
 *     │       ├─ span                (label, then the value after the reveal)
 *     │       └─ Button × 2          (data-slot="order-game-move": up / down)
 *     ├─ span                        (data-slot="order-game-end": the last end, e.g. "Latest")
 *     ├─ form                        (data-slot="order-game-form": Lock in)
 *     ├─ p tabIndex=-1 aria-live     (data-slot="order-game-result")
 *     ├─ span sr-only aria-live      (data-slot="order-game-announce": "Moved X to place 2 of 5")
 *     └─ div                         (data-slot="order-game-explanation": opens on reveal)
 *
 * ## Moving without dragging
 *
 * Dragging is never the only way (WCAG 2.5.7). Every row has up and down
 * buttons, and its handle moves it with the arrow keys (Home and End send it
 * to either end). Each move is announced with the item's new place.
 *
 * ## Controlled or not
 *
 * `items` come in the right order; the round starts from `dealOrder(…,
 * seed)`, so every player gets the same deal. `result` / `defaultResult`
 * restore a locked-in round as the revealed state. `onSubmit` fires once,
 * with the scored result.
 *
 * ## Motion
 *
 * A dragged row follows the pointer; the others make room by sliding
 * (150ms, `--ease-move`). On the reveal every row travels to its right
 * place (400ms). Rows are moved with transforms measured before and after
 * the change, so layout never jumps. Under reduced motion rows are simply
 * in their new places; a dragged row still follows the pointer, since that
 * is the player's own hand.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                    |
 * | ---- | ------------------------- | ----------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                         |
 * | R6   | data-slot per part        | order-game / -question / -end / -list / -item / -handle / -move / -form / -result / -announce / -explanation |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                     |
 * | R9   | Controlled + uncontrolled | `result` / `defaultResult` / `onSubmit`               |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                  |
 * | R26  | A11y                      | buttons and keys for every move; moves announced; places in words |
 */

import * as React from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical, X } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { motionDuration, motionEase } from '../lib/motion-token.js';
import { Button } from '../primitives/button.js';
import { dealOrder, moveItem, scoreOrder, type OrderResult, type OrderScoreOptions } from './order-model.js';

export const MIN_VIEWPORT = 320 as const;

interface OrderItem {
  id: string;
  label: React.ReactNode;
  /** Plain text for announcements, when `label` is not a string. */
  text?: string;
  /** Shown after the reveal: the value the order is by (a year, a size). */
  value?: React.ReactNode;
}

interface OrderGameLabels {
  /** The lock-in button. @default 'Lock in' */
  submit?: string;
  /** The handle's name. @default (item) => `Reorder ${item}` */
  handle?: (item: string) => string;
  /** How to use the handle. @default 'Drag, or use the arrow keys.' */
  handleHint?: string;
  /** @default (item) => `Move ${item} up` */
  up?: (item: string) => string;
  /** @default (item) => `Move ${item} down` */
  down?: (item: string) => string;
  /** Announced after a move. @default (item, place, total) => `${item}, place ${place} of ${total}` */
  moved?: (item: string, place: number, total: number) => string;
  /** After the reveal, on a row in the right place. @default 'Right place' */
  right?: string;
  /** After the reveal, on a row that was elsewhere. @default (place) => `You had it ${ordinal(place)}` */
  had?: (place: number) => string;
  /** The result sentence. */
  result?: (r: { inPlace: number; total: number; points: number; perfect: boolean }) => string;
}

type OrderGameProps = Omit<React.ComponentProps<'div'>, 'children' | 'onSubmit'> & {
  question: React.ReactNode;
  /** The items, in the RIGHT order. The round is dealt from them. */
  items: readonly OrderItem[];
  /** Seeds the deal, so every player starts from the same order. @default the ids joined */
  seed?: number | string;
  /** Words at the two ends of the list, e.g. `['Earliest', 'Latest']`. */
  ends?: readonly [React.ReactNode, React.ReactNode];
  /** The scored round, controlled. null for none yet. */
  result?: OrderResult | null;
  /** The scored round, uncontrolled. */
  defaultResult?: OrderResult | null;
  /** Called once, on lock-in. */
  onSubmit?: (result: OrderResult) => void;
  /** Shown after the reveal. */
  explanation?: React.ReactNode;
  score?: OrderScoreOptions;
  labels?: OrderGameLabels;
};

const RESULT: NonNullable<OrderGameLabels['result']> = ({ inPlace, total, points, perfect }) =>
  perfect ? `All ${total} in the right place. ${points} points.` : `${inPlace} of ${total} in the right place. ${points} points.`;

const textOf = (i: OrderItem) =>
  i.text ?? (typeof i.label === 'string' || typeof i.label === 'number' ? String(i.label) : i.id);

/** Measure each row's top, keyed by id, to animate from after the order changes. */
function useFlip(listRef: React.RefObject<HTMLOListElement | null>, order: readonly string[], reduced: boolean) {
  const before = React.useRef<Map<string, number> | null>(null);
  const duration = React.useRef(150);
  const skip = React.useRef<string | null>(null);

  const capture = React.useCallback(
    (ms = 150, skipId: string | null = null) => {
      const list = listRef.current;
      if (!list) return;
      duration.current = ms;
      skip.current = skipId;
      before.current = new Map(
        Array.from(list.querySelectorAll<HTMLElement>('[data-slot="order-game-item"]')).map((el) => [
          el.dataset.id as string,
          el.getBoundingClientRect().top,
        ]),
      );
    },
    [listRef],
  );

  React.useLayoutEffect(() => {
    const prev = before.current;
    before.current = null;
    const list = listRef.current;
    if (!prev || !list || reduced) return;
    list.querySelectorAll<HTMLElement>('[data-slot="order-game-item"]').forEach((el) => {
      const id = el.dataset.id as string;
      if (id === skip.current) return;
      const from = prev.get(id);
      if (from === undefined || typeof el.animate !== 'function') return;
      const dy = from - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
        duration: duration.current,
        easing: motionEase(el, 'move'),
      });
    });
  }, [order, listRef, reduced]);

  return capture;
}

const ORDINAL = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

function OrderGame({
  question,
  items,
  seed,
  ends,
  result: resultProp,
  defaultResult = null,
  onSubmit,
  explanation,
  score,
  labels,
  className,
  ...props
}: OrderGameProps) {
  const correct = React.useMemo(() => items.map((i) => i.id), [items]);
  const byId = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [draft, setDraft] = React.useState<string[]>(() => dealOrder(correct, seed ?? correct.join('|')));
  const [uncontrolled, setUncontrolled] = React.useState<OrderResult | null>(defaultResult);
  const result = resultProp === undefined ? uncontrolled : resultProp;
  const revealed = result !== null && result !== undefined;
  const order = revealed ? result.correct : draft;
  const reduced = useReducedMotion();
  const listRef = React.useRef<HTMLOListElement>(null);
  const resultRef = React.useRef<HTMLParagraphElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [announce, setAnnounce] = React.useState('');
  const [dragging, setDragging] = React.useState<string | null>(null);
  const drag = React.useRef<{ id: string; startY: number; startTop: number; pointer: number; top: number } | null>(null);
  const sent = React.useRef(revealed);
  const moveFocus = React.useRef(false);
  const focusAfter = React.useRef<{ id: string; slot: string } | null>(null);
  const questionId = React.useId();
  const hintId = React.useId();
  const explanationId = React.useId();
  const capture = useFlip(listRef, order, reduced);
  const rowOf = (id: string) =>
    Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-slot="order-game-item"]') ?? []).find(
      (el) => el.dataset.id === id,
    );

  React.useEffect(() => {
    if (!revealed) sent.current = false;
  }, [revealed]);

  const words = {
    handle: labels?.handle ?? ((t: string) => `Reorder ${t}`),
    up: labels?.up ?? ((t: string) => `Move ${t} up`),
    down: labels?.down ?? ((t: string) => `Move ${t} down`),
    moved: labels?.moved ?? ((t: string, p: number, n: number) => `${t}, place ${p} of ${n}`),
    had: labels?.had ?? ((p: number) => `You had it ${ORDINAL(p)}`),
  };

  const move = (id: string, to: number, slot?: string) => {
    if (revealed) return;
    const from = draft.indexOf(id);
    const target = Math.min(draft.length - 1, Math.max(0, to));
    if (from < 0 || from === target) return;
    capture(150);
    setDraft(moveItem(draft, from, target));
    if (slot) focusAfter.current = { id, slot };
    const item = byId.get(id);
    if (item) setAnnounce(words.moved(textOf(item), target + 1, draft.length));
  };

  // Keep focus on the control that moved a row: React re-orders the nodes, and a
  // button that reaches an end is disabled, so focus is put back where it belongs.
  React.useEffect(() => {
    const f = focusAfter.current;
    focusAfter.current = null;
    if (!f) return;
    const row = rowOf(f.id);
    let el = row?.querySelector<HTMLButtonElement>(`[data-control="${f.slot}"]`);
    if (el?.disabled) el = row?.querySelector<HTMLButtonElement>('[data-control="handle"]');
    if (el && document.activeElement !== el) el.focus();
  }, [draft]);

  React.useEffect(() => {
    if (!revealed || !moveFocus.current) return;
    moveFocus.current = false;
    resultRef.current?.focus();
  }, [revealed]);

  const submit = () => {
    if (revealed || sent.current) return;
    sent.current = true;
    moveFocus.current = !!formRef.current?.contains(document.activeElement);
    const scored = scoreOrder(draft, correct, score);
    capture(400);
    if (resultProp === undefined) setUncontrolled(scored);
    onSubmit?.(scored);
  };

  // ── Dragging: the row follows the pointer; others make room as it crosses their middles.
  const onPointerDown = (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (revealed || e.button > 0) return;
    const row = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-slot="order-game-item"]');
    if (!row) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id, startY: e.clientY, startTop: row.offsetTop, pointer: e.pointerId, top: row.offsetTop };
    setDragging(id);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    const list = listRef.current;
    if (!d || !list || e.pointerId !== d.pointer) return;
    const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-slot="order-game-item"]'));
    const row = rows.find((r) => r.dataset.id === d.id);
    if (!row) return;
    const top = d.startTop + (e.clientY - d.startY);
    const centre = top + row.offsetHeight / 2;
    // The slot whose middle the dragged row's centre has passed.
    let target = 0;
    for (const other of rows) {
      if (other === row) continue;
      if (centre > other.offsetTop + other.offsetHeight / 2) target += 1;
    }
    d.top = top;
    const from = draft.indexOf(d.id);
    if (target !== from) {
      // The row's new slot is laid out first; the layout effect below then places it under the pointer.
      capture(150, d.id);
      setDraft(moveItem(draft, from, target));
    } else {
      row.style.transform = `translateY(${top - row.offsetTop}px)`;
    }
  };

  // Keep a dragged row under the pointer after the list re-orders (offsetTop ignores transforms).
  React.useLayoutEffect(() => {
    const d = drag.current;
    if (!d) return;
    const row = rowOf(d.id);
    if (row) row.style.transform = `translateY(${d.top - row.offsetTop}px)`;
  }, [draft]);

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    drag.current = null;
    setDragging(null);
    const row = rowOf(d.id);
    if (!row) return;
    const current = row.style.transform;
    row.style.transform = '';
    if (!reduced && current && typeof row.animate === 'function') {
      row.animate([{ transform: current }, { transform: 'none' }], { duration: motionDuration(row, 'base'), easing: motionEase(row, 'enter') });
    }
    const item = byId.get(d.id);
    if (item) setAnnounce(words.moved(textOf(item), draft.indexOf(d.id) + 1, draft.length));
  };

  const onHandleKey = (id: string) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const at = draft.indexOf(id);
    const to =
      e.key === 'ArrowUp' ? at - 1 : e.key === 'ArrowDown' ? at + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? draft.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    move(id, to, 'handle');
  };

  const placeHad = (id: string) => (revealed ? result.order.indexOf(id) + 1 : 0);

  return (
    <div
      data-slot="order-game"
      data-state={revealed ? 'revealed' : 'ordering'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-3', className)}
      {...props}
    >
      <p id={questionId} data-slot="order-game-question" className="font-heading text-lg font-semibold text-balance">
        {question}
      </p>
      <span id={hintId} className="sr-only">
        {labels?.handleHint ?? 'Drag, or use the arrow keys.'}
      </span>

      {ends ? (
        <span data-slot="order-game-end" className="text-muted-foreground text-xs font-semibold">
          {ends[0]}
        </span>
      ) : null}

      <ol ref={listRef} aria-labelledby={questionId} data-slot="order-game-list" className="grid gap-2">
        {order.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          const t = textOf(item);
          const had = placeHad(id);
          const right = revealed && had === index + 1;
          return (
            <li
              key={id}
              data-id={id}
              data-slot="order-game-item"
              data-dragging={dragging === id ? '' : undefined}
              data-place={revealed ? (right ? 'right' : 'wrong') : undefined}
              className={cn(
                'bg-card text-card-foreground relative flex min-h-12 items-center gap-2 rounded-lg border py-1.5 ps-1.5 pe-1.5',
                dragging === id && 'border-primary z-10 shadow-lg',
                revealed && (right ? 'border-success' : 'border-border'),
              )}
            >
              {!revealed ? (
                <button
                  type="button"
                  data-slot="order-game-handle"
                  data-control="handle"
                  aria-label={words.handle(t)}
                  aria-describedby={hintId}
                  onPointerDown={onPointerDown(id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onKeyDown={onHandleKey(id)}
                  className={cn(
                    'text-muted-foreground hover:text-foreground grid size-11 shrink-0 touch-none place-items-center rounded-md',
                    'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
                    dragging === id ? 'cursor-grabbing' : 'cursor-grab',
                  )}
                >
                  <GripVertical aria-hidden className="size-5" />
                </button>
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    'grid size-11 shrink-0 place-items-center',
                    right ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  {right ? <Check className="size-5" strokeWidth={3} /> : <X className="size-5" strokeWidth={2.5} />}
                </span>
              )}

              <span className="min-w-0 flex-1 py-1">
                <span className="block font-medium">{item.label}</span>
                {revealed ? (
                  <span className="text-muted-foreground flex flex-wrap gap-x-3 text-sm">
                    {item.value !== undefined ? <span className="text-foreground font-semibold tabular-nums">{item.value}</span> : null}
                    <span className={cn(right && 'text-success font-semibold')}>
                      {right ? (labels?.right ?? 'Right place') : words.had(had)}
                    </span>
                  </span>
                ) : null}
              </span>

              {!revealed ? (
                <span className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    data-slot="order-game-move"
                    data-control="up"
                    aria-label={words.up(t)}
                    disabled={index === 0}
                    onClick={() => move(id, index - 1, 'up')}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    data-slot="order-game-move"
                    data-control="down"
                    aria-label={words.down(t)}
                    disabled={index === order.length - 1}
                    onClick={() => move(id, index + 1, 'down')}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {ends ? (
        <span data-slot="order-game-end" className="text-muted-foreground text-xs font-semibold">
          {ends[1]}
        </span>
      ) : null}

      {!revealed ? (
        <form
          ref={formRef}
          data-slot="order-game-form"
          className="flex justify-end pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Button type="submit">{labels?.submit ?? 'Lock in'}</Button>
        </form>
      ) : null}

      <p
        ref={resultRef}
        tabIndex={-1}
        data-slot="order-game-result"
        aria-live="polite"
        aria-describedby={revealed && explanation ? explanationId : undefined}
        className="focus-visible:outline-ring rounded-sm text-sm font-semibold outline-offset-4 empty:hidden focus-visible:outline-2"
      >
        {revealed
          ? (labels?.result ?? RESULT)({
              inPlace: result.inPlace,
              total: result.order.length,
              points: result.points,
              perfect: result.perfect,
            })
          : ''}
      </p>

      <span data-slot="order-game-announce" aria-live="assertive" className="sr-only">
        {announce}
      </span>

      {explanation ? (
        <div
          data-slot="order-game-explanation"
          className={cn(
            'grid',
            'motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-enter',
            revealed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
          inert={revealed ? undefined : true}
        >
          <div id={explanationId} className="text-muted-foreground -m-1 min-h-0 overflow-hidden p-1 text-sm leading-relaxed">
            {explanation}
          </div>
        </div>
      ) : null}
    </div>
  );
}
OrderGame.displayName = 'OrderGame';

export { OrderGame };
export type { OrderGameProps, OrderItem, OrderGameLabels };
