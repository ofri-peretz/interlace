/**
 * DataTable — the rendered contract.
 *
 * `data-table-model.test.ts` proves the arithmetic. This proves the things a
 * reader actually receives: that the markup is a real table with a caption
 * and row headers, that sorting is announced and reachable from the keyboard,
 * that every selection checkbox names its ROW rather than saying "select"
 * twenty times, and that loading / empty / error each render something
 * instead of a blank box.
 *
 * jsdom cannot measure a box, so nothing here asserts layout — the overflow
 * container and the 375px behaviour are verified in Storybook against a real
 * engine. What is asserted here is semantics, which jsdom models exactly.
 */

import * as React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DataTable,
  type DataTableColumn,
} from '../src/patterns/data-table.js';

afterEach(cleanup);

/**
 * jsdom ships no `PointerEvent`, and Base UI's Checkbox constructs one on
 * activation (`new (ownerWindow(el).PointerEvent)(...)`) — so without this
 * every checkbox interaction throws out of the React event handler and the
 * assertion after it fails for a reason that has nothing to do with the
 * table. Same shim `charts-components.test.tsx` carries, same reason: the
 * component is right to use pointer events, the environment is what is
 * missing.
 */
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventShim extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  globalThis.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
}

interface Pkg {
  id: string;
  name: string;
  stars: number;
}

const ROWS: Pkg[] = [
  { id: 'eslint-plugin-a', name: 'plugin-a', stars: 120 },
  { id: 'eslint-plugin-b', name: 'plugin-b', stars: 40 },
  { id: 'eslint-plugin-c', name: 'plugin-c', stars: 7 },
];

const COLUMNS: DataTableColumn<Pkg>[] = [
  { id: 'name', header: 'Package', cell: (row) => row.name, sortable: true },
  {
    id: 'stars',
    header: 'Stars',
    cell: (row) => row.stars,
    sortable: true,
    align: 'end',
  },
];

const renderTable = (props: Partial<React.ComponentProps<typeof DataTable<Pkg>>> = {}) =>
  render(
    <DataTable<Pkg>
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(row) => row.id}
      rowLabel={(row) => row.name}
      caption="Plugins by stars"
      {...props}
    />,
  );

describe('table semantics', () => {
  it('is a real table with a caption and column headers', () => {
    const { container } = renderTable();
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table!.querySelector('caption')?.textContent).toContain(
      'Plugins by stars',
    );

    const heads = [...table!.querySelectorAll('thead th')];
    expect(heads.map((th) => th.getAttribute('scope'))).toEqual(['col', 'col']);
  });

  it('names each row with a th[scope=row] so a value is never announced alone', () => {
    const { container } = renderTable();
    const rowHeaders = [...container.querySelectorAll('tbody th[scope="row"]')];
    expect(rowHeaders.map((th) => th.textContent)).toEqual([
      'plugin-a',
      'plugin-b',
      'plugin-c',
    ]);
  });

  it('promotes the column that declares rowHeader, not just the first', () => {
    const { container } = renderTable({
      columns: [
        { id: 'stars', header: 'Stars', cell: (row: Pkg) => row.stars },
        {
          id: 'name',
          header: 'Package',
          cell: (row: Pkg) => row.name,
          rowHeader: true,
        },
      ],
    });
    const first = container.querySelector('tbody th[scope="row"]');
    expect(first?.textContent).toBe('plugin-a');
  });

  it('hides the caption visually while keeping it in the tree', () => {
    const { container } = renderTable({ captionHidden: true });
    expect(container.querySelector('caption')?.className).toContain('sr-only');
  });
});

describe('sorting', () => {
  it('marks the sorted column with aria-sort and the rest with none', () => {
    const { container } = renderTable({
      sort: { columnId: 'stars', direction: 'desc' },
      onSortChange: vi.fn(),
    });
    const heads = [...container.querySelectorAll('thead th')];
    expect(heads.map((th) => th.getAttribute('aria-sort'))).toEqual([
      'none',
      'descending',
    ]);
  });

  it('is a real button, reachable and operable from the keyboard', async () => {
    const onSortChange = vi.fn();
    renderTable({ onSortChange });

    const button = screen.getByRole('button', { name: /Sort by Package/i });
    button.focus();
    expect(document.activeElement).toBe(button);

    await userEvent.keyboard('{Enter}');
    expect(onSortChange).toHaveBeenCalledWith({
      columnId: 'name',
      direction: 'asc',
    });
  });

  it('announces what the NEXT press will do', () => {
    renderTable({
      sort: { columnId: 'name', direction: 'asc' },
      onSortChange: vi.fn(),
    });
    expect(
      screen.getByRole('button', { name: /Sort by Package, descending/i }),
    ).toBeTruthy();
  });

  it('renders inert headers when the caller wires no handler', () => {
    const { container } = renderTable();
    expect(container.querySelectorAll('thead button')).toHaveLength(0);
    expect(
      container.querySelector('thead th')?.getAttribute('aria-sort'),
    ).toBeNull();
  });
});

describe('selection', () => {
  it('gives every checkbox an accessible name that identifies the row', () => {
    renderTable({ onSelectionChange: vi.fn() });
    expect(screen.getByRole('checkbox', { name: 'Select plugin-a' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Select plugin-b' })).toBeTruthy();
  });

  it('falls back to the row key when no rowLabel is given', () => {
    renderTable({ onSelectionChange: vi.fn(), rowLabel: undefined });
    expect(
      screen.getByRole('checkbox', { name: 'Select eslint-plugin-a' }),
    ).toBeTruthy();
  });

  it('reflects selection on the row and toggles from the keyboard', async () => {
    const onSelectionChange = vi.fn();
    const { container } = renderTable({
      selected: ['eslint-plugin-b'],
      onSelectionChange,
    });

    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows.map((tr) => tr.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ]);

    const box = screen.getByRole('checkbox', { name: 'Select plugin-a' });
    box.focus();
    await userEvent.keyboard(' ');
    expect(onSelectionChange).toHaveBeenCalledWith([
      'eslint-plugin-b',
      'eslint-plugin-a',
    ]);
  });

  it('the header checkbox owns the page and says so', async () => {
    const onSelectionChange = vi.fn();
    renderTable({ selected: ['off-page'], onSelectionChange });

    const head = screen.getByRole('checkbox', {
      name: 'Select all 3 rows on this page',
    });
    await userEvent.click(head);
    // The off-page key survives — that is the whole point of keying selection
    // by row id.
    expect(onSelectionChange).toHaveBeenCalledWith([
      'off-page',
      'eslint-plugin-a',
      'eslint-plugin-b',
      'eslint-plugin-c',
    ]);
  });

  it('is indeterminate while the page is partly selected', () => {
    renderTable({ selected: ['eslint-plugin-a'], onSelectionChange: vi.fn() });
    const head = screen.getByRole('checkbox', {
      name: 'Select all 3 rows on this page',
    });
    expect(head.getAttribute('aria-checked')).toBe('mixed');
  });

  it('announces the count in a live region that exists before it has news', () => {
    const { container, rerender } = renderTable({ onSelectionChange: vi.fn() });
    const live = container.querySelector('[role="status"]');
    expect(live).not.toBeNull();
    expect(live!.textContent).toBe('');

    rerender(
      <DataTable<Pkg>
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        caption="Plugins by stars"
        selected={['eslint-plugin-a']}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(
      container.querySelector('[role="status"]')!.textContent,
    ).toBe('1 row selected');
  });

  it('drops the selection column entirely when no handler is passed', () => {
    renderTable();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('offers a way out of a selection', async () => {
    const onSelectionChange = vi.fn();
    renderTable({ selected: ['eslint-plugin-a'], onSelectionChange });
    await userEvent.click(screen.getByRole('button', { name: /Clear selection/i }));
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });
});

describe('states', () => {
  it('loading paints the table-shaped skeleton, not a spinner', () => {
    const { container } = renderTable({ loading: true });
    const skeleton = container.querySelector('[data-variant="data-table"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton!.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('table')).toBeNull();
  });

  it('empty keeps the header and spans the body with the caller message', () => {
    const { container } = renderTable({
      rows: [],
      empty: 'No matches. Clear the filters.',
      onSelectionChange: vi.fn(),
    });
    expect(container.querySelectorAll('thead th')).toHaveLength(3);
    const cell = container.querySelector('tbody td');
    // Selection column + both data columns.
    expect(cell?.getAttribute('colspan')).toBe('3');
    expect(cell?.textContent).toContain('No matches');
  });

  it('empty has a default message rather than a blank row', () => {
    const { container } = renderTable({ rows: [] });
    expect(container.querySelector('tbody td')?.textContent).toContain(
      'No results',
    );
  });

  it('error replaces the body, keeps the sortable header, and can retry', async () => {
    const onRetry = vi.fn();
    const { container } = renderTable({
      error: 'Could not load plugins.',
      onRetry,
      onSortChange: vi.fn(),
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Could not load plugins.');
    // The header stays interactive — only the body re-fetches.
    expect(
      within(container.querySelector('thead')!).getAllByRole('button'),
    ).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('error wins over empty — a failed fetch is not "no data"', () => {
    renderTable({ rows: [], error: 'Boom' });
    expect(screen.getByRole('alert').textContent).toContain('Boom');
    expect(screen.queryByText(/No results/)).toBeNull();
  });
});

describe('pagination', () => {
  it('renders a real linked pager and reports the current page', () => {
    renderTable({
      pagination: { page: 2, pageCount: 5, href: (p) => `?page=${p}` },
    });
    const nav = screen.getByRole('navigation', { name: /pagination/i });
    const current = within(nav)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe('2');
    expect(current[0].getAttribute('href')).toBe('?page=2');
  });

  it('intercepts the click when the caller owns navigation', async () => {
    const onPageChange = vi.fn();
    renderTable({ pagination: { page: 1, pageCount: 5, onPageChange } });
    await userEvent.click(screen.getByRole('link', { name: /Go to next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('marks the ends aria-disabled and does not navigate off the range', async () => {
    const onPageChange = vi.fn();
    renderTable({ pagination: { page: 1, pageCount: 3, onPageChange } });
    const previous = screen.getByRole('link', { name: /Go to previous page/i });
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(previous);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('is absent unless the caller asks for it', () => {
    renderTable();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('the scroll container', () => {
  it('is the table box itself — labelled and focusable', () => {
    const { container } = renderTable();
    const scroll = container.querySelector('[data-slot="data-table-scroll"]');
    expect(scroll?.className).toContain('overflow-x-auto');
    // A region that scrolls but cannot be focused is unreachable without a
    // mouse, and a table with no sort and no selection has no focusable
    // descendant to borrow.
    expect(scroll?.getAttribute('tabindex')).toBe('0');
    expect(scroll?.getAttribute('aria-label')).toBe('Plugins by stars');
  });

  it('declares the min viewport it was designed against', () => {
    const { container } = renderTable();
    expect(
      container
        .querySelector('[data-slot="data-table"]')
        ?.getAttribute('data-min-viewport'),
    ).toBe('320');
  });
});
