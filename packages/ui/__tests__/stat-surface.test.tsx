/**
 * StatCard and StatGroup surfaces: the card tile stays the default, and a
 * plain stat drops the tile for a hairline in the colour of what it sits on,
 * with a label that does not assume the muted token.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatCard } from '../src/patterns/stat-card.js';
import { StatGroup } from '../src/patterns/stat-group.js';

describe('StatCard surface', () => {
  it('is a bordered tile by default', () => {
    render(<StatCard label="Answers" value="4" />);
    const card = screen.getByRole('article');
    expect(card.getAttribute('data-surface')).toBe('card');
    expect(card.className).toContain('bg-card');
    expect(card.className).toContain('rounded-xl');
  });

  it('plain drops the tile and inherits its colour, label included', () => {
    render(<StatCard surface="plain" label="Answers" value="4" />);
    const card = screen.getByRole('article');
    expect(card.getAttribute('data-surface')).toBe('plain');
    expect(card.className).not.toContain('bg-card');
    expect(card.className).not.toContain('text-card-foreground');
    expect(card.className).toContain('border-current/25');
    expect(screen.getByText('Answers').className).not.toContain('text-muted-foreground');
  });
});

describe('StatGroup surface', () => {
  it('hands its surface to every card, and a card can keep its own', () => {
    render(
      <StatGroup
        surface="plain"
        stats={[
          { label: 'One', value: '1' },
          { label: 'Two', value: '2', surface: 'card' },
        ]}
      />,
    );
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('data-surface'))).toEqual([
      'plain',
      'card',
    ]);
  });
});

describe('StatCard plain value', () => {
  it('reads a size up without a tile', async () => {
    const { container } = render(<StatCard surface="plain" label="A" value="4" />);
    const plain = container.querySelector('[data-tabular-nums]')!.className;
    const { container: c2 } = render(<StatCard label="A" value="4" />);
    const card = c2.querySelector('[data-tabular-nums]')!.className;
    expect(plain).not.toBe(card);
  });
});

describe('SectionHeader spacing none', () => {
  it('leaves the gap to the parent stack', async () => {
    const { SectionHeader } = await import('../src/patterns/section-header.js');
    const { container } = render(<SectionHeader title="Where we stand" spacing="none" />);
    expect((container.firstElementChild as HTMLElement).className).not.toMatch(/\bmb-/);
  });
});
