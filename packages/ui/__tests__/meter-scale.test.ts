/**
 * Meter arithmetic.
 *
 * The bar's length is the part that can be proved rather than reviewed, and a
 * bar that draws a beautiful wrong length is worse than one that fails to
 * render. Same standard as `charts-scale.test.ts`, applied to a module that
 * lives outside the coverage glob for registry-installability reasons (see
 * `data-state-model.test.ts`).
 */

import { describe, expect, it } from 'vitest';

import { compact } from '../src/charts/scale.js';
import {
  clamp01,
  compactMagnitude,
  describeMeter,
  FILL_WIDTH_CLASSES,
  fillWidthClass,
  LOG_FLOOR,
  meterDomainMax,
  meterFraction,
  rankByValue,
} from '../src/primitives/meter-scale.js';

describe('clamp01', () => {
  it('passes the unit interval through', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
  });

  it('clamps both ends', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(4)).toBe(1);
  });

  it('treats non-finite input as the floor', () => {
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
    expect(clamp01(-Infinity)).toBe(0);
  });
});

describe('meterFraction — linear', () => {
  it('is value over max', () => {
    expect(meterFraction(50, 100)).toBe(0.5);
    expect(meterFraction(1, 4)).toBe(0.25);
  });

  it('draws a measured zero as zero length', () => {
    // A measured 0 IS a zero-length bar. The distinction from "unmeasured"
    // lives in the return type, not in the length.
    expect(meterFraction(0, 100)).toBe(0);
  });

  it('clamps an overage to full rather than overflowing the track', () => {
    expect(meterFraction(150, 100)).toBe(1);
  });

  it('clamps a negative value to empty', () => {
    expect(meterFraction(-20, 100)).toBe(0);
  });
});

describe('meterFraction — the `null` contract', () => {
  it('returns null for an unmeasured value, never 0', () => {
    expect(meterFraction(null, 100)).toBeNull();
    expect(meterFraction(undefined, 100)).toBeNull();
  });

  it('returns null when there is no denominator', () => {
    expect(meterFraction(50, null)).toBeNull();
    expect(meterFraction(50, undefined)).toBeNull();
  });

  it('returns null for a non-positive max rather than inventing a full bar', () => {
    expect(meterFraction(50, 0)).toBeNull();
    expect(meterFraction(50, -10)).toBeNull();
  });

  it('returns null for non-finite input on either side', () => {
    expect(meterFraction(NaN, 100)).toBeNull();
    expect(meterFraction(Infinity, 100)).toBeNull();
    expect(meterFraction(50, NaN)).toBeNull();
    expect(meterFraction(50, Infinity)).toBeNull();
  });
});

describe('meterFraction — log', () => {
  it('puts 10k and 10M on one legible axis', () => {
    // The reason the log branch exists: on a linear axis the 10k row is
    // 0.001 of the track — a hairline that reads as zero, which is the one
    // thing it is not.
    const linear = meterFraction(10_000, 10_000_000, 'linear')!;
    const log = meterFraction(10_000, 10_000_000, 'log')!;
    expect(linear).toBeCloseTo(0.001, 6);
    expect(log).toBeCloseTo(4 / 7, 6);
  });

  it('maps the maximum to full', () => {
    expect(meterFraction(1000, 1000, 'log')).toBe(1);
  });

  it('maps the domain floor and everything under it to empty', () => {
    expect(meterFraction(LOG_FLOOR, 1000, 'log')).toBe(0);
    expect(meterFraction(0.5, 1000, 'log')).toBe(0);
    expect(meterFraction(0, 1000, 'log')).toBe(0);
    expect(meterFraction(-5, 1000, 'log')).toBe(0);
  });

  it('honours a custom floor', () => {
    // Domain 100 → 10,000 is two decades; 1,000 sits exactly halfway.
    expect(meterFraction(1000, 10_000, 'log', 100)).toBeCloseTo(0.5, 10);
  });

  it('is monotonic across the domain', () => {
    const values = [2, 20, 200, 2000, 20_000];
    const fractions = values.map((v) => meterFraction(v, 100_000, 'log')!);
    for (let i = 1; i < fractions.length; i += 1) {
      expect(fractions[i]).toBeGreaterThan(fractions[i - 1]);
    }
  });

  it('fills a collapsed domain rather than dividing by zero', () => {
    // A meter's denominator is a STATED maximum, not an observed span, so a
    // value at the ceiling of a zero-span domain is legitimately full —
    // unlike a flat time series, there is nothing to centre.
    expect(meterFraction(1, 1, 'log')).toBe(1);
    expect(meterFraction(0.5, 1, 'log')).toBe(0);
    expect(Number.isNaN(meterFraction(1, 1, 'log')!)).toBe(false);
  });

  it('still returns null for an unmeasured value', () => {
    expect(meterFraction(null, 1000, 'log')).toBeNull();
  });
});

describe('meterDomainMax', () => {
  it('is the largest measured value', () => {
    expect(meterDomainMax([3, 9, 4])).toBe(9);
  });

  it('skips nulls instead of counting them as zero', () => {
    expect(meterDomainMax([null, 3, undefined, 9])).toBe(9);
  });

  it('returns null when nothing was measured', () => {
    expect(meterDomainMax([])).toBeNull();
    expect(meterDomainMax([null, undefined])).toBeNull();
  });

  it('ignores non-finite values', () => {
    expect(meterDomainMax([NaN, Infinity, 5])).toBe(5);
    expect(meterDomainMax([NaN])).toBeNull();
  });

  it('handles an all-negative set without falling back to 0', () => {
    expect(meterDomainMax([-5, -2, -9])).toBe(-2);
  });
});

describe('rankByValue', () => {
  const rows = (values: (number | null)[]) =>
    values.map((value, i) => ({ key: `k${i}`, value }));

  it('sorts descending', () => {
    expect(rankByValue(rows([1, 9, 5])).map((r) => r.value)).toEqual([9, 5, 1]);
  });

  it('sinks unmeasured rows to the bottom without treating them as zero', () => {
    const ranked = rankByValue(rows([null, -4, 3]));
    expect(ranked.map((r) => r.value)).toEqual([3, -4, null]);
  });

  it('is stable within ties and within the unmeasured block', () => {
    const ranked = rankByValue([
      { key: 'a', value: 5 },
      { key: 'b', value: 5 },
      { key: 'c', value: null },
      { key: 'd', value: null },
    ]);
    expect(ranked.map((r) => r.key)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('treats a non-finite value as unmeasured', () => {
    const ranked = rankByValue(rows([NaN, 2]));
    expect(ranked[0].value).toBe(2);
    expect(Number.isNaN(ranked[1].value as number)).toBe(true);
  });

  it('does not mutate the caller array', () => {
    const input = rows([1, 9]);
    const copy = [...input];
    rankByValue(input);
    expect(input).toEqual(copy);
  });

  it('handles the empty list', () => {
    expect(rankByValue([])).toEqual([]);
  });
});

describe('fillWidthClass', () => {
  it('exposes one literal class per whole percent', () => {
    expect(FILL_WIDTH_CLASSES).toHaveLength(101);
    FILL_WIDTH_CLASSES.forEach((cls, i) => expect(cls).toBe(`w-[${i}%]`));
  });

  it('maps the ends exactly', () => {
    expect(fillWidthClass(0)).toBe('w-[0%]');
    expect(fillWidthClass(1)).toBe('w-[100%]');
  });

  it('rounds rather than floors, so a maximum row is not left a hairline short', () => {
    expect(fillWidthClass(0.999)).toBe('w-[100%]');
    expect(fillWidthClass(0.005)).toBe('w-[1%]');
    expect(fillWidthClass(0.624)).toBe('w-[62%]');
    expect(fillWidthClass(0.626)).toBe('w-[63%]');
  });

  it('clamps out-of-range and non-finite input', () => {
    expect(fillWidthClass(2)).toBe('w-[100%]');
    expect(fillWidthClass(-1)).toBe('w-[0%]');
    expect(fillWidthClass(NaN)).toBe('w-[0%]');
  });

  it('never returns undefined for any fraction in the interval', () => {
    for (let i = 0; i <= 1000; i += 1) {
      expect(fillWidthClass(i / 1000)).toMatch(/^w-\[\d{1,3}%\]$/);
    }
  });
});

describe('compactMagnitude', () => {
  it('matches charts/scale `compact` for every magnitude', () => {
    // The two are deliberate twins — a cross-tier `../charts/scale.js` import
    // from a primitive emits a registryDependency that resolves to nothing and
    // makes the item uninstallable. Pinned by test rather than by module.
    for (const value of [
      0, 1, -1, 999, 1000, -1000, 12_400, 3_100_000, -3_100_000, 2_500_000_000,
    ]) {
      expect(compactMagnitude(value), String(value)).toBe(compact(value));
    }
  });

  it('abbreviates at each threshold', () => {
    expect(compactMagnitude(12_400)).toBe('12.4k');
    expect(compactMagnitude(3_100_000)).toBe('3.1M');
    expect(compactMagnitude(2_500_000_000)).toBe('2.5B');
  });

  it('renders a non-finite magnitude as a dash rather than "NaN"', () => {
    expect(compactMagnitude(NaN)).toBe('—');
    expect(compactMagnitude(Infinity)).toBe('—');
  });
});

describe('describeMeter', () => {
  it('carries the actual value, not the projection of it', () => {
    // "62 percent" is what the bar looks like; "6,200 downloads of 10,000" is
    // what was measured. WCAG 1.1.1 wants the data, not a description of the
    // picture.
    expect(describeMeter('Downloads', 6200, 10_000, 'downloads')).toBe(
      'Downloads: 6,200 downloads of 10,000 downloads.',
    );
  });

  it('omits the denominator when there is none', () => {
    expect(describeMeter('Downloads', 6200, null)).toBe('Downloads: 6,200.');
    expect(describeMeter('Downloads', 6200, 0)).toBe('Downloads: 6,200.');
  });

  it('says "not measured" — never "zero" — for an unmeasured row', () => {
    expect(describeMeter('Downloads', null, 10_000)).toBe(
      'Downloads: not measured.',
    );
    expect(describeMeter('Downloads', null, 10_000)).not.toMatch(/\b0\b/);
  });

  it('says a measured zero as a number', () => {
    expect(describeMeter('Downloads', 0, 10_000)).toBe(
      'Downloads: 0 of 10,000.',
    );
  });
});
