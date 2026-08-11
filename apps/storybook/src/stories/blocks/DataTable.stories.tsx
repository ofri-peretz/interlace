import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  DataTable,
  sortRows,
  type DataTableColumn,
  type DataTableSort,
} from '@interlace/ui/patterns/data-table';
import { withRtl } from '@/decorators';

/* ── Fixture ───────────────────────────────────────────────────────────── */

interface Plugin {
  id: string;
  name: string;
  rules: number;
  downloads: number;
  updated: string;
  owner: string | null;
}

const PLUGINS: Plugin[] = [
  { id: 'p-nest', name: 'eslint-plugin-nestjs', rules: 41, downloads: 18400, updated: '2026-08-02', owner: 'ofri' },
  { id: 'p-express', name: 'eslint-plugin-express', rules: 27, downloads: 9120, updated: '2026-07-28', owner: 'ofri' },
  { id: 'p-secure', name: 'eslint-plugin-secure-coding', rules: 63, downloads: 41200, updated: '2026-08-05', owner: 'dana' },
  { id: 'p-node', name: 'eslint-plugin-node-security', rules: 34, downloads: 7650, updated: '2026-06-19', owner: null },
  { id: 'p-browser', name: 'eslint-plugin-browser-security', rules: 22, downloads: 5310, updated: '2026-07-11', owner: 'dana' },
  { id: 'p-react', name: 'eslint-plugin-react-a11y', rules: 19, downloads: 26800, updated: '2026-08-04', owner: 'ofri' },
];

const nf = new Intl.NumberFormat('en-US');

const COLUMNS: DataTableColumn<Plugin>[] = [
  {
    id: 'name',
    header: 'Package',
    cell: (row) => row.name,
    sortable: true,
    rowHeader: true,
  },
  { id: 'rules', header: 'Rules', cell: (row) => row.rules, sortable: true, align: 'end' },
  {
    id: 'downloads',
    header: 'Downloads',
    cell: (row) => nf.format(row.downloads),
    sortable: true,
    align: 'end',
  },
  { id: 'updated', header: 'Updated', cell: (row) => row.updated, sortable: true },
  {
    id: 'owner',
    header: 'Owner',
    cell: (row) =>
      row.owner ?? (
        <>
          <span aria-hidden>—</span>
          <span className="sr-only">Unassigned</span>
        </>
      ),
  },
];

/** The value each column sorts by — the caller's job, not the table's. */
const sortValue = (row: Plugin, columnId: string) =>
  columnId === 'name'
    ? row.name
    : columnId === 'rules'
      ? row.rules
      : columnId === 'downloads'
        ? row.downloads
        : columnId === 'updated'
          ? row.updated
          : row.owner;

/* ── Meta ──────────────────────────────────────────────────────────────── */

const meta: Meta<typeof DataTable<Plugin>> = {
  title: 'Blocks/DataTable',
  component: DataTable,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Columns, sorting, selection, pagination, and the three states a table spends most of its life in — loading, empty, error.\n\n' +
          '**It is a real `<table>`.** `<caption>`, `<th scope="col">` per column and `<th scope="row">` per row, so a screen reader announces "eslint-plugin-secure-coding, Downloads, 41,200" instead of a bare number. That is the same contract the chart layer\'s `SeriesTable` exists to honour.\n\n' +
          '**State is the caller\'s.** `sort`/`onSortChange` and `selected`/`onSelectionChange` are props, never internal state, so the whole view can live in the query string (`?sort=downloads&dir=desc&page=3`) per `URL_PHILOSOPHY` / `DEEP_LINKING_PHILOSOPHY` — refresh it, bookmark it, send it to a colleague. It also means the SORT is the caller\'s: server-side for anything real, or the exported `sortRows` helper for a small in-memory table.\n\n' +
          '**Not included:** filtering UI, column resize/reorder, virtualization, grouping. Each is named in `DATA_TABLE_PHILOSOPHY.md` and each is its own surface with its own URL contract — a half-built one reads as capability.',
      },
    },
  },
  argTypes: {
    columns: {
      control: false,
      description:
        'One entry per column: `{ id, header, cell, sortable?, align?, rowHeader?, name? }`. `id` is the SORT KEY that goes into the URL, so it should be the server\'s field name and survive a relabelling.',
      table: { type: { summary: 'readonly DataTableColumn<Row>[]' }, category: 'Data' },
    },
    rows: {
      control: false,
      description:
        'Rendered in the order given. The table never re-orders them — at any real scale the sort belongs to the query that fetched them.',
      table: { type: { summary: 'readonly Row[]' }, category: 'Data' },
    },
    rowKey: {
      control: false,
      description:
        'Stable identity per row. Selection is keyed by this and never by index, so it survives sorting, paging and refetching.',
      table: { type: { summary: '(row: Row) => string' }, category: 'Data' },
    },
    caption: {
      control: 'text',
      description:
        'The `<caption>`. Required — an unnamed table of numbers is a wall of numbers, and it is the first thing a screen reader reads. Also the accessible name of the scroll region.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    rowLabel: {
      control: false,
      description:
        'Human name of a row, used as the accessible name of its checkbox — "Select eslint-plugin-nestjs", never twenty controls all called "Select".',
      table: { type: { summary: '(row: Row) => string' }, category: 'Data' },
    },
    sort: {
      control: false,
      description:
        'Current sort (`{ columnId, direction }`) or `null` for the natural order. Deliberately NOT internal state — it belongs in the URL.',
      table: { type: { summary: 'DataTableSort | null' }, defaultValue: { summary: 'null' }, category: 'State' },
    },
    onSortChange: {
      action: 'sortChange',
      description:
        'Receives the next sort on header activation: asc → desc → `null`. The third state is what returns the reader to the server\'s natural order; a two-state toggle makes it unreachable.',
      table: { type: { summary: '(next: DataTableSort | null) => void' }, category: 'Events' },
    },
    selected: {
      control: false,
      description:
        'Selected row keys, INCLUDING keys not on the current page — those survive "select page" untouched.',
      table: { type: { summary: 'readonly string[]' }, category: 'State' },
    },
    onSelectionChange: {
      action: 'selectionChange',
      description: 'Omitting it removes the selection column entirely.',
      table: { type: { summary: '(next: string[]) => void' }, category: 'Events' },
    },
    dense: {
      control: 'boolean',
      description: 'Tighter row height for long tables.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'Appearance' },
    },
    loading: {
      control: 'boolean',
      description:
        'Paints `<Skeleton variant="data-table" />` — a header row plus body rows at the width the data will occupy, never a centred spinner.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    error: {
      control: 'text',
      description:
        'Replaces the BODY only. The header stays sortable and the pager stays put, so a retry lands the reader where they were.',
      table: { type: { summary: 'ReactNode' }, category: 'State' },
    },
    empty: {
      control: 'text',
      description:
        'Shown in place of the body when `rows` is empty. Pass a different node for "no matches, clear the filters" than for "nothing here yet" — only one of those is the reader\'s fault.',
      table: { type: { summary: 'ReactNode' }, category: 'State' },
    },
    pagination: {
      control: false,
      description:
        '`{ page, pageCount, href?, onPageChange? }`, wired to the Pagination primitive. Page-based, never infinite scroll — page 3 has to be somewhere you can return to.',
      table: { type: { summary: 'DataTablePaginationState' }, category: 'State' },
    },
    toolbar: {
      control: false,
      description: 'Extra controls in the selection bar — bulk actions.',
      table: { type: { summary: 'ReactNode' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const BASE = {
  columns: COLUMNS,
  rows: PLUGINS,
  rowKey: (row: Plugin) => row.id,
  rowLabel: (row: Plugin) => row.name,
  caption: 'Interlace ESLint plugins — rules, downloads and last release',
};

export const Default: Story = { args: { ...BASE } };

/**
 * A sorted table where the DATA matches the header. `sort` is only the
 * announcement; ordering the rows is the caller's job (here via the exported
 * `sortRows`, in production via the query).
 */
export const Sorted: Story = {
  args: {
    ...BASE,
    sort: { columnId: 'downloads', direction: 'desc' },
    rows: sortRows(PLUGINS, { columnId: 'downloads', direction: 'desc' }, sortValue),
    caption: 'Plugins by downloads, descending',
  },
  play: async ({ canvasElement }) => {
    const heads = [...canvasElement.querySelectorAll('thead th')];
    const sorted = heads.filter((th) => th.getAttribute('aria-sort') === 'descending');
    await expect(sorted).toHaveLength(1);
    await expect(sorted[0].textContent).toMatch(/Downloads/);
  },
};

/**
 * Keyboard sort. The header control is a real `<button>`: Tab reaches it,
 * Enter presses it, `aria-sort` changes on the `<th>` around it. A
 * click-only sort is a mouse-only table, and axe cannot see the difference.
 */
export const KeyboardSort: Story = {
  render: function KeyboardSortDemo() {
    const [sort, setSort] = React.useState<DataTableSort | null>(null);
    return (
      <DataTable<Plugin>
        {...BASE}
        rows={sortRows(PLUGINS, sort, sortValue)}
        sort={sort}
        onSortChange={setSort}
        caption="Sort from the keyboard: Tab to a header, then Enter"
      />
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const rules = canvas.getByRole('button', { name: /Sort by Rules/i });

    await step('Enter sorts ascending', async () => {
      rules.focus();
      await expect(rules).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(rules.closest('th')).toHaveAttribute('aria-sort', 'ascending'),
      );
    });

    await step('a second press flips it', async () => {
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(rules.closest('th')).toHaveAttribute('aria-sort', 'descending'),
      );
    });

    await step('a third press returns the natural order', async () => {
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(rules.closest('th')).toHaveAttribute('aria-sort', 'none'),
      );
      const first = canvasElement.querySelector('tbody th[scope="row"]');
      await expect(first?.textContent).toBe('eslint-plugin-nestjs');
    });
  },
};

/**
 * Selection is announced twice over: the checkbox names the ROW it belongs
 * to, and a polite live region reports the running count.
 */
export const Selected: Story = {
  args: {
    ...BASE,
    selected: ['p-secure', 'p-react'],
    onSelectionChange: () => {},
    caption: 'Two plugins selected',
  },
};

/**
 * Keyboard selection, and the property the philosophy's third test is about:
 * selections made on page 1 are still there when you come back from page 2,
 * because selection is keyed by row id and never by index.
 */
export const KeyboardSelection: Story = {
  render: function KeyboardSelectionDemo() {
    const [selected, setSelected] = React.useState<string[]>([]);
    const [page, setPage] = React.useState(1);
    const pageSize = 3;
    const pageCount = Math.ceil(PLUGINS.length / pageSize);
    const rows = PLUGINS.slice((page - 1) * pageSize, page * pageSize);
    return (
      <DataTable<Plugin>
        {...BASE}
        rows={rows}
        selected={selected}
        onSelectionChange={setSelected}
        pagination={{ page, pageCount, href: (p) => `?page=${p}`, onPageChange: setPage }}
        caption="Select with Space; selections survive a trip to page 2"
      />
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Space selects the focused row', async () => {
      const box = canvas.getByRole('checkbox', { name: 'Select eslint-plugin-express' });
      box.focus();
      await expect(box).toHaveFocus();
      await userEvent.keyboard(' ');
      await waitFor(() => expect(box).toHaveAttribute('aria-checked', 'true'));
    });

    await step('the count is announced', async () => {
      await waitFor(() =>
        expect(canvasElement.querySelector('[role="status"]')?.textContent).toBe(
          '1 row selected',
        ),
      );
    });

    await step('the selection survives page 2 and back', async () => {
      await userEvent.click(canvas.getByRole('link', { name: /Go to next page/i }));
      await waitFor(() =>
        expect(canvas.getByRole('checkbox', { name: 'Select eslint-plugin-node-security' })).toBeInTheDocument(),
      );
      await userEvent.click(canvas.getByRole('link', { name: /Go to previous page/i }));
      await waitFor(() =>
        expect(
          canvas.getByRole('checkbox', { name: 'Select eslint-plugin-express' }),
        ).toHaveAttribute('aria-checked', 'true'),
      );
    });
  },
};

/**
 * The header checkbox owns the current page only. Partial selection renders
 * `aria-checked="mixed"`, and an empty page reads as unchecked rather than
 * checked — `[].every()` being `true` is how that bug ships.
 */
export const SelectPage: Story = {
  render: function SelectPageDemo() {
    const [selected, setSelected] = React.useState<string[]>(['p-browser']);
    return (
      <DataTable<Plugin>
        {...BASE}
        rows={PLUGINS.slice(0, 3)}
        selected={selected}
        onSelectionChange={setSelected}
        caption="Select page — the off-page selection is left alone"
        toolbar={<span className="text-muted-foreground">Bulk actions go here</span>}
      />
    );
  },
};

/** Header row plus body rows, at the width the data will occupy. */
export const Loading: Story = {
  args: { ...BASE, rows: [], loading: true },
};

/**
 * Two empty states, not one. "Nothing here yet" invites you to create
 * something; "no matches" tells you to loosen a filter. Rendering the same
 * sentence for both blames the reader for an empty database.
 */
export const Empty: Story = {
  args: {
    ...BASE,
    rows: [],
    empty: 'No plugins match these filters. Clear the filters to see all 6.',
  },
};

/**
 * The body is replaced; the header stays sortable and the pager stays put,
 * so only the body re-fetches and the retry lands the reader where they
 * were.
 */
export const ErrorState: Story = {
  args: {
    ...BASE,
    rows: [],
    error: 'Could not reach the registry.',
    onRetry: () => {},
    onSortChange: () => {},
    pagination: { page: 1, pageCount: 3, href: (p) => `?page=${p}` },
  },
};

/** Tighter rows for long tables. Same semantics, less air. */
export const Dense: Story = {
  args: { ...BASE, dense: true, caption: 'Dense rows' },
};

/**
 * The overflow case. Thirteen columns do not fit a phone, or a laptop — so
 * the TABLE scrolls sideways inside its own bordered box and the page does
 * not. The scroll box is focusable and labelled, because a region you can
 * only reach with a mouse is a region half your readers cannot read.
 */
export const ManyColumns: Story = {
  args: {
    ...BASE,
    caption: 'Thirteen columns — the table scrolls, the page does not',
    columns: [
      ...COLUMNS,
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `q${i + 1}`,
        header: `2026-Q${i + 1}`,
        align: 'end' as const,
        cell: (row: Plugin) => nf.format(Math.round(row.downloads / (i + 2))),
      })),
    ],
    onSortChange: () => {},
    onSelectionChange: () => {},
  },
  play: async ({ canvasElement }) => {
    const scroll = canvasElement.querySelector<HTMLElement>(
      '[data-slot="data-table-scroll"]',
    )!;
    // The table overflows...
    await expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
    // ...and the PAGE does not. Measured by trying to scroll it rather than
    // by reading `documentElement.scrollWidth`, which in Chromium still
    // reports the union of clipped descendants and would fail a table that
    // is behaving perfectly.
    window.scrollTo(9999, 0);
    await expect(window.scrollX).toBe(0);
    await expect(document.body.scrollWidth).toBeLessThanOrEqual(
      document.body.clientWidth,
    );
  },
};

/** Pagination wired to the primitive: real links, real hrefs, no infinite scroll. */
export const Paginated: Story = {
  render: function PaginatedDemo() {
    const [page, setPage] = React.useState(3);
    return (
      <DataTable<Plugin>
        {...BASE}
        rows={PLUGINS.slice(0, 3)}
        pagination={{ page, pageCount: 12, href: (p) => `?page=${p}`, onPageChange: setPage }}
        caption="Page 3 of 12 — bookmarkable, back-button-safe"
      />
    );
  },
};

export const Dark: Story = {
  args: {
    ...BASE,
    selected: ['p-secure'],
    onSelectionChange: () => {},
    sort: { columnId: 'downloads', direction: 'desc' },
    onSortChange: () => {},
    rows: sortRows(PLUGINS, { columnId: 'downloads', direction: 'desc' }, sortValue),
  },
  globals: { theme: 'dark' },
};

/**
 * RTL. The table uses logical properties (`text-start` / `text-end` /
 * `ms-auto`), so the row header leads on the right and the numeric columns
 * stay on the reading-end side rather than being pinned to physical right.
 */
export const Rtl: Story = {
  args: {
    ...BASE,
    onSelectionChange: () => {},
    onSortChange: () => {},
    pagination: { page: 2, pageCount: 5, href: (p) => `?page=${p}` },
  },
  decorators: [withRtl],
};
