/**
 * Sheet and drawer take `start` and `end`, which follow the reading direction.
 * Both portal out of any `dir` wrapper, so they read direction from the
 * `DirectionProvider` context. These tests pin which screen edge each resolves to.
 */
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DirectionProvider } from '../src/primitives/direction.js';
import { Drawer, DrawerContent, DrawerTitle } from '../src/primitives/drawer.js';
import { Sheet, SheetContent, SheetTitle } from '../src/primitives/sheet.js';

afterEach(cleanup);

type Dir = 'ltr' | 'rtl';
type Logical = 'start' | 'end';

const sheetEdge = (direction: Dir, side: Logical | 'left') => {
  render(
    <DirectionProvider direction={direction}>
      <Sheet open>
        <SheetContent side={side}>
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>
    </DirectionProvider>,
  );
  return document.querySelector('[data-slot="sheet-content"]');
};

const drawerEdge = (direction: Dir, side: Logical) => {
  render(
    <DirectionProvider direction={direction}>
      <Drawer open direction={side}>
        <DrawerContent>
          <DrawerTitle>Filters</DrawerTitle>
        </DrawerContent>
      </Drawer>
    </DirectionProvider>,
  );
  return document.querySelector('[data-slot="drawer-content"]');
};

const CASES: [Dir, Logical, 'left' | 'right'][] = [
  ['ltr', 'start', 'left'],
  ['ltr', 'end', 'right'],
  ['rtl', 'start', 'right'],
  ['rtl', 'end', 'left'],
];

describe('logical edges', () => {
  it.each(CASES)('a %s sheet on the %s side opens from the %s edge', (direction, side, edge) => {
    const popup = sheetEdge(direction, side);
    expect(popup?.getAttribute('data-side')).toBe(edge);
    expect(popup?.className).toContain(`${edge}-0`);
  });

  it.each(CASES)('a %s drawer on the %s side opens from the %s edge', (direction, side, edge) => {
    const popup = drawerEdge(direction, side);
    expect(popup?.getAttribute('data-direction')).toBe(edge);
    expect(popup?.className).toContain(edge === 'right' ? 'border-l' : 'border-r');
  });

  it('a physical side ignores the reading direction', () => {
    const popup = sheetEdge('rtl', 'left');
    expect(popup?.getAttribute('data-side')).toBe('left');
  });
});
