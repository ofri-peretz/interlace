import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Container } from '../src/primitives/container.js';
import { Footer } from '../src/patterns/footer.js';
import { Topbar } from '../src/patterns/topbar.js';

// The page chrome takes Container's gutters, so the logo and the footer line up with
// the content between them at every width.
const GUTTER = ['px-4', 'xs:px-6', 'lg:px-8'];

function gutterOf(el: Element | null): string[] {
  const cls = el?.className.split(/\s+/) ?? [];
  return GUTTER.filter((g) => cls.includes(g));
}

describe('page chrome gutters', () => {
  it('Container is the source of the gutter', () => {
    const { container } = render(<Container>body</Container>);
    expect(gutterOf(container.firstElementChild)).toEqual(GUTTER);
  });

  it('Topbar uses the same gutter as Container', () => {
    const { container } = render(<Topbar logo={<span>Logo</span>} />);
    const row = container.querySelector('[data-slot="topbar"] > div');
    expect(gutterOf(row)).toEqual(GUTTER);
  });

  it('Footer uses the same gutter as Container', () => {
    const { container } = render(<Footer tagline="Tagline" />);
    const inner = container.querySelector('[data-slot="footer"] > div');
    expect(gutterOf(inner)).toEqual(GUTTER);
  });
});
