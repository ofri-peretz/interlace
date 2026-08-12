'use client';

/**
 * @interlace/ui — DataTable
 *
 * Columns, sorting, row selection, pagination, and the three states a table
 * spends most of its life in (loading / empty / error). It composes
 * primitives — Checkbox, Pagination, Skeleton, Button — so it is a pattern,
 * not a primitive.
 *
 * ## It is a real `<table>`
 *
 * Not a grid of divs. `<caption>` names it, `<th scope="col">` names each
 * column, and one column per row is a `<th scope="row">` that names the row
 * (`rowHeader` on the column, defaulting to the first). That triple is what
 * makes a screen reader announce "Revenue, March, 41,200" instead of
 * "41,200" — a bare number in a bare cell is unreadable by anyone not
 * looking at the screen, and no amount of `aria-label` on the wrapper fixes
 * it. It is the same contract `charts/series-table.tsx` exists to honour for
 * the chart layer.
 *
 * ## State is the caller's
 *
 * `sort` / `onSortChange` and `selected` / `onSelectionChange` are props, not
 * `useState`. The table renders `rows` in the order it received them and
 * highlights the keys it was handed.
 *
 * That is not purity for its own sake — it is the only shape that satisfies
 * URL_PHILOSOPHY / DEEP_LINKING_PHILOSOPHY. Table state belongs in the query
 * string (`?sort=createdAt&dir=desc&page=3`) so a filtered, sorted, paged
 * view survives a refresh and can be pasted to a colleague. A table holding
 * its own sort state cannot put it there, and the "controlled OR uncontrolled"
 * compromise is worse: it makes the URL an optional feature, which means it
 * is the feature nobody wires up. It also means the SORT ITSELF is the
 * caller's — server-side for anything real; `sortRows` from
 * `./data-table-model.js` for the small in-memory case.
 *
 * Selection is keyed by row ID (`rowKey`), never by index, so it survives
 * both sorting and pagination.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The table scrolls horizontally inside its own container; the page never
 * does. The pager and the selection bar sit OUTSIDE that container, so they
 * stay put while the columns scroll under them.
 *
 * | Rule | Concept                    | Where in this file                                            |
 * | ---- | -------------------------- | ------------------------------------------------------------- |
 * | R4   | Extends native el          | `Omit<React.ComponentProps<'div'>, 'onSelect'>`                |
 * | R6   | data-slot on every part    | `data-table` / `-scroll` / `-head` / `-row` / `-pagination`    |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                                       |
 * | R8   | No `isXxx`                 | `loading`, `dense`, `selected`, `sort`                         |
 * | R10  | Composition seam           | `columns[].cell`, `empty`, `error`, `toolbar` take nodes       |
 * | R11  | One variable per part      | the row owns selection; the head owns sort                     |
 * | R12  | Reuse over wrap            | Checkbox / Pagination / Skeleton / Button are the primitives   |
 * | R13  | Ecosystem first            | zero new dependencies — no TanStack Table                      |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`                     |
 * | R18  | Tailwind only              | zero inline `style`                                            |
 * | R19  | Tokens only                | `border-border`, `bg-muted`, `text-muted-foreground`           |
 * | R20  | AA contrast                | selected row = `bg-accent`/`text-accent-foreground` (9.31:1 light, 9.85:1 dark) |
 * | R23  | No layout shift            | `loading` paints `<Skeleton variant="data-table" />`           |
 * | R25  | Client component           | sort / selection handlers                                      |
 * | R26  | A11y                       | table semantics + `aria-sort` + named checkboxes + live region |
 *
 * ## What this is not
 *
 * No filtering UI, no column resize/reorder, no virtualization, no grouping.
 * Each is named in DATA_TABLE_PHILOSOPHY; each is a separate surface with its
 * own URL contract, and a half-built one is worse than an absent one because
 * it reads as capability. See the notes at the bottom of this file.
 */

import * as React from 'react';
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { Checkbox } from '../primitives/checkbox.js';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../primitives/pagination.js';
import { Skeleton } from '../primitives/skeleton.js';
import {
  ariaSortOf,
  clampPage,
  columnName,
  nextSort,
  pageSelectionState,
  pageWindow,
  selectionMessage,
  sortActionLabel,
  toggleKey,
  togglePageSelection,
  type DataTableSort,
} from './data-table-model.js';

export const MIN_VIEWPORT = 320 as const;

/**
 * Stable empty array for the `selected` default.
 *
 * A `= []` default literal is a new array on every render, which changes the
 * identity of the memo input below it and turns the memo into a no-op.
 */
const EMPTY_SELECTION: readonly string[] = [];

export interface DataTableColumn<Row> {
  /**
   * Stable identifier AND the sort key. It is what `sort.columnId` carries
   * into `?sort=`, so it should be the server's field name — not the display
   * label, which is free to change.
   */
  id: string;
  /** Header content. Usually a string; may be any node. */
  header: React.ReactNode;
  /** Cell renderer for this column. */
  cell: (row: Row) => React.ReactNode;
  /**
   * Plain-text column name for the strings assistive tech reads (the sort
   * button's action label). Only needed when `header` is not a string.
   */
  name?: string;
  /**
   * Marks the column sortable: the header becomes a real `<button>` and the
   * `<th>` carries `aria-sort`. Requires `onSortChange` to do anything.
   */
  sortable?: boolean;
  /** `end` right-aligns the column — use it for numbers. */
  align?: 'start' | 'end';
  /**
   * Renders this column's cell as `<th scope="row">` — the cell that NAMES
   * the row. Exactly one column should set it; if none does, the first
   * column is used, because a table whose rows have no header announces
   * every value as an orphan.
   */
  rowHeader?: boolean;
  /** Merged onto both the `<th>` and the `<td>` of this column. */
  className?: string;
}

export interface DataTablePaginationState {
  /** 1-based. */
  page: number;
  pageCount: number;
  /**
   * The href for a page. Give a real one — a pager of `href="#"` is a pager
   * you cannot middle-click, bookmark, or hand to a crawler
   * (PAGINATION_PHILOSOPHY).
   */
  href?: (page: number) => string;
  /**
   * Called on activation. When present the click is intercepted
   * (`preventDefault`) so a router can own the navigation; when absent the
   * link navigates on its own.
   */
  onPageChange?: (page: number) => void;
}

export interface DataTableProps<Row>
  extends Omit<React.ComponentProps<'div'>, 'onSelect'> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  /**
   * Stable identity per row. Selection is keyed by this value, so it must
   * survive sorting, paging and refetching — a database id, not an index.
   */
  rowKey: (row: Row) => string;
  /**
   * The `<caption>`. Required: an unnamed table of numbers is a wall of
   * numbers, and it is the first thing a screen reader reads.
   */
  caption: string;
  /**
   * Visually hides the caption (it stays in the accessibility tree). Use
   * when a heading directly above already names the table.
   */
  captionHidden?: boolean;
  /**
   * Human name of a row, used as the accessible name of its selection
   * checkbox — "Select Ada Lovelace", never "Select". Defaults to `rowKey`,
   * which is better than nothing and worse than a name.
   */
  rowLabel?: (row: Row) => string;
  /** Current sort, or `null` for the server's natural order. */
  sort?: DataTableSort | null;
  /**
   * Receives the next sort on header activation (asc → desc → null).
   * Omitting it leaves every header inert, whatever the columns declare.
   */
  onSortChange?: (next: DataTableSort | null) => void;
  /**
   * Selected row keys — including keys that are not on the current page.
   * Those survive untouched through "select page".
   */
  selected?: readonly string[];
  /** Omitting it removes the selection column entirely. */
  onSelectionChange?: (next: string[]) => void;
  /** Tighter row height for long tables. */
  dense?: boolean;
  /** Paints `<Skeleton variant="data-table" />` instead of the table. */
  loading?: boolean;
  /**
   * Error message. Replaces the BODY only — the header and the pager stay
   * put, so the retry lands the reader back where they were.
   */
  error?: React.ReactNode;
  /** Renders a Retry button beside `error`. */
  onRetry?: () => void;
  /**
   * Shown in place of the body when `rows` is empty. Pass a different node
   * for "no matches, clear filters" than for "nothing here yet" — they are
   * different messages and only one of them is the reader's fault.
   */
  empty?: React.ReactNode;
  /** Wires the Pagination primitive under the table. */
  pagination?: DataTablePaginationState;
  /** Extra controls in the selection bar (bulk actions). */
  toolbar?: React.ReactNode;
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  captionHidden = false,
  rowLabel,
  sort = null,
  onSortChange,
  selected = EMPTY_SELECTION,
  onSelectionChange,
  dense = false,
  loading = false,
  error,
  onRetry,
  empty,
  pagination,
  toolbar,
  className,
  ...props
}: DataTableProps<Row>) {
  const selectable = Boolean(onSelectionChange);
  const pageKeys = React.useMemo(() => rows.map(rowKey), [rows, rowKey]);
  const chosen = React.useMemo(() => new Set(selected), [selected]);

  // `rowHeader` on any column wins; otherwise the first column names the row.
  const headerColumnId =
    columns.find((column) => column.rowHeader)?.id ?? columns[0]?.id;

  const columnCount = columns.length + (selectable ? 1 : 0);
  const headState = pageSelectionState(pageKeys, selected);
  const cellPadding = dense ? 'px-3 py-1' : 'px-3 py-2';

  if (loading) {
    return (
      <div
        data-slot="data-table"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('flex w-full flex-col gap-3', className)}
        {...props}
      >
        <Skeleton variant="data-table" label={`Loading ${caption}`} />
      </div>
    );
  }

  return (
    <div
      data-slot="data-table"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex w-full flex-col gap-3', className)}
      {...props}
    >
      {/* Rendered unconditionally, even while empty: a live region inserted
          in the same tick as its first message is usually dropped. */}
      <p role="status" aria-live="polite" className="sr-only">
        {selectionMessage(selected.length)}
      </p>

      {selectable && selected.length > 0 ? (
        <div
          data-slot="data-table-selection"
          className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          <span className="text-muted-foreground">
            {selectionMessage(selected.length)}
          </span>
          {toolbar}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ms-auto"
            onClick={() => onSelectionChange!([])}
          >
            Clear selection
          </Button>
        </div>
      ) : null}

      {/*
        The scroll box is the table's own, and it is focusable + labelled:
        a region that scrolls but cannot be reached by keyboard is
        unreadable to anyone not using a mouse (axe: scrollable-region-
        focusable), and a sortless, selectionless table has no focusable
        descendant to inherit that from.
      */}
      <section
        data-slot="data-table-scroll"
        aria-label={caption}
        tabIndex={0}
        // `relative` is not styling — it is what makes this box the
        // containing block for the absolutely-positioned `sr-only` spans
        // inside the sort buttons. Without it those spans resolve against
        // the viewport, escape `overflow-x-auto` entirely, and their static
        // position in column 13 gives the PAGE a 233px horizontal scroll on
        // a 375px phone. The table scrolled correctly the whole time; the
        // thing dragging the page sideways was invisible text.
        className="relative w-full overflow-x-auto rounded-md border border-border focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <table className="w-full border-collapse text-sm">
          <caption
            className={cn(
              // `text-start`, not `text-left`: in RTL the caption belongs on
              // the reading edge with the row headers it introduces.
              'px-3 py-2 text-start text-xs text-muted-foreground',
              captionHidden && 'sr-only',
            )}
          >
            {caption}
          </caption>
          <thead>
            <tr data-slot="data-table-head-row">
              {selectable ? (
                <th
                  scope="col"
                  data-slot="data-table-head"
                  className={cn(
                    'w-px border-b border-border text-start',
                    cellPadding,
                  )}
                >
                  {/* The flex wrapper is load-bearing, not decoration. Base
                      UI renders Checkbox.Root as a `<span>`, and a bare span
                      in a table cell computes `display: inline` — where
                      `size-4` is ignored outright and the 16px control paints
                      as a 2px sliver. Caught in a real browser; jsdom reports
                      every box as 0×0 and would have called it fine. */}
                  <span className="flex items-center">
                    <Checkbox
                      checked={headState === 'all'}
                      indeterminate={headState === 'some'}
                      aria-label={`Select all ${rows.length} rows on this page`}
                      data-slot="data-table-select-page"
                      onCheckedChange={() =>
                        onSelectionChange!(
                          togglePageSelection(selected, pageKeys),
                        )
                      }
                    />
                  </span>
                </th>
              ) : null}
              {columns.map((column) => {
                const sortable = Boolean(column.sortable && onSortChange);
                const name = columnName(column);
                return (
                  <th
                    key={column.id}
                    scope="col"
                    data-slot="data-table-head"
                    data-column={column.id}
                    aria-sort={
                      sortable ? ariaSortOf(sort, column.id) : undefined
                    }
                    className={cn(
                      'whitespace-nowrap border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground',
                      column.align === 'end' ? 'text-end' : 'text-start',
                      // A sortable head's padding lives on the button, so the
                      // whole cell is the hit target rather than a word in the
                      // middle of it.
                      sortable ? 'p-0' : cellPadding,
                      column.className,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        data-slot="data-table-sort"
                        className={cn(
                          'flex w-full items-center gap-1 rounded-sm text-xs font-medium uppercase tracking-wide hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                          cellPadding,
                          column.align === 'end' && 'justify-end',
                        )}
                        onClick={() => onSortChange!(nextSort(sort, column.id))}
                      >
                        {column.header}
                        <SortGlyph
                          direction={
                            sort?.columnId === column.id ? sort.direction : null
                          }
                        />
                        {/* `aria-sort` says where the column IS; nothing in
                            the platform says where a press takes it. */}
                        <span className="sr-only">
                          {sortActionLabel(sort, column.id, name)}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {error !== null && error !== undefined ? (
              <tr data-slot="data-table-message">
                <td colSpan={columnCount} className="px-3 py-8 text-center">
                  <div
                    role="alert"
                    className="flex flex-col items-center gap-2 text-sm text-destructive"
                  >
                    {error}
                    {onRetry ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onRetry}
                      >
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr data-slot="data-table-message">
                <td
                  colSpan={columnCount}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {empty ?? 'No results.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = rowKey(row);
                const isSelected = chosen.has(key);
                return (
                  <tr
                    key={key}
                    data-slot="data-table-row"
                    data-selected={isSelected || undefined}
                    aria-selected={selectable ? isSelected : undefined}
                    className={cn(
                      'border-b border-border last:border-b-0',
                      isSelected
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted',
                    )}
                  >
                    {selectable ? (
                      <td className={cn('w-px', cellPadding)}>
                        {/* See the head cell: the flex wrapper is what gives
                            the Base UI span a block formatting context. */}
                        <span className="flex items-center">
                          <Checkbox
                            checked={isSelected}
                            // Names the ROW, not the control. "Select" ×20 is
                            // a list of identical controls with no way to
                            // tell which row you are about to act on.
                            aria-label={`Select ${rowLabel ? rowLabel(row) : key}`}
                            data-slot="data-table-select-row"
                            onCheckedChange={() =>
                              onSelectionChange!(toggleKey(selected, key))
                            }
                          />
                        </span>
                      </td>
                    ) : null}
                    {columns.map((column) =>
                      column.id === headerColumnId ? (
                        <th
                          key={column.id}
                          scope="row"
                          data-slot="data-table-row-header"
                          className={cn(
                            'whitespace-nowrap text-start font-normal',
                            cellPadding,
                            column.className,
                          )}
                        >
                          {column.cell(row)}
                        </th>
                      ) : (
                        <td
                          key={column.id}
                          className={cn(
                            cellPadding,
                            column.align === 'end'
                              ? 'text-end tabular-nums'
                              : 'text-start',
                            column.className,
                          )}
                        >
                          {column.cell(row)}
                        </td>
                      ),
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {pagination ? <DataTablePager {...pagination} /> : null}
    </div>
  );
}

function SortGlyph({ direction }: { direction: 'asc' | 'desc' | null }) {
  // Direction is never colour-only: the glyph changes shape, and `aria-sort`
  // carries it for anyone not looking.
  const Icon =
    direction === 'asc'
      ? ArrowUpIcon
      : direction === 'desc'
        ? ArrowDownIcon
        : ChevronsUpDownIcon;
  return (
    <Icon
      aria-hidden
      data-slot="data-table-sort-glyph"
      data-direction={direction ?? 'none'}
      className={cn('size-3.5 shrink-0', direction === null && 'opacity-50')}
    />
  );
}

/**
 * The pager, wired to the Pagination primitive.
 *
 * Page-based, never infinite scroll (PAGINATION_PHILOSOPHY /
 * DATA_TABLE_PHILOSOPHY §4): page 3 has to be a place you can return to.
 * Every control is a real `<a href>`; `onPageChange` only intercepts the
 * click so a client router can take it.
 */
function DataTablePager({
  page,
  pageCount,
  href,
  onPageChange,
}: DataTablePaginationState) {
  const current = clampPage(page, pageCount);
  const hrefFor = (target: number) =>
    href?.(clampPage(target, pageCount)) ?? '#';

  const go = (target: number) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    const clamped = clampPage(target, pageCount);
    if (clamped === current && target !== current) {
      // Prev on page 1 / Next on the last page: the control is
      // `aria-disabled`, so it must also not navigate.
      event.preventDefault();
      return;
    }
    if (!onPageChange) return;
    event.preventDefault();
    onPageChange(clamped);
  };

  return (
    <Pagination>
      {/* gap-2, not the primitive's gap-1: `size-9` targets plus an 8px
          boundary gap keep axe's target-spacing math clear (WCAG 2.2 2.5.8). */}
      <PaginationContent className="gap-2">
        <PaginationItem>
          <PaginationPrevious
            href={hrefFor(current - 1)}
            onClick={go(current - 1)}
            aria-disabled={current === 1 || undefined}
          />
        </PaginationItem>
        {pageWindow(current, pageCount).map((value, index) =>
          value === null ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={value}>
              <PaginationLink
                href={hrefFor(value)}
                active={value === current}
                onClick={go(value)}
              >
                {value}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href={hrefFor(current + 1)}
            onClick={go(current + 1)}
            aria-disabled={current === pageCount || undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export {
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
} from './data-table-model.js';
export type {
  DataTableSort,
  PageSelectionState,
  SortDirection,
  SortValue,
} from './data-table-model.js';
