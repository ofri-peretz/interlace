/**
 * charts/scale — the arithmetic behind every visualisation.
 *
 * This is the file the 100% coverage gate is really about. The SVG above it is
 * checked by stories and axe; the numbers are checked here, because a chart
 * that draws a beautiful wrong line is worse than one that fails to render.
 *
 * Each block names the failure it prevents, not the function it calls.
 */

import { describe, expect, it } from 'vitest';

import {
  areaPath,
  compact,
  day,
  delta,
  describeSeries,
  linePath,
  nearestIndex,
  numeric,
  seriesScales,
  ticks,
  type Point,
} from '../src/charts/scale.js';

const series = (...values: (number | null)[]): Point[] =>
  values.map((v, i) => ({ t: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00Z`, v }));

describe('numeric — a gap is not a zero', () => {
  it('drops nulls rather than coercing them', () => {
    expect(numeric(series(1, null, 3))).toEqual([
      { t: '2026-08-01T00:00:00Z', v: 1 },
      { t: '2026-08-03T00:00:00Z', v: 3 },
    ]);
  });

  it('drops NaN and Infinity — a divide-by-zero upstream must not become a plotted point', () => {
    const poisoned: Point[] = [
      { t: 'a', v: Number.NaN },
      { t: 'b', v: Number.POSITIVE_INFINITY },
      { t: 'c', v: 2 },
    ];
    expect(numeric(poisoned)).toEqual([{ t: 'c', v: 2 }]);
  });

  it('returns empty for an empty series', () => {
    expect(numeric([])).toEqual([]);
  });
});

describe('seriesScales', () => {
  it('spreads points across the full width', () => {
    const s = seriesScales(series(0, 5, 10), 100, 50);
    expect(s.x(0)).toBe(0);
    expect(s.x(2)).toBe(100);
    expect(s.min).toBe(0);
    expect(s.max).toBe(10);
  });

  it('centres a single point instead of pinning it to x=0', () => {
    // Pinned at 0 it reads as the start of a line that never drew.
    const s = seriesScales(series(7), 100, 50);
    expect(s.x(0)).toBe(50);
  });

  it('centres a flat series instead of pinning it to the top edge', () => {
    // The bug this prevents: span=0 → clamp to 1 → every value maps to max →
    // a metric that never moved renders as a metric at its ceiling.
    const s = seriesScales(series(4, 4, 4), 100, 50);
    expect(s.y(4)).toBe(25);
  });

  it('maps min to the bottom and max to the top (SVG y grows downward)', () => {
    const s = seriesScales(series(0, 10), 100, 50, 5);
    expect(s.y(0)).toBeGreaterThan(s.y(10));
    expect(s.y(10)).toBe(5);
  });

  it('reports a zero domain for an empty series rather than ±Infinity', () => {
    // Math.min() of nothing is Infinity, which poisons every downstream label.
    const s = seriesScales([], 100, 50);
    expect(s.min).toBe(0);
    expect(s.max).toBe(0);
    expect(s.points).toEqual([]);
  });
});

describe('linePath / areaPath', () => {
  it('emits a move-then-lines path', () => {
    expect(linePath(seriesScales(series(0, 10), 100, 50, 0))).toBe('M0,50L100,0');
  });

  it('returns empty string below two points — callers branch on falsy, not length', () => {
    expect(linePath(seriesScales(series(1), 100, 50))).toBe('');
    expect(linePath(seriesScales([], 100, 50))).toBe('');
    expect(areaPath(seriesScales(series(1), 100, 50), 50)).toBe('');
  });

  it('closes the area down to the baseline', () => {
    const s = seriesScales(series(0, 10), 100, 50, 0);
    expect(areaPath(s, 50)).toBe('M0,50L100,0L100,50L0,50Z');
  });
});

describe('delta', () => {
  it('needs two points to compare', () => {
    expect(delta(series(1))).toBeNull();
    expect(delta([])).toBeNull();
  });

  it('reports absolute and percentage change', () => {
    expect(delta(series(100, 150))).toEqual({
      from: 100,
      to: 150,
      abs: 50,
      pct: 50,
      direction: 'up',
    });
  });

  it('returns null percent from a zero baseline — not Infinity', () => {
    // "+Infinity%" on a dashboard is how a metric that started at 0 gets
    // reported as an achievement.
    expect(delta(series(0, 10))?.pct).toBeNull();
  });

  it('measures percentage against the magnitude of a negative baseline', () => {
    const d = delta(series(-100, -50));
    expect(d).toMatchObject({ abs: 50, pct: 50, direction: 'up' });
  });

  it('calls no movement flat rather than up', () => {
    expect(delta(series(5, 5))?.direction).toBe('flat');
  });

  it('reports a decrease as down', () => {
    expect(delta(series(10, 4))).toMatchObject({ abs: -6, direction: 'down' });
  });
});

describe('day', () => {
  it('truncates an ISO instant to its date', () => {
    expect(day('2026-08-09T13:45:00.000Z')).toBe('2026-08-09');
  });
});

describe('describeSeries — the sentence that replaces the picture', () => {
  it('says so when there is no data', () => {
    expect(describeSeries([], 'Views')).toBe('Views: no data');
  });

  it('falls back to a generic name', () => {
    expect(describeSeries([])).toBe('Series: no data');
  });

  it('describes a single observation without claiming a trend', () => {
    expect(describeSeries(series(42), 'Views')).toBe(
      'Views: a single value, 42, on 2026-08-01',
    );
  });

  it('names the range, the endpoints and the direction', () => {
    const text = describeSeries(series(100, 120, 150), 'Views');
    expect(text).toContain('3 points from 2026-08-01 to 2026-08-03');
    expect(text).toContain('100 to 150');
    expect(text).toContain('up 50 (50.0%)');
  });

  it('says "unchanged" rather than "up 0"', () => {
    expect(describeSeries(series(7, 7), 'Views')).toContain('unchanged');
  });

  it('omits the percentage when the baseline is zero', () => {
    const text = describeSeries(series(0, 5), 'Views');
    expect(text).toContain('up 5.');
    expect(text).not.toContain('%');
  });

  it('describes a decline as down', () => {
    expect(describeSeries(series(10, 2), 'Errors')).toContain('down 8');
  });
});

describe('ticks — label the data, not a textbook scale', () => {
  it('spans the observed domain, not a rounded-out one', () => {
    // Rounding 3,412→3,588 out to 0–4,000 flattens the only thing the reader
    // came for.
    expect(ticks(seriesScales(series(3412, 3588), 100, 50), 3)).toEqual([3412, 3500, 3588]);
  });

  it('collapses to one tick for a flat series', () => {
    expect(ticks(seriesScales(series(5, 5), 100, 50))).toEqual([5]);
  });

  it('returns none for an empty series or a nonsensical count', () => {
    expect(ticks(seriesScales([], 100, 50))).toEqual([]);
    expect(ticks(seriesScales(series(1, 2), 100, 50), 1)).toEqual([]);
  });
});

describe('nearestIndex — one answer for pointer and keyboard alike', () => {
  const s = seriesScales(series(1, 2, 3, 4, 5), 100, 50);

  it('rounds to the closest point', () => {
    expect(nearestIndex(s, 0, 100)).toBe(0);
    expect(nearestIndex(s, 50, 100)).toBe(2);
    expect(nearestIndex(s, 100, 100)).toBe(4);
  });

  it('clamps outside the plot instead of returning an out-of-range index', () => {
    expect(nearestIndex(s, -40, 100)).toBe(0);
    expect(nearestIndex(s, 400, 100)).toBe(4);
  });

  it('returns 0 for a zero-width container — a chart in a display:none parent', () => {
    expect(nearestIndex(s, 10, 0)).toBe(0);
  });

  it('returns 0 when there is at most one point', () => {
    expect(nearestIndex(seriesScales(series(1), 100, 50), 90, 100)).toBe(0);
  });
});

describe('compact', () => {
  it('abbreviates at each magnitude', () => {
    expect(compact(999)).toBe('999');
    expect(compact(12_400)).toBe('12.4k');
    expect(compact(3_100_000)).toBe('3.1M');
    expect(compact(2_000_000_000)).toBe('2.0B');
  });

  it('abbreviates negatives by magnitude, keeping the sign', () => {
    expect(compact(-12_400)).toBe('-12.4k');
  });
});
