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
  axisSlots,
  bandScales,
  compact,
  day,
  delta,
  describeDistribution,
  describeSeries,
  keepAtNarrow,
  linePath,
  nearestIndex,
  nearestSlot,
  numeric,
  peakBin,
  plotScales,
  seriesScales,
  slotAt,
  stepPath,
  ticks,
  type Bin,
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

describe('plotScales — two series, one truth', () => {
  const a = series(10, 20, 30);
  const late: Point[] = [
    { t: '2026-08-03T00:00:00Z', v: 100 },
    { t: '2026-08-04T00:00:00Z', v: 200 },
  ];

  it('takes the UNION of days as the axis, not the first series\' days', () => {
    // "Series 0 owns the axis" is one line cheaper and silently drops every
    // reading the others took on a day it missed — from the picture only, so
    // the data table beside it would still list them.
    const plot = plotScales([a, late], 100, 50);
    expect(plot.keys).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']);
  });

  it('sorts the union, so two series added in either order draw identically', () => {
    expect(plotScales([late, a], 100, 50).keys).toEqual(
      plotScales([a, late], 100, 50).keys,
    );
  });

  it('puts every series on ONE y domain, so the two lines are comparable', () => {
    const plot = plotScales([a, late], 100, 50);
    expect([plot.min, plot.max]).toEqual([10, 200]);
    // The per-series projectors report the SHARED domain, not their own — a
    // series that quietly rescaled itself is a second y axis in disguise.
    expect(plot.series.map((s) => [s.min, s.max])).toEqual([
      [10, 200],
      [10, 200],
    ]);
    expect(plot.series[0].y(200)).toBe(plot.series[1].y(200));
  });

  it('positions a series by its DAY, not by its index in its own array', () => {
    // `late` has two points; index-based x would draw them at the far left and
    // far right of a four-day axis instead of in the last two slots.
    const plot = plotScales([a, late], 90, 50);
    expect(plot.series[1].x(0)).toBe(plot.x(2));
    expect(plot.series[1].x(1)).toBe(plot.x(3));
  });

  it('gives a series no vertex on a day it did not measure', () => {
    const plot = plotScales([a, late], 100, 50);
    expect(plot.series[1].points.map((p) => p.t)).toEqual(['2026-08-03', '2026-08-04']);
  });

  it('reports null for a day a series has no reading, so nothing is invented', () => {
    const plot = plotScales([a, late], 100, 50);
    expect(plot.at(1, 0)).toBeNull();
    expect(plot.at(1, 3)).toBe(200);
  });

  it('reports null past the end of the axis rather than throwing', () => {
    const plot = plotScales([a], 100, 50);
    expect(plot.at(0, 99)).toBeNull();
  });

  it('collapses two readings on one day the way SeriesTable does — last wins', () => {
    // Chart and table must not report a different number for the same date.
    const twice: Point[] = [
      { t: '2026-08-01T01:00:00Z', v: 5 },
      { t: '2026-08-01T23:00:00Z', v: 9 },
      { t: '2026-08-02T00:00:00Z', v: 12 },
    ];
    const plot = plotScales([twice], 100, 50);
    expect(plot.keys).toEqual(['2026-08-01', '2026-08-02']);
    expect(plot.at(0, 0)).toBe(9);
  });

  it('drops nulls before they can widen the domain to zero', () => {
    const plot = plotScales([series(5, null, 15)], 100, 50);
    expect([plot.min, plot.max]).toEqual([5, 15]);
    expect(plot.keys).toEqual(['2026-08-01', '2026-08-03']);
  });

  it('centres a flat set instead of pinning it to the ceiling', () => {
    const plot = plotScales([series(7, 7, 7)], 100, 50);
    expect(plot.y(7)).toBe(25);
  });

  it('centres a single shared slot rather than starting a line at x=0', () => {
    const plot = plotScales([series(4)], 100, 50);
    expect(plot.x(0)).toBe(50);
  });

  it('survives having no data at all, so an empty chart does not throw', () => {
    const plot = plotScales([[]], 100, 50);
    expect(plot.keys).toEqual([]);
    expect([plot.min, plot.max]).toEqual([0, 0]);
    expect(plot.series[0].points).toEqual([]);
  });

  it('feeds `linePath` unchanged — the multi-series case needs no second path builder', () => {
    const plot = plotScales([a, late], 90, 50);
    expect(linePath(plot.series[1])).toBe(
      `M${plot.x(2)},${plot.y(100)}L${plot.x(3)},${plot.y(200)}`,
    );
  });

  it('feeds `ticks` through its slot keys, so both axes come from one function', () => {
    const plot = plotScales([a, late], 100, 50);
    expect(ticks({ points: plot.keys, min: plot.min, max: plot.max }, 3)).toEqual([10, 105, 200]);
  });
});

describe('axisSlots — an x label per slot would collide long before it ran out', () => {
  it('spaces labels evenly across a long series', () => {
    expect(axisSlots(14)).toEqual([0, 3, 7, 10, 13]);
  });

  it('always includes both ends, so the reader can see the range', () => {
    const slots = axisSlots(40);
    expect(slots[0]).toBe(0);
    expect(slots[slots.length - 1]).toBe(39);
  });

  it('labels every slot when the series is shorter than the budget', () => {
    expect(axisSlots(3)).toEqual([0, 1, 2]);
    expect(axisSlots(5)).toEqual([0, 1, 2, 3, 4]);
  });

  it('never repeats a slot, which would render two labels on one tick', () => {
    for (let count = 1; count <= 30; count += 1) {
      const slots = axisSlots(count);
      expect(new Set(slots).size).toBe(slots.length);
    }
  });

  it('returns a single slot for a single observation', () => {
    expect(axisSlots(1)).toEqual([0]);
  });

  it('returns nothing for an empty axis rather than a label pointing at nothing', () => {
    expect(axisSlots(0)).toEqual([]);
    expect(axisSlots(-3)).toEqual([]);
  });

  it('degrades to one label rather than dividing by zero on a budget of one', () => {
    expect(axisSlots(20, 1)).toEqual([0]);
  });

  it('honours a caller-supplied budget', () => {
    expect(axisSlots(21, 3)).toEqual([0, 10, 20]);
  });
});

describe('nearestSlot — the arithmetic both crosshairs share', () => {
  it('rounds to the closest slot', () => {
    expect(nearestSlot(5, 0, 100)).toBe(0);
    expect(nearestSlot(5, 50, 100)).toBe(2);
    expect(nearestSlot(5, 100, 100)).toBe(4);
  });

  it('clamps outside the plot instead of returning an out-of-range slot', () => {
    expect(nearestSlot(5, -40, 100)).toBe(0);
    expect(nearestSlot(5, 400, 100)).toBe(4);
  });

  it('returns 0 for a zero-width container', () => {
    expect(nearestSlot(5, 10, 0)).toBe(0);
  });

  it('returns 0 for an axis with at most one slot', () => {
    expect(nearestSlot(1, 90, 100)).toBe(0);
    expect(nearestSlot(0, 90, 100)).toBe(0);
  });

  it('agrees with `nearestIndex` at every x, which is why one delegates to the other', () => {
    // Two roundings of the same boundary is how a mouse user and a keyboard
    // user end up reading different points.
    const s = seriesScales(series(1, 2, 3, 4, 5), 100, 50);
    for (let x = -20; x <= 120; x += 1) {
      expect(nearestIndex(s, x, 100)).toBe(nearestSlot(s.points.length, x, 100));
    }
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

/* ── The categorical half: bins, not instants ───────────────────────────── */

const bins = (...values: (number | null)[]): Bin[] =>
  values.map((v, i) => ({ label: `b${i}`, v }));

describe('keepAtNarrow — which labels survive the 320 floor', () => {
  it('always keeps both ends, because the ends are the range', () => {
    expect(keepAtNarrow(0, 5)).toBe(true);
    expect(keepAtNarrow(4, 5)).toBe(true);
  });

  it('keeps the midpoint only when there is an exact one', () => {
    expect(keepAtNarrow(2, 5)).toBe(true);
    // Four labels have no exact middle — 1.5 is nobody's index.
    expect(keepAtNarrow(1, 4)).toBe(false);
    expect(keepAtNarrow(2, 4)).toBe(false);
  });

  it('drops the labels between the ends and the middle', () => {
    expect(keepAtNarrow(1, 5)).toBe(false);
    expect(keepAtNarrow(3, 5)).toBe(false);
  });
});

describe('bandScales — a bar axis cannot be truncated', () => {
  it('anchors the domain at zero even when nothing observed is near it', () => {
    // The whole difference from `seriesScales`. On an axis starting at 3,412 a
    // bar twice as long is a value 2.5% larger, which is the oldest chart lie.
    const scales = bandScales([[3_412, 3_588]], 100, 50);
    expect(scales.min).toBe(0);
    expect(scales.max).toBe(3_588);
  });

  it('widens downward for a negative value rather than clamping it away', () => {
    // A clamp renders −40 and −4,000 as the same empty slot.
    const scales = bandScales([[-40, 10]], 100, 50);
    expect(scales.min).toBe(-40);
    expect(scales.max).toBe(10);
    expect(scales.y(-40)).toBeGreaterThan(scales.zero);
  });

  it('shares ONE domain across every series handed to it', () => {
    const scales = bandScales([[1, 2], [90, 100]], 100, 50);
    expect(scales.max).toBe(100);
  });

  it('splits the width into one band per bin, and centres a mark inside it', () => {
    const scales = bandScales([[1, 2, 3, 4]], 100, 50);
    expect(scales.band).toBe(25);
    expect(scales.x(0)).toBe(0);
    expect(scales.x(2)).toBe(50);
    expect(scales.centre(0)).toBe(12.5);
  });

  it('takes the band count from the LONGEST series, so a short one cannot shrink the axis', () => {
    expect(bandScales([[1, 2], [1, 2, 3, 4]], 100, 50).band).toBe(25);
  });

  it('hands back a usable band for an empty distribution instead of dividing by zero', () => {
    const scales = bandScales([], 100, 50);
    expect(scales.band).toBe(100);
    expect(Number.isFinite(scales.band)).toBe(true);
    expect(scales.min).toBe(0);
    expect(scales.max).toBe(0);
  });

  it('rests an all-zero distribution ON the baseline rather than centring it', () => {
    // `seriesScales` centres a flat line, which is right for a line and wrong
    // here: a floating baseline is a zero drawn in mid-air.
    const scales = bandScales([[0, 0, 0]], 100, 50, 4);
    expect(scales.y(0)).toBe(46);
    expect(scales.zero).toBe(46);
  });

  it('ignores a null or a NaN when deriving the domain', () => {
    const scales = bandScales([[10, null, Number.NaN]], 100, 50);
    expect(scales.max).toBe(10);
  });

  it('puts the largest value at the top of the box and zero at the bottom', () => {
    const scales = bandScales([[0, 100]], 100, 50, 4);
    expect(scales.y(100)).toBe(4);
    expect(scales.zero).toBe(46);
  });
});

describe('peakBin — where a distribution peaks', () => {
  it('finds the largest measured bin', () => {
    expect(peakBin([1, 9, 4])).toBe(1);
  });

  it('returns null when nothing was measured, instead of naming bin 0', () => {
    // The bug this replaces: `Math.max(1, ...values)` invents a denominator of
    // 1 and reports bin 0 as the peak of a distribution that has no peak.
    expect(peakBin([null, null])).toBeNull();
    expect(peakBin([])).toBeNull();
  });

  it('skips gaps and non-finite readings', () => {
    expect(peakBin([null, 3, Number.NaN, 7])).toBe(3);
  });

  it('gives a tie to the earliest bin, so the answer is stable', () => {
    expect(peakBin([5, 5, 5])).toBe(0);
  });

  it('counts a measured zero as a peak when it is all there is', () => {
    // Zero is a measurement. "No peak" is reserved for "nothing was measured".
    expect(peakBin([0, 0])).toBe(0);
  });
});

describe('stepPath — flat over each band, never sloped between them', () => {
  it('draws a horizontal run across every band', () => {
    const scales = bandScales([[0, 10]], 100, 50, 0);
    // One `M`: the run is continuous, and the change between two bands is a
    // VERTICAL at the boundary rather than a slope across it.
    expect(stepPath([0, 10], scales)).toBe('M0,50L50,50L50,0L100,0');
  });

  it('joins consecutive bands with a vertical, not a diagonal', () => {
    // A diagonal claims the quantity passed through every value in between.
    // Between two hourly aggregates there is nothing to pass through.
    const path = stepPath([10, 10], bandScales([[0, 10]], 100, 50, 0));
    expect(path).toContain('L');
    expect(path.match(/M/g)).toHaveLength(1);
  });

  it('BREAKS at an unmeasured bin rather than bridging it', () => {
    const path = stepPath([1, null, 1], bandScales([[0, 1]], 90, 50, 0));
    expect(path.match(/M/g)).toHaveLength(2);
  });

  it('treats a non-finite reading as a gap, like every other scale here', () => {
    const path = stepPath([1, Number.NaN, 1], bandScales([[0, 1]], 90, 50, 0));
    expect(path.match(/M/g)).toHaveLength(2);
  });

  it('draws nothing at all when nothing was measured', () => {
    expect(stepPath([null, null], bandScales([[]], 90, 50))).toBe('');
  });
});

describe('slotAt — a bar owns its whole band', () => {
  it('returns the band the position falls INSIDE, not the nearest centre', () => {
    // Rounding would hand the right-hand third of every bar to its neighbour.
    expect(slotAt(4, 0, 100)).toBe(0);
    expect(slotAt(4, 24, 100)).toBe(0);
    expect(slotAt(4, 26, 100)).toBe(1);
    expect(slotAt(4, 99, 100)).toBe(3);
  });

  it('clamps outside the plot instead of returning a bin that is not there', () => {
    expect(slotAt(4, -50, 100)).toBe(0);
    expect(slotAt(4, 400, 100)).toBe(3);
  });

  it('survives a collapsed container without dividing by zero', () => {
    expect(slotAt(4, 10, 0)).toBe(0);
  });

  it('returns 0 for an axis with at most one bin', () => {
    expect(slotAt(1, 90, 100)).toBe(0);
    expect(slotAt(0, 90, 100)).toBe(0);
  });
});

describe('describeDistribution — the sentence that replaces the picture', () => {
  it('reports the total, the peak, and nothing about direction', () => {
    // A distribution has nowhere to go. "Down 40% from 00:00 to 23:00" is
    // arithmetic performed on a circle.
    expect(describeDistribution(bins(1, 5, 2), 'Reading', 'views')).toBe(
      'Reading: 3 bins, 8 views in total, highest in b1 at 5 views.',
    );
  });

  it('counts the unmeasured bins out loud, because the hatch is invisible to a listener', () => {
    expect(describeDistribution(bins(1, null, 2))).toContain('1 bin not measured');
  });

  it('pluralises the gap count', () => {
    expect(describeDistribution(bins(1, null, null))).toContain('2 bins not measured');
  });

  it('says "no data" when not one bin was measured', () => {
    expect(describeDistribution(bins(null, null), 'Reading')).toBe('Reading: no data');
    expect(describeDistribution([])).toBe('Distribution: no data');
  });

  it('names an unlabelled distribution rather than starting mid-sentence', () => {
    expect(describeDistribution(bins(1, 2))).toContain('Distribution:');
  });

  it('omits the unit noun when there is none, rather than printing "undefined"', () => {
    expect(describeDistribution(bins(1, 2), 'Reading')).toBe(
      'Reading: 2 bins, 3 in total, highest in b1 at 2.',
    );
  });
});
