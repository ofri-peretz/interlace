import { renderToStaticMarkup } from 'react-dom/server';
/**
 * SectionIndex locks — the terminal-numeral contract, the SR semantic,
 * and the token discipline.
 */
import { describe, expect, it } from 'vitest';

import { SectionIndex } from '../src/primitives/section-index.js';

const html = renderToStaticMarkup(
  <SectionIndex value={2} data-testid="si">
    The Agenda
  </SectionIndex>,
);

describe('the terminal numeral', () => {
  it('zero-pads to the terminal form, mono + tabular, AAA primary accent', () => {
    expect(html).toContain('>02<');
    expect(html).toContain('font-mono');
    expect(html).toContain('[font-variant-numeric:tabular-nums]');
    expect(html).toContain('text-primary');
  });

  it('a three-digit sequence keeps its width honestly', () => {
    const wide = renderToStaticMarkup(
      <SectionIndex value={100} data-testid="si">
        X
      </SectionIndex>,
    );
    expect(wide).toContain('>100<');
  });

  it('never a raw color', () => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe('the screen-reader semantic', () => {
  it('speaks "Section 2:" and hides the padded numeral', () => {
    expect(html).toMatch(/sr-only[^>]*>Section 2:<\/span>/);
    expect(html).toMatch(/aria-hidden="true"[^>]*>02</);
  });

  it('the label renders as given', () => {
    expect(html).toContain('The Agenda');
  });
});
