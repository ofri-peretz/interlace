/**
 * @interlace/ui — quadrant-model
 *
 * Where a room sits on two questions at once: a 2 x 2 grid ("how hard /
 * how important", "how much I knew / how much I care"). Everyone places one
 * dot; `x` runs 0 (the start pole) to 100 (the end pole), `y` runs 0 (the
 * bottom pole) to 100 (the top pole). Pure, so a server, a screen and a
 * recap page draw the same picture.
 *
 * `summarizeQuadrant` counts dots per quarter, bins them into a square grid
 * of cells for a density picture, and finds the room's middle (the median
 * on each axis) and the mean. `quadrantShift` says how far the middle moved
 * between two rounds. A dot that is not two finite numbers is dropped;
 * anything off the grid is pulled to its edge.
 */

export interface QuadPoint {
  x: number;
  y: number;
}

export type Quarter = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

/** Reading order: top row first, start before end. */
export const QUARTERS: readonly Quarter[] = ['top-start', 'top-end', 'bottom-start', 'bottom-end'];

export interface QuadrantSummary {
  count: number;
  quarters: Record<Quarter, number>;
  /** The quarter with the most dots, or null when two or more tie (or none). */
  most: Quarter | null;
  /** Dots per cell, row by row from the top, start to end. */
  cells: number[][];
  /** The most dots in any one cell. */
  peak: number;
  mean: QuadPoint | null;
  median: QuadPoint | null;
}

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** Drops dots that are not two finite numbers and pulls the rest onto the grid. */
export function cleanPoints(points: readonly QuadPoint[]): QuadPoint[] {
  return points
    .filter((p) => p != null && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ x: clamp(p.x), y: clamp(p.y) }));
}

/** The quarter a dot is in; the centre lines belong to the end and top halves. */
export function quarterOf(p: QuadPoint): Quarter {
  return `${p.y >= 50 ? 'top' : 'bottom'}-${p.x >= 50 ? 'end' : 'start'}` as Quarter;
}

function median(sorted: readonly number[]): number {
  const mid = (sorted.length - 1) / 2;
  return ((sorted[Math.floor(mid)] as number) + (sorted[Math.ceil(mid)] as number)) / 2;
}

/** The cell a dot falls in, as [row from the top, column from the start]. */
export function cellOf(p: QuadPoint, cells = 10): [number, number] {
  const n = Math.max(1, Math.floor(cells));
  const col = Math.min(n - 1, Math.floor((clamp(p.x) / 100) * n));
  const rowFromBottom = Math.min(n - 1, Math.floor((clamp(p.y) / 100) * n));
  return [n - 1 - rowFromBottom, col];
}

export function summarizeQuadrant(points: readonly QuadPoint[], options: { cells?: number } = {}): QuadrantSummary {
  const n = Math.max(1, Math.floor(options.cells ?? 10));
  const clean = cleanPoints(points);
  const quarters: Record<Quarter, number> = { 'top-start': 0, 'top-end': 0, 'bottom-start': 0, 'bottom-end': 0 };
  const cells = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
  for (const p of clean) {
    quarters[quarterOf(p)] += 1;
    const [r, c] = cellOf(p, n);
    (cells[r] as number[])[c] = ((cells[r] as number[])[c] as number) + 1;
  }
  const top = Math.max(...QUARTERS.map((q) => quarters[q]));
  const leaders = QUARTERS.filter((q) => quarters[q] === top);
  const most = top > 0 && leaders.length === 1 ? (leaders[0] as Quarter) : null;
  if (clean.length === 0) return { count: 0, quarters, most, cells, peak: 0, mean: null, median: null };
  const xs = clean.map((p) => p.x).sort((a, b) => a - b);
  const ys = clean.map((p) => p.y).sort((a, b) => a - b);
  return {
    count: clean.length,
    quarters,
    most,
    cells,
    peak: Math.max(...cells.flat()),
    mean: { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length },
    median: { x: median(xs), y: median(ys) },
  };
}

/** How far the room's middle moved from `before` to `after`, or null when either is empty. */
export function quadrantShift(before: readonly QuadPoint[], after: readonly QuadPoint[]): QuadPoint | null {
  const a = summarizeQuadrant(before).median;
  const b = summarizeQuadrant(after).median;
  return a === null || b === null ? null : { x: b.x - a.x, y: b.y - a.y };
}

/** A dot moved by a key: arrows by `step`, never off the grid. `dir` flips start and end. */
export function nudgePoint(p: QuadPoint, key: string, step = 5, dir: 'ltr' | 'rtl' = 'ltr'): QuadPoint | null {
  const flip = dir === 'rtl' ? -1 : 1;
  switch (key) {
    case 'ArrowRight':
      return { x: clamp(p.x + step * flip), y: p.y };
    case 'ArrowLeft':
      return { x: clamp(p.x - step * flip), y: p.y };
    case 'ArrowUp':
      return { x: p.x, y: clamp(p.y + step) };
    case 'ArrowDown':
      return { x: p.x, y: clamp(p.y - step) };
    case 'Home':
      return { x: 0, y: p.y };
    case 'End':
      return { x: 100, y: p.y };
    case 'PageUp':
      return { x: p.x, y: 100 };
    case 'PageDown':
      return { x: p.x, y: 0 };
    default:
      return null;
  }
}
