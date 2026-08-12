---
'@interlace/ui': minor
---

New `DataTable` pattern — a real `<table>` with column definitions, sorting,
row selection, pagination, and designed loading / empty / error states.

Sort and selection are the caller's state (`sort` / `onSortChange`,
`selected` / `onSelectionChange`), so the whole view can live in the query
string and a sorted, paged, partly-selected table can be linked to a
colleague. Selection is keyed by row id, so it survives sorting and paging.
Semantics are the point: `<caption>`, `<th scope="col">`, one
`<th scope="row">` per row, `aria-sort` on sortable headers, and a selection
checkbox whose accessible name identifies the row. Pure logic (sort cycle,
comparators, page-window, selection maths) ships alongside as
`data-table-model` and is exported for callers wiring their own URL state.

Skeleton gains a `data-table` variant — a header row plus body rows, so the
loading state reserves the real silhouette instead of collapsing to a spinner.

Not included, deliberately: filtering UI, column resize/reorder,
virtualization, grouping.

Components: data-table, skeleton
