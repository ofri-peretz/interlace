/**
 * NoteBoard: sticky notes in columns, posted and sorted by the room.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { foldBoard } = await import('../src/games/note-board-model.js');
const { NoteBoard, MIN_VIEWPORT } = await import('../src/games/note-board.js');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const COLS = ['keep', 'change', 'try'];
const COLUMNS = [
  { id: 'keep', title: 'Keep' },
  { id: 'change', title: 'Change' },
  { id: 'try', title: 'Try' },
];
const NOTES = [
  { id: 'n1', column: 'keep', text: 'Short breaks', at: 1 },
  { id: 'n2', column: 'keep', text: 'Small groups', at: 2 },
  { id: 'n3', column: 'change', text: 'Start on time', at: 3 },
];

const texts = (col: { notes: { id: string }[] }) => col.notes.map((n) => n.id);

describe('note-board-model', () => {
  it('puts each note in its column, in the order it was posted', () => {
    const b = foldBoard(COLS, [NOTES[2]!, NOTES[1]!, NOTES[0]!]);
    expect(b.map((c) => c.id)).toEqual(COLS);
    expect(b.map(texts)).toEqual([['n1', 'n2'], ['n3'], []]);
  });

  it('follows each note’s latest move, whatever order moves arrive in', () => {
    const moves = [
      { id: 'n1', column: 'try', at: 10 },
      { id: 'n1', column: 'change', at: 5 },
      { id: 'n2', column: 'change', at: 7 },
      { id: 'n2', column: 'change', at: 7 },
    ];
    const one = foldBoard(COLS, NOTES, moves);
    const two = foldBoard(COLS, NOTES, [...moves].reverse());
    expect(one).toEqual(two);
    expect(one.map(texts)).toEqual([[], ['n2', 'n3'], ['n1']]);
    expect(one[2]!.notes[0]!.column).toBe('try');
  });

  it('breaks a tie between moves by the column listed later', () => {
    const b = foldBoard(COLS, NOTES, [
      { id: 'n1', column: 'try', at: 9 },
      { id: 'n1', column: 'change', at: 9 },
    ]);
    expect(b.map(texts)[2]).toEqual(['n1']);
  });

  it('drops what makes no sense, keeps a note’s first posting, and ignores moves from before it', () => {
    const b = foldBoard(
      COLS,
      [
        ...NOTES,
        { id: 'n1', column: 'try', text: 'Again', at: 50 },
        { id: 'n0', column: 'try', text: 'Earlier copy', at: 0 },
        { id: 'n0', column: 'keep', text: 'Later copy', at: 4 },
        { id: 'x', column: 'nowhere', text: 'Lost', at: 1 },
        { id: 'y', column: 'keep', text: 'No time', at: Number.NaN },
        null as unknown as (typeof NOTES)[number],
      ],
      [
        { id: 'n3', column: 'nowhere', at: 20 },
        { id: 'n3', column: 'try', at: Number.NaN },
        { id: 'n2', column: 'try', at: 1 },
        null as unknown as { id: string; column: string; at: number },
      ],
    );
    expect(b.map(texts)).toEqual([['n1', 'n2'], ['n3'], ['n0']]);
    expect(b[2]!.notes[0]!.text).toBe('Earlier copy');
  });

  it('orders notes posted at the same time by id', () => {
    const b = foldBoard(
      ['a'],
      [
        { id: 'a', column: 'a', text: '', at: 1 },
        { id: 'c', column: 'a', text: '', at: 1 },
        { id: 'b', column: 'a', text: '', at: 1 },
        { id: 'a', column: 'a', text: 'dup', at: 1 },
      ],
    );
    expect(texts(b[0]!)).toEqual(['a', 'b', 'c']);
    expect(b[0]!.notes[0]!.text).toBe('');
  });
});

describe('NoteBoard', () => {
  it('shows named columns with their notes and counts', () => {
    const { container } = render(<NoteBoard columns={COLUMNS} notes={NOTES} />);
    expect((container.querySelector('[data-slot="note-board"]') as HTMLElement).dataset.minViewport).toBe(
      String(MIN_VIEWPORT),
    );
    const keep = screen.getByRole('region', { name: 'Keep' });
    expect(within(keep).getAllByRole('listitem')).toHaveLength(2);
    expect(within(keep).getByText('2 notes')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Change' })).getByText('1 note')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Try' })).getByText('No notes yet.')).toBeTruthy();
    // No move buttons or add fields unless the app lets the viewer move or add.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('moves a note by its buttons, keeps focus on it, and announces where it went', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100);
    const onMove = vi.fn();
    const { container } = render(<NoteBoard columns={COLUMNS} notes={NOTES} onMove={onMove} />);
    const keep = screen.getByRole('region', { name: 'Keep' });
    // The first column has nowhere to the left.
    expect(within(keep).queryAllByRole('button', { name: 'Move to Change' })).toHaveLength(2);
    fireEvent.click(within(keep).getAllByRole('button', { name: 'Move to Change' })[0]!);
    expect(onMove).toHaveBeenCalledWith({ id: 'n1', column: 'change', at: 100 });
    const change = screen.getByRole('region', { name: 'Change' });
    expect(
      within(change)
        .getAllByRole('listitem')
        .map((li) => li.textContent?.trim().slice(0, 12)),
    ).toEqual(['Short breaks', 'Start on tim']);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Move to Try');
    expect(container.querySelector('[data-slot="note-board-announce"]')?.textContent).toBe('Moved to Change.');
    // To the last column: the same arrow is gone, so focus takes the other one.
    fireEvent.click(document.activeElement as HTMLElement);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Move to Change');
    expect(within(screen.getByRole('region', { name: 'Try' })).getByText('Short breaks')).toBeTruthy();
  });

  it('takes the other arrow on a two-column board, with the app’s words', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5);
    render(
      <NoteBoard
        columns={[
          { id: 'keep', title: 'Keep' },
          { id: 'try', title: 'Try' },
        ]}
        notes={[{ id: 'n1', column: 'keep', text: 'One', at: 1 }]}
        onMove={() => {}}
        labels={{ move: (c) => `To ${c}`, moved: (c) => `Now in ${c}` }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'To Try' }));
    expect(document.activeElement?.getAttribute('aria-label')).toBe('To Keep');
    expect(screen.getByText('Now in Try')).toBeTruthy();
  });

  it('adds a note after the room’s checks, and says why not', () => {
    const onAdd = vi.fn();
    render(<NoteBoard columns={COLUMNS} notes={NOTES} onAdd={onAdd} blocklist={['bad']} size="stage" locale="en-US" />);
    const field = screen.getByRole('textbox', { name: 'Add a note to Try' });
    const add = within(screen.getByRole('region', { name: 'Try' })).getByRole('button', { name: 'Add' });
    fireEvent.click(add);
    expect(screen.getByText('Type a note first.')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(field, { target: { value: 'a bad idea' } });
    expect(field.getAttribute('aria-invalid')).toBeNull();
    fireEvent.click(add);
    expect(screen.getByText('That note cannot go on the board. Try other words.')).toBeTruthy();
    fireEvent.change(field, { target: { value: '  Pair up for the demo  ' } });
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith('try', 'Pair up for the demo');
    expect((field as HTMLInputElement).value).toBe('');
  });

  it('uses the app’s words for refusals and counts', () => {
    render(
      <NoteBoard
        columns={COLUMNS.slice(0, 1)}
        notes={[]}
        onAdd={() => {}}
        labels={{ refused: { empty: 'Nothing yet' }, count: (n) => `n=${n}`, empty: 'Blank', add: 'Post' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByText('Nothing yet')).toBeTruthy();
    expect(screen.getByText('n=0')).toBeTruthy();
    expect(screen.getByText('Blank')).toBeTruthy();
  });
});
