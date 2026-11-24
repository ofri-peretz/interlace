/**
 * Collections take a `density`: the same grid tightens for a dashboard or
 * a sidebar and opens up for a landing page, without a custom className.
 *
 * Locks that every collection accepts the same three values, records the
 * choice on its root, and maps it onto the Grid primitive's closed gap
 * scale (and, where the collection owns them, its section and card
 * padding). `default` must render exactly what the collection rendered
 * before `density` existed.
 */
import { cleanup, render } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ArticleListGrid } from '../src/patterns/article-list-grid.js';
import { FeatureGrid } from '../src/patterns/feature-grid.js';
import { PricingTable } from '../src/patterns/pricing-table.js';
import { StatGroup } from '../src/patterns/stat-group.js';

afterEach(cleanup);

type Density = 'compact' | 'default' | 'relaxed';

const COLLECTIONS: Array<[string, string, (d?: Density) => React.ReactElement, boolean]> = [
  ['FeatureGrid', 'feature-grid', (d) => <FeatureGrid density={d} loading />, true],
  ['ArticleListGrid', 'article-list-grid', (d) => <ArticleListGrid density={d} loading />, true],
  ['PricingTable', 'pricing-table', (d) => <PricingTable density={d} loading />, true],
  ['StatGroup', 'stat-group', (d) => <StatGroup density={d} loading />, false],
];

// The Grid's step shows as its row gap (gap-y-*) and, for relaxed, the wide
// column step it switches to from md.
const GAP = {
  compact: 'gap-y-4',
  default: 'gap-y-6',
  relaxed: 'md:[--grid-gap-x:calc(var(--spacing)*10)]',
} as const;
const SECTION = { compact: 'py-10', default: 'py-16', relaxed: 'py-24' } as const;

describe('collections take a density', () => {
  describe.each(COLLECTIONS)('%s', (_name, slot, make, ownsSection) => {
    it('defaults to the spacing it had before density existed', () => {
      render(make());
      const root = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
      expect(root.getAttribute('data-density')).toBe('default');
      expect(document.querySelector('[data-slot="grid"]')!.className).toContain(GAP.default);
      if (ownsSection) expect(root.className).toContain('py-16');
    });

    it.each(['compact', 'relaxed'] as const)('%s', (density) => {
      render(make(density));
      const root = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
      expect(root.getAttribute('data-density')).toBe(density);
      const grid = document.querySelector('[data-slot="grid"]')!;
      expect(grid.className).toContain(GAP[density]);
      expect(grid.className).not.toContain(GAP.default);
      if (ownsSection) {
        expect(root.className).toContain(SECTION[density]);
        expect(root.className).not.toContain(SECTION.default);
      }
    });
  });

  it.each([
    ['compact', 'p-4'],
    ['default', 'p-6'],
    ['relaxed', 'p-8'],
  ] as const)('pads feature cards and pricing tiers for %s', (density, pad) => {
    render(
      <>
        <FeatureGrid density={density} features={[{ title: 'One' }]} />
        <PricingTable density={density} tiers={[{ name: 'Free', price: '$0', features: [] }]} />
      </>,
    );
    const feature = document.querySelector('[data-slot="feature"]')!;
    const tier = document.querySelector('[data-slot="pricing-tier"]')!;
    expect(feature.className.split(/\s+/)).toContain(pad);
    expect(tier.className.split(/\s+/)).toContain(pad);
  });

  it.each([
    ['compact', 'gap-4', 'pt-4'],
    ['default', 'gap-6', 'pt-6'],
    ['relaxed', 'gap-8', 'pt-8'],
  ] as const)("keeps a pricing tier's inner rhythm on the %s step", (density, gap, ctaPad) => {
    render(
      <PricingTable
        density={density}
        tiers={[{ name: 'Free', price: '$0', features: [], cta: <a href="#">Start</a> }]}
      />,
    );
    const tier = document.querySelector('[data-slot="pricing-tier"]')!;
    expect(tier.className.split(/\s+/)).toContain(gap);
    expect(tier.querySelector('a')!.parentElement!.className.split(/\s+/)).toContain(ctaPad);
  });
});
