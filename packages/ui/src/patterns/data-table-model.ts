/**
 * @interlace/ui — DataTable, the parts with no JSX in them.
 *
 * Every decision a data table makes that is arithmetic rather than markup
 * lives here: what the next sort is, which rows a header checkbox owns, what
 * `aria-sort` should say, which page numbers the pager renders.
 *
 * ## Why a separate module
 *
 * These are the only parts of a table that can be *wrong* in a way a
 * screenshot will not show. A sort cycle that skips a state, a "select page"
 * checkbox that quietly drops the selections made on page 1, an ellipsis
 * window that renders `1 … 2` — each is a pure function of its inputs and
 * each shipped, historically, buried in a JSX callback where no test could
 * reach it. Anything below is exercised directly by
 * `__tests__/data-table-model.test.ts`; `data-table.tsx` holds no branch that
 * is not a render decision.
 *
 * Nothing here imports React. The module is safe on a server, in a worker, or
 * in a consumer's own URL-state layer — which matters, because the table
 * itself owns no state (see `data-table.tsx`) and the caller has to compute
 * exactly these values when it wires sort and selection to the query string.
 */

/** Sort direction. There is no third value — "unsorted" is `sort === null`. */
export type SortDirection = 'asc' | 'desc';

/**
 * The whole sort state of a table: one column, one direction.
 *
 * Multi-column sort is deliberately not modelled — see the note on
 * `nextSort`.
 */
export interface DataTableSort {
  /**
   * The column's `id`. This is the SORT KEY, not the display name — it is
   * what goes into `?sort=` and what a server-side query orders by, so it has
   * to survive a column being relabelled.
   */
  columnId: string;
  direction: SortDirection;
}

/**
 * Values a column can sort by. `sortRows` compares these; anything richer
 * (a struct, a locale-sensitive collation) is the caller's job to reduce to
 * one of these first.
 */
export type SortValue = string | number | boolean | Date | null | undefined;

/**
 * The sort a header click should produce, given what is sorted now.
 *
 * The cycle is **asc → desc → unsorted**, and clicking a different column
 * always starts that column at ascending rather than inheriting the previous
 * column's direction (inheriting reads as "the table re-sorted itself
 * backwards", which is exactly the surprise a table should not produce).
 *
 * The third state is the reason this is a function and not `!direction`.
 * Dropping back to unsorted is what returns the reader to the server's
 * natural order — usually "newest first", usually the order they wanted —
 * and a two-state toggle makes that order unreachable without a page reload.
 *
 * Multi-column sort (shift-click, `?sort=a,b&dir=asc,desc`) is described by
 * DATA_TABLE_PHILOSOPHY §2 as opt-in. It is not implemented: a second sort
 * key changes the URL contract, the header UI and the comparator all at once,
 * and shipping half of it would put a shift-click affordance on a table that
 * silently ignores it.
 */
export function nextSort(
  current: DataTableSort | null | undefined,
  columnId: string,
): DataTableSort | null {
  if (!current || current.columnId !== columnId) {
    return { columnId, direction: 'asc' };
  }
  if (current.direction === 'asc') return { columnId, direction: 'desc' };
  return null;
}

/**
 * The `aria-sort` value for a column header.
 *
 * Every sortable column gets one — `'none'` on the inactive ones — because
 * the attribute is also how a screen reader knows the column is sortable at
 * all. Non-sortable columns pass `undefined` and render no attribute.
 */
export function ariaSortOf(
  current: DataTableSort | null | undefined,
  columnId: string,
): 'ascending' | 'descending' | 'none' {
  if (!current || current.columnId !== columnId) return 'none';
  return current.direction === 'asc' ? 'ascending' : 'descending';
}

/**
 * What activating this header will do next, as a sentence.
 *
 * Rendered `sr-only` inside the sort button. `aria-sort` announces the state
 * the column is IN; nothing in the platform announces the state a press will
 * move it TO, and a control whose effect is unannounced is a control you have
 * to click to discover.
 */
export function sortActionLabel(
  current: DataTableSort | null | undefined,
  columnId: string,
  columnName: string,
): string {
  const next = nextSort(current, columnId);
  if (next === null) return `Remove sorting from ${columnName}`;
  return `Sort by ${columnName}, ${next.direction === 'asc' ? 'ascending' : 'descending'}`;
}

/**
 * Sort rows locally.
 *
 * The table never calls this — it renders `rows` in the order it was given,
 * because at any real scale the sort belongs to the query that fetched them
 * (DATA_TABLE_PHILOSOPHY §10: client-only sort above ~1,000 rows is
 * forbidden). It is exported for the small-table case, where the caller holds
 * the whole array in memory and would otherwise write this by hand — badly:
 * `Array#sort` is comparison-based, so the naive `a - b` on mixed
 * null/string/number data throws or produces an order that changes between
 * runs.
 *
 * Stable: equal values keep their input order, via an index tiebreak.
 * `null` / `undefined` sort last in BOTH directions — a missing value is not
 * "small", and flipping the direction should not march the blanks to the top.
 */
export function sortRows<Row>(
  rows: readonly Row[],
  sort: DataTableSort | null | undefined,
  getValue: (row: Row, columnId: string) => SortValue,
): Row[] {
  if (!sort) return [...rows];
  const sign = sort.direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const left = getValue(a.row, sort.columnId);
      const right = getValue(b.row, sort.columnId);
      const leftBlank = left === null || left === undefined;
      const rightBlank = right === null || right === undefined;
      // Resolved BEFORE `sign` is applied: a missing value is not "small",
      // and reversing the sort should not march every blank to the top.
      if (leftBlank !== rightBlank) return leftBlank ? 1 : -1;
      const delta = compareValues(left, right);
      return delta !== 0 ? delta * sign : a.index - b.index;
    })
    .map((entry) => entry.row);
}

/**
 * Ascending comparison across the `SortValue` union.
 *
 * Blanks last (returned unsigned so `sortRows` does not flip them), numbers
 * and dates numerically, everything else through `localeCompare` with
 * `numeric` so `item-2` precedes `item-10`.
 */
export function compareValues(a: SortValue, b: SortValue): number {
  const aBlank = a === null || a === undefined;
  const bBlank = b === null || b === undefined;
  if (aBlank && bBlank) return 0;
  // Not multiplied by `sign` in sortRows — see the note there.
  if (aBlank) return 1;
  if (bBlank) return -1;

  const left = a instanceof Date ? a.getTime() : a;
  const right = b instanceof Date ? b.getTime() : b;

  if (typeof left === 'number' && typeof right === 'number') {
    return left === right ? 0 : left < right ? -1 : 1;
  }
  if (typeof left === 'boolean' || typeof right === 'boolean') {
    return Number(left) - Number(right);
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/** Header-checkbox state for the rows currently on screen. */
export type PageSelectionState = 'none' | 'some' | 'all';

/**
 * How much of the current page is selected.
 *
 * `'some'` drives the checkbox's indeterminate state. An empty page is
 * `'none'`, never `'all'` — `every()` over an empty array is `true`, which is
 * how a header checkbox on an empty table ends up rendering as checked.
 */
export function pageSelectionState(
  pageKeys: readonly string[],
  selected: readonly string[],
): PageSelectionState {
  if (pageKeys.length === 0) return 'none';
  const chosen = new Set(selected);
  let hits = 0;
  for (const key of pageKeys) if (chosen.has(key)) hits += 1;
  if (hits === 0) return 'none';
  return hits === pageKeys.length ? 'all' : 'some';
}

/**
 * Add or remove one row key, preserving order of the rest.
 *
 * Keyed by row ID, never by index — DATA_TABLE_PHILOSOPHY §5's selection
 * test is exactly the index-keyed bug: sort or paginate and index 3 is a
 * different row, so the checkmarks stay put while the selection underneath
 * them silently changes rows.
 */
export function toggleKey(
  selected: readonly string[],
  key: string,
): string[] {
  return selected.includes(key)
    ? selected.filter((entry) => entry !== key)
    : [...selected, key];
}

/**
 * Select or clear every row on the current page, leaving selections made on
 * OTHER pages untouched.
 *
 * That last clause is the whole point. "Select page" that replaces the
 * selection array is how selections vanish when the reader pages back — the
 * failure DATA_TABLE_PHILOSOPHY §5 names, and the one nobody notices until a
 * bulk action runs on a third of the rows they thought they had picked.
 *
 * Partial (`'some'`) promotes to all, matching the checkbox's own
 * indeterminate → checked semantics.
 */
export function togglePageSelection(
  selected: readonly string[],
  pageKeys: readonly string[],
): string[] {
  const state = pageSelectionState(pageKeys, selected);
  if (state === 'all') {
    const onPage = new Set(pageKeys);
    return selected.filter((key) => !onPage.has(key));
  }
  const chosen = new Set(selected);
  return [...selected, ...pageKeys.filter((key) => !chosen.has(key))];
}

/**
 * The live-region sentence for the current selection.
 *
 * Empty string when nothing is selected, so the region can be rendered
 * unconditionally: an `aria-live` element that only appears once there is
 * something to say is inserted and announced in the same tick, which most
 * screen readers drop.
 *
 * Deliberately no "of N": the selection spans pages and the page only knows
 * its own row count, so "1 of 3 rows selected" over a 3-row page reads as
 * "one of these three" when the selected row may be two pages away. A bare
 * count is the only number the table can honestly report.
 */
export function selectionMessage(count: number): string {
  if (count <= 0) return '';
  return `${count} ${count === 1 ? 'row' : 'rows'} selected`;
}

/**
 * The page numbers a pager should render, with `null` for each elided run.
 *
 * First and last are always present (they are the two destinations a reader
 * actually aims for), plus `siblings` pages either side of the current one.
 * A gap of exactly one page is filled rather than eliding it — `1 … 3` and
 * `1 2 3` cost the same width, and the ellipsis is a lie about how much was
 * hidden.
 */
export function pageWindow(
  page: number,
  pageCount: number,
  siblings = 1,
): (number | null)[] {
  if (pageCount <= 0) return [];
  const current = clampPage(page, pageCount);
  const shown = new Set<number>([1, pageCount]);
  for (let offset = -siblings; offset <= siblings; offset += 1) {
    const candidate = current + offset;
    if (candidate >= 1 && candidate <= pageCount) shown.add(candidate);
  }

  const out: (number | null)[] = [];
  let previous = 0;
  for (const value of [...shown].sort((a, b) => a - b)) {
    // A gap of exactly one page is filled, not elided: `1 … 3` and `1 2 3`
    // cost the same width, and the ellipsis claims more was hidden than was.
    if (value - previous === 2 && previous !== 0) out.push(previous + 1);
    else if (value - previous > 1) out.push(null);
    out.push(value);
    previous = value;
  }
  return out;
}

/** Keep a page number inside `1..pageCount`. */
export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), Math.max(pageCount, 1));
}

/**
 * The plain-text name of a column, for the strings assistive tech reads.
 *
 * A column header is a `ReactNode` — it can be an icon, a badge, a wrapped
 * two-line label — and none of that can be concatenated into "Sort by …".
 * `name` is the escape hatch; a string header is used as-is; the `id` is the
 * last resort, and it is at least a word the caller chose.
 */
export function columnName(column: {
  id: string;
  header?: unknown;
  name?: string;
}): string {
  if (column.name) return column.name;
  return typeof column.header === 'string' ? column.header : column.id;
}
