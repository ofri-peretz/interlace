/**
 * DataTable model — the arithmetic behind the table.
 *
 * Everything here is a pure function, and every one of them encodes a bug
 * that a rendering test would have watched go past: a sort cycle with two
 * states instead of three, a "select page" that drops the selections made on
 * another page, a header checkbox that reads as CHECKED over an empty table
 * because `[].every()` is `true`.
 *
 * The component file holds no branch that is not a render decision, so this
 * suite is where the table's behaviour is actually pinned.
 */

import { describe, expect, it } from 'vitest';

import {
  ariaSortOf,
  clampPage,
  columnName,
  compareValues,
  nextSort,
  pageSelectionState,
  pageWindow,
  selectionMessage,
  sortActionLabel,
  sortRows,
  toggleKey,
  togglePageSelection,
  type DataTableSort,
} from '../src/patterns/data-table-model.js';

describe('nextSort', () => {
  it('cycles asc → desc → unsorted on the same column', () => {
    const first = nextSort(null, 'name');
    expect(first).toEqual({ columnId: 'name', direction: 'asc' });

    const second = nextSort(first, 'name');
    expect(second).toEqual({ columnId: 'name', direction: 'desc' });

    // The third press is the one a two-state toggle makes unreachable — and
    // it is the one that returns the reader to the server's natural order.
    expect(nextSort(second, 'name')).toBeNull();
  });

  it('starts a different column at ascending rather than inheriting', () => {
    const current: DataTableSort = { columnId: 'name', direction: 'desc' };
    expect(nextSort(current, 'stars')).toEqual({
      columnId: 'stars',
      direction: 'asc',
    });
  });

  it('treats undefined like no sort at all', () => {
    expect(nextSort(undefined, 'name')).toEqual({
      columnId: 'name',
      direction: 'asc',
    });
  });
});

describe('ariaSortOf', () => {
  it('reports the active column and none for the rest', () => {
    const sort: DataTableSort = { columnId: 'name', direction: 'asc' };
    expect(ariaSortOf(sort, 'name')).toBe('ascending');
    expect(ariaSortOf(sort, 'stars')).toBe('none');
    expect(ariaSortOf({ columnId: 'name', direction: 'desc' }, 'name')).toBe(
      'descending',
    );
    expect(ariaSortOf(null, 'name')).toBe('none');
  });
});

describe('sortActionLabel', () => {
  it('describes the press, not the current state', () => {
    expect(sortActionLabel(null, 'name', 'Package')).toBe(
      'Sort by Package, ascending',
    );
    expect(
      sortActionLabel({ columnId: 'name', direction: 'asc' }, 'name', 'Package'),
    ).toBe('Sort by Package, descending');
    expect(
      sortActionLabel({ columnId: 'name', direction: 'desc' }, 'name', 'Package'),
    ).toBe('Remove sorting from Package');
  });
});

describe('compareValues', () => {
  it('orders numbers numerically, not lexically', () => {
    expect(compareValues(9, 10)).toBeLessThan(0);
    expect(compareValues(10, 9)).toBeGreaterThan(0);
    expect(compareValues(3, 3)).toBe(0);
  });

  it('orders dates chronologically', () => {
    expect(
      compareValues(new Date('2026-01-01'), new Date('2026-06-01')),
    ).toBeLessThan(0);
  });

  it('orders strings with numeric collation so item-2 precedes item-10', () => {
    expect(compareValues('item-2', 'item-10')).toBeLessThan(0);
    expect(compareValues('b', 'a')).toBeGreaterThan(0);
    expect(compareValues('a', 'a')).toBe(0);
  });

  it('orders booleans false before true', () => {
    expect(compareValues(false, true)).toBeLessThan(0);
    expect(compareValues(true, false)).toBeGreaterThan(0);
    expect(compareValues(true, 1)).toBe(0);
  });

  it('puts blanks last and treats two blanks as equal', () => {
    expect(compareValues(null, 5)).toBeGreaterThan(0);
    expect(compareValues(5, undefined)).toBeLessThan(0);
    expect(compareValues(null, undefined)).toBe(0);
  });
});

describe('sortRows', () => {
  const rows = [
    { id: 'b', stars: 20 },
    { id: 'a', stars: 20 },
    { id: 'c', stars: 5 },
    { id: 'd', stars: null as number | null },
  ];
  const getValue = (row: (typeof rows)[number], columnId: string) =>
    columnId === 'stars' ? row.stars : row.id;

  it('returns a copy in the original order when unsorted', () => {
    const out = sortRows(rows, null, getValue);
    expect(out.map((r) => r.id)).toEqual(['b', 'a', 'c', 'd']);
    expect(out).not.toBe(rows);
  });

  it('is stable — equal values keep their input order', () => {
    const out = sortRows(rows, { columnId: 'stars', direction: 'desc' }, getValue);
    // b and a both have 20 stars; b came first in the input and stays first.
    expect(out.map((r) => r.id)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('sorts ascending', () => {
    const out = sortRows(rows, { columnId: 'stars', direction: 'asc' }, getValue);
    expect(out.map((r) => r.id)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('keeps blanks last in BOTH directions', () => {
    for (const direction of ['asc', 'desc'] as const) {
      const out = sortRows(rows, { columnId: 'stars', direction }, getValue);
      expect(out[out.length - 1].id).toBe('d');
    }
  });
});

describe('pageSelectionState', () => {
  it('reads none / some / all', () => {
    expect(pageSelectionState(['a', 'b'], [])).toBe('none');
    expect(pageSelectionState(['a', 'b'], ['a'])).toBe('some');
    expect(pageSelectionState(['a', 'b'], ['a', 'b'])).toBe('all');
  });

  it('an empty page is none, not all', () => {
    // `[].every(...)` is `true` — the exact reason this is a function and not
    // an inline every() in JSX.
    expect(pageSelectionState([], ['x'])).toBe('none');
  });

  it('ignores selections that are not on this page', () => {
    expect(pageSelectionState(['a'], ['a', 'off-page'])).toBe('all');
  });
});

describe('toggleKey', () => {
  it('adds a missing key and removes a present one', () => {
    expect(toggleKey(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleKey(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('never mutates the input', () => {
    const input = ['a'];
    toggleKey(input, 'b');
    expect(input).toEqual(['a']);
  });
});

describe('togglePageSelection', () => {
  it('selects the whole page without touching other pages', () => {
    expect(togglePageSelection(['off-page'], ['a', 'b'])).toEqual([
      'off-page',
      'a',
      'b',
    ]);
  });

  it('promotes a partial page to a full one', () => {
    expect(togglePageSelection(['a'], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('clears only this page when the page is fully selected', () => {
    // The selection test from DATA_TABLE_PHILOSOPHY §5: page 1's picks must
    // survive a "clear page" on page 2.
    expect(togglePageSelection(['page-1', 'a', 'b'], ['a', 'b'])).toEqual([
      'page-1',
    ]);
  });
});

describe('selectionMessage', () => {
  it('is empty when nothing is selected, so the live region can be permanent', () => {
    expect(selectionMessage(0)).toBe('');
    expect(selectionMessage(-1)).toBe('');
  });

  it('counts and pluralises', () => {
    expect(selectionMessage(2)).toBe('2 rows selected');
    expect(selectionMessage(1)).toBe('1 row selected');
  });
});

describe('pageWindow', () => {
  it('shows every page when they all fit', () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it('elides both ends around the middle', () => {
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
  });

  it('never elides a single page — 1 … 3 is a lie about how much is hidden', () => {
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('clamps an out-of-range page instead of rendering a phantom one', () => {
    expect(pageWindow(99, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(0, 3)).toEqual([1, 2, 3]);
  });

  it('honours a wider sibling count', () => {
    expect(pageWindow(10, 20, 2)).toEqual([1, null, 8, 9, 10, 11, 12, null, 20]);
  });

  it('is empty when there are no pages', () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });

  it('collapses to a single page', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});

describe('clampPage', () => {
  it('keeps a page inside the range', () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(3, 5)).toBe(3);
  });

  it('survives junk', () => {
    expect(clampPage(Number.NaN, 5)).toBe(1);
    expect(clampPage(2.7, 5)).toBe(2);
    // pageCount 0 still has to yield a renderable page number.
    expect(clampPage(4, 0)).toBe(1);
  });
});

describe('columnName', () => {
  it('prefers an explicit name, then a string header, then the id', () => {
    expect(columnName({ id: 'stars', name: 'GitHub stars' })).toBe(
      'GitHub stars',
    );
    expect(columnName({ id: 'stars', header: 'Stars' })).toBe('Stars');
    expect(columnName({ id: 'stars', header: { type: 'svg' } })).toBe('stars');
    expect(columnName({ id: 'stars' })).toBe('stars');
  });
});
