import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReadingStrand } from '@interlace/ui/reading-strand';
import { expect, waitFor, within } from 'storybook/test';

const meta: Meta<typeof ReadingStrand> = {
  title: 'Primitives/ReadingStrand',
  component: ReadingStrand,
  tags: ['autodocs'],
  parameters: {
    // The strand pins to the viewport top — a centered canvas would hide it.
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Reading progress as the brand\'s draw verb: one strand-a line at the top of the ' +
          'viewport that draws itself as the reader moves through the piece. Progress is state ' +
          'coupled to the reader\'s own scroll — nothing animates on its own, so there is no ' +
          'reduced-motion variant to gate. A real `role="progressbar"` (0–100), updated at most ' +
          'once per frame via a passive listener; the fill moves with compositor-only ' +
          '`transform: scaleX`, so scrolling never pays layout. `target` names the article ' +
          'element by id (server pages need no client seam just to thread a ref); it falls back ' +
          'to the whole document.',
      },
    },
  },
  argTypes: {
    target: {
      control: 'text',
      description: 'id of the element whose vertical span maps to 0→1.',
      table: { category: 'Behavior', type: { summary: 'string' } },
    },
    label: {
      control: 'text',
      description: 'Accessible name of the progressbar.',
      table: { category: 'A11y', type: { summary: 'string' }, defaultValue: { summary: 'Reading progress' } },
    },
    'data-testid': {
      control: 'text',
      description: 'Stable E2E selector; consumer provides — no default.',
      table: { category: 'Contract', type: { summary: 'string' } },
    },
  },
};
export default meta;

type Story = StoryObj<typeof ReadingStrand>;

export const Default: Story = {
  args: { 'data-testid': 'reading-strand', target: 'strand-article' },
  render: (args) => (
    <div>
      <ReadingStrand {...args} />
      <article id="strand-article" className="mx-auto max-w-prose space-y-4 p-8">
        <h1 className="text-2xl font-bold">A long read</h1>
        {Array.from({ length: 40 }, (_, i) => (
          <p key={i} className="text-muted-foreground">
            Paragraph {i + 1}. The strand above draws as you scroll — reading
            progress rendered in the brand&apos;s only motion vocabulary, with
            the reader as the timeline.
          </p>
        ))}
      </article>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = canvas.getByRole('progressbar', { name: 'Reading progress' });
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
    // Scroll the story viewport to the bottom: the strand must follow.
    window.scrollTo(0, document.documentElement.scrollHeight);
    window.dispatchEvent(new Event('scroll'));
    await waitFor(() =>
      expect(
        Number(bar.getAttribute('aria-valuenow')),
      ).toBeGreaterThan(50),
    );
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('scroll'));
    // The reset is an assertion, not fire-and-forget: the strand must
    // land back at 0 before play resolves (review).
    await waitFor(() =>
      expect(Number(bar.getAttribute('aria-valuenow'))).toBe(0),
    );
  },
};
