import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
/**
 * ClaimCard (R25, R26) — server-rendered, native disclosure. Locks that the
 * whole card renders to HTML with no client code, that the claim is quoted
 * at the chosen heading level, and that sections are real <details>.
 */
import { describe, expect, it } from 'vitest';

import { ClaimCard } from '../src/patterns/claim-card.js';

const Example = () => (
  <ClaimCard>
    <ClaimCard.Status>
      <span>Checked</span>
    </ClaimCard.Status>
    <ClaimCard.Claim as="h2">The bridge never closed</ClaimCard.Claim>
    <ClaimCard.Answer>It closed for six weeks.</ClaimCard.Answer>
    <ClaimCard.Section title="Facts and sources" meta="2 of 2 sourced" open>
      <p>Fact one.</p>
    </ClaimCard.Section>
    <ClaimCard.Section title="What this does not claim">
      <p>Nothing about tolls.</p>
    </ClaimCard.Section>
    <ClaimCard.Footer>Card 14</ClaimCard.Footer>
  </ClaimCard>
);

describe('ClaimCard', () => {
  it('renders every part on the server, closed sections included', () => {
    const html = renderToStaticMarkup(<Example />);
    expect(html).toContain('<article');
    expect(html).toContain('It closed for six weeks.');
    // Closed <details> content is still in the HTML (find-in-page, no JS).
    expect(html).toContain('Nothing about tolls.');
    expect(html).toContain('<footer');
  });

  it('quotes the claim at the chosen heading level', () => {
    render(<Example />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.querySelector('q')?.textContent).toBe('The bridge never closed');
  });

  it('sets the claim in the heading face, so --font-heading alone restyles it', () => {
    render(<Example />);
    const classes = screen.getByRole('heading', { level: 2 }).className.split(/\s+/);
    expect(classes).toContain('font-heading');
    expect(classes).not.toContain('font-serif');
  });

  it('uses native details, with open honoured and meta shown', () => {
    const { container } = render(<Example />);
    const sections = container.querySelectorAll('details[data-slot="claim-card-section"]');
    expect(sections).toHaveLength(2);
    expect((sections[0] as HTMLDetailsElement).open).toBe(true);
    expect((sections[1] as HTMLDetailsElement).open).toBe(false);
    expect(sections[0].querySelector('summary')?.textContent).toContain('(2 of 2 sourced)');
  });

  it('wraps the meta with the title as one run of text, never as a column beside it', () => {
    const { container } = render(<Example />);
    const summary = container.querySelector('details[data-slot="claim-card-section"] summary');
    // The chevron and one text run: as two flex items, a narrow card split them into two
    // squeezed columns ("Facts and" | "(8 of 10 fully").
    const label = summary?.querySelector('[data-slot="claim-card-section-label"]');
    expect(label?.textContent).toBe('Facts and sources (2 of 2 sourced)');
    expect(summary?.querySelectorAll(':scope > span')).toHaveLength(1);
    // The meta moves to the next line whole rather than breaking inside its brackets.
    expect(label?.querySelector('span')?.className).toContain('whitespace-nowrap');
  });
});
