'use client';

/**
 * @interlace/ui — NoteBoard
 *
 * A shared board of sticky notes in columns: a retrospective ("Keep /
 * Change / Try"), an affinity sort, a "before / during / after" map.
 * People post a note into a column, and the room sorts them by moving
 * notes between columns. Every screen folds the same posts and moves with
 * `foldBoard`, so the board agrees everywhere.
 *
 * Moving is a pair of buttons on each note, named for the column they move
 * it to (arrows that point across when the columns sit side by side, and up
 * and down when they stack), so a note moves the same way by touch, mouse, keyboard or screen
 * reader, and focus stays on the note that moved.
 *
 * ## Anatomy
 *
 *   NoteBoard                      (div — data-slot="note-board", @container)
 *     └─ FlipGroup                 (data-slot="note-board-columns": the columns side by side, or stacked)
 *         └─ section × n           (data-slot="note-board-column", named by its title)
 *             ├─ header            (title, count)
 *             ├─ ul                (data-slot="note-board-notes")
 *             │   └─ li × n        (data-slot="note-board-note", data-flip-id: text, move buttons)
 *             └─ form              (data-slot="note-board-add": when `onAdd`; field, Add, why not)
 *     └─ span sr-only aria-live    (data-slot="note-board-announce": "Moved to Try.")
 *
 * ## Motion
 *
 * A note that moves glides from its old column to its new place, and the
 * notes around it close up (FlipGroup, 250ms, `ease-move`). A new note
 * fades in. Under reduced motion every note simply takes its place.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `div` props                                          |
 * | R6   | data-slot per part        | note-board / -columns / -column / -notes / -note / -add / -announce |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R8   | Enums, not booleans       | `size`                                               |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | named columns; move buttons name their column; focus follows the note; moves announced |
 */

import * as React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';

import { FlipGroup } from '../effects/flip-group.js';
import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { Input } from '../primitives/input.js';
import { foldBoard, type BoardMove, type BoardNote } from './note-board-model.js';
import { checkText, type TextRefusal } from './text-safety-model.js';

export const MIN_VIEWPORT = 320 as const;

interface NoteBoardColumn {
  id: string;
  title: string;
}

interface NoteBoardLabels {
  /** @default (column) => `Move to ${column}` */
  move?: (column: string) => string;
  /** @default (column) => `Moved to ${column}.` */
  moved?: (column: string) => string;
  /** The add field's name. @default (column) => `Add a note to ${column}` */
  field?: (column: string) => string;
  /** @default 'Add' */
  add?: string;
  /** In the empty add field. @default 'Add a note' */
  placeholder?: string;
  /** A column with no notes yet. @default 'No notes yet.' */
  empty?: string;
  /** @default (n) => `${n} notes` */
  count?: (n: number, formatted: string) => string;
  /** Why a note was not added. */
  refused?: Partial<Record<TextRefusal, string>>;
}

type NoteBoardProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  columns: readonly NoteBoardColumn[];
  notes: readonly BoardNote[];
  moves?: readonly BoardMove[];
  /** Let the viewer move notes. Moves show at once and are sent here. */
  onMove?: (move: BoardMove) => void;
  /** Let the viewer post a note into a column, after the room's text checks. */
  onAdd?: (column: string, text: string) => void;
  /** Words the room refuses in a new note. */
  blocklist?: readonly string[];
  /** @default 140 */
  maxLength?: number;
  /** `stage` for a shared screen. @default 'default' */
  size?: 'default' | 'stage';
  locale?: string;
  labels?: NoteBoardLabels;
};

const REFUSED: Record<TextRefusal, string> = {
  empty: 'Type a note first.',
  'too-long': 'That is too long for a note. Try a shorter one.',
  'too-many-words': 'That is too long for a note. Try a shorter one.',
  link: 'Links cannot go on the board.',
  contact: 'Email addresses and phone numbers cannot go on the board.',
  blocked: 'That note cannot go on the board. Try other words.',
};

function AddNote({
  column,
  title,
  onAdd,
  blocklist,
  maxLength,
  labels,
}: {
  column: string;
  title: string;
  onAdd: (column: string, text: string) => void;
  blocklist?: readonly string[];
  maxLength: number;
  labels?: NoteBoardLabels;
}) {
  const [value, setValue] = React.useState('');
  const [refused, setRefused] = React.useState<TextRefusal | null>(null);
  const messageId = React.useId();
  return (
    <form
      data-slot="note-board-add"
      noValidate
      className="grid gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const check = checkText(value, { maxLength, blocklist });
        if (!check.ok) {
          setRefused(check.reason);
          return;
        }
        setRefused(null);
        setValue('');
        onAdd(column, check.text);
      }}
    >
      <div className="flex gap-2">
        <Input
          value={value}
          aria-label={(labels?.field ?? ((c: string) => `Add a note to ${c}`))(title)}
          placeholder={labels?.placeholder ?? 'Add a note'}
          aria-invalid={refused ? true : undefined}
          aria-describedby={messageId}
          onChange={(e) => {
            setValue(e.target.value);
            if (refused) setRefused(null);
          }}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="outline">
          {labels?.add ?? 'Add'}
        </Button>
      </div>
      <p id={messageId} aria-live="polite" className="text-destructive text-xs empty:hidden">
        {refused ? (labels?.refused?.[refused] ?? REFUSED[refused]) : ''}
      </p>
    </form>
  );
}

function NoteBoard({
  columns,
  notes,
  moves = [],
  onMove,
  onAdd,
  blocklist,
  maxLength = 140,
  size = 'default',
  locale,
  labels,
  className,
  style,
  ...props
}: NoteBoardProps) {
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [own, setOwn] = React.useState<BoardMove[]>([]);
  const [announce, setAnnounce] = React.useState('');
  const focusNext = React.useRef<{ id: string; dir: -1 | 1 } | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const ids = columns.map((c) => c.id);
  const board = foldBoard(ids, notes, [...moves, ...own]);
  const titleOf = (id: string) => columns.find((c) => c.id === id)?.title ?? id;
  const stage = size === 'stage';

  // Keep focus on the note that moved: the same arrow if it can go further, else the other one.
  React.useLayoutEffect(() => {
    const next = focusNext.current;
    focusNext.current = null;
    if (!next) return;
    const note = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-slot="note-board-note"]') ?? []).find(
      (el) => el.dataset.flipId === next.id,
    );
    const same = note?.querySelector<HTMLButtonElement>(`[data-move="${next.dir}"]`);
    const other = note?.querySelector<HTMLButtonElement>(`[data-move="${-next.dir}"]`);
    (same ?? other ?? note)?.focus();
  });

  const move = (note: BoardNote, to: number, dir: -1 | 1) => {
    const column = ids[to] as string;
    const m: BoardMove = { id: note.id, column, at: Math.max(Date.now(), note.at) };
    setOwn((list) => [...list.filter((x) => x.id !== note.id), m]);
    focusNext.current = { id: note.id, dir };
    setAnnounce((labels?.moved ?? ((c: string) => `Moved to ${c}.`))(titleOf(column)));
    onMove?.(m);
  };

  return (
    <div
      ref={rootRef}
      data-slot="note-board"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container', className)}
      style={{ '--note-board-cols': String(Math.max(1, columns.length)), ...style } as React.CSSProperties}
      {...props}
    >
      <FlipGroup
        duration={250}
        data-slot="note-board-columns"
        className="grid gap-4 @3xl:grid-cols-[repeat(var(--note-board-cols),minmax(0,1fr))]"
      >
        {board.map((col, ci) => {
          const title = titleOf(col.id);
          const headingId = `note-board-${col.id}`;
          return (
            <section
              key={col.id}
              data-slot="note-board-column"
              aria-labelledby={headingId}
              className="bg-muted/50 grid content-start gap-3 rounded-xl border p-3"
            >
              <header className="flex items-baseline justify-between gap-2 px-1">
                <h3 id={headingId} className={cn('font-heading font-semibold', stage ? 'text-xl' : 'text-base')}>
                  {title}
                </h3>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {(labels?.count ?? ((n: number, f: string) => `${f} ${n === 1 ? 'note' : 'notes'}`))(
                    col.notes.length,
                    nf.format(col.notes.length),
                  )}
                </span>
              </header>
              {col.notes.length === 0 ? (
                <p className="text-muted-foreground px-1 text-sm">{labels?.empty ?? 'No notes yet.'}</p>
              ) : (
                <ul data-slot="note-board-notes" className="grid gap-2">
                  {col.notes.map((note) => (
                    <li
                      key={note.id}
                      data-slot="note-board-note"
                      data-flip-id={note.id}
                      tabIndex={-1}
                      className={cn(
                        'bg-card focus-visible:outline-ring flex items-start gap-2 rounded-lg border p-3 shadow-xs outline-offset-2 focus-visible:outline-2',
                        stage ? 'text-lg' : 'text-sm',
                      )}
                    >
                      <span className="min-w-0 flex-1 text-pretty">{note.text}</span>
                      {onMove ? (
                        <span className="-my-1 -me-1 flex shrink-0">
                          {ci > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              data-move="-1"
                              aria-label={(labels?.move ?? ((c: string) => `Move to ${c}`))(
                                titleOf(ids[ci - 1] as string),
                              )}
                              title={titleOf(ids[ci - 1] as string)}
                              onClick={() => move(note, ci - 1, -1)}
                            >
                              <ArrowUp aria-hidden className="@3xl:hidden" />
                              <ArrowLeft aria-hidden className="hidden rtl:rotate-180 @3xl:block" />
                            </Button>
                          ) : null}
                          {ci < board.length - 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              data-move="1"
                              aria-label={(labels?.move ?? ((c: string) => `Move to ${c}`))(
                                titleOf(ids[ci + 1] as string),
                              )}
                              title={titleOf(ids[ci + 1] as string)}
                              onClick={() => move(note, ci + 1, 1)}
                            >
                              <ArrowDown aria-hidden className="@3xl:hidden" />
                              <ArrowRight aria-hidden className="hidden rtl:rotate-180 @3xl:block" />
                            </Button>
                          ) : null}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {onAdd ? (
                <AddNote
                  column={col.id}
                  title={title}
                  onAdd={onAdd}
                  blocklist={blocklist}
                  maxLength={maxLength}
                  labels={labels}
                />
              ) : null}
            </section>
          );
        })}
      </FlipGroup>
      <span data-slot="note-board-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
NoteBoard.displayName = 'NoteBoard';

export { NoteBoard };
export type { NoteBoardProps, NoteBoardLabels, NoteBoardColumn };
