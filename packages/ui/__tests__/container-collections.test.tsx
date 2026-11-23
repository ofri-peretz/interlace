/**
 * Collections size to their container (BREAKPOINT_PHILOSOPHY, "Collections
 * size to their container").
 *
 * Every repeating grid picks its track count from its own width, so the same
 * `cols={4}` grid in a sidebar collapses instead of holding four 60px tracks.
 * jsdom cannot resolve a container query, so this locks the classes: the
 * grid's container ancestor is an `@container`, its tracks use `@`-variants,
 * and no viewport-keyed `grid-cols` survives. Geometry is checked in a browser
 * against the Storybook stories.
 */

import { cleanup, render } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ArticleListGrid } from '../src/patterns/article-list-grid.js';
import { FeatureGrid } from '../src/patterns/feature-grid.js';
import { PricingTable } from '../src/patterns/pricing-table.js';
import { RelatedPosts } from '../src/patterns/related-posts.js';
import { StatGroup } from '../src/patterns/stat-group.js';

afterEach(cleanup);

const COLLECTIONS: Array<[string, React.ReactElement]> = [
  ['FeatureGrid', <FeatureGrid key="f" cols={4} loading />],
  ['StatGroup', <StatGroup key="s" cols={4} loading />],
  ['ArticleListGrid', <ArticleListGrid key="a" cols={4} loading />],
  ['PricingTable', <PricingTable key="p" cols={4} loading />],
  ['RelatedPosts', <RelatedPosts key="r" data-testid="related-posts" loading />],
];

describe('collections size to their container, not the viewport', () => {
  it.each(COLLECTIONS)('%s', (_name, element) => {
    render(element);
    const grid = document.querySelector<HTMLElement>('[data-slot="grid"]');
    expect(grid).not.toBeNull();
    expect(grid!.closest('.\\@container')).not.toBeNull();
    expect(grid!.className).toMatch(/(^|\s)@[a-z0-9]+:grid-cols-\d/);
    expect(grid!.className).not.toMatch(/(^|\s)(xs|sm|md|lg|xl|2xl):grid-cols-/);
  });
});
