import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { SeriesTable } from '@interlace/ui/charts/series-table';
import { withDark, withRtl } from '@/decorators';

import { RISING, WITH_GAPS } from './fixtures';

const meta: Meta<typeof SeriesTable> = {
  title: 'Charts/SeriesTable',
  component: SeriesTable,
  tags: ['autodocs'],
  parameters: {
    // Opt out of the global `layout: 'centered'`. A centered story sits in a
    // fit-content parent, and a chart sized from its container via `viewBox` +
    // `w-full` resolves to ZERO width there — it renders, paints nothing, and
    // looks like a broken component. Charts are full-width surfaces.
    layout: 'padded',
    docs: {
      description: {
        component:
          'The data behind a chart, as a real `<table>`. Every chart in this package ships one, `sr-only` by default.\n\n' +
          'A picture is where numbers stop being readable by anything that is not an eye. `role="img"` plus a label gets a screen reader a one-sentence summary — enough to know *what happened*, never enough to know *what the value was on the 14th*.\n\n' +
          'Three things fall out, in descending order of how often they are remembered: **a11y** (WCAG 1.1.1 wants a text equivalent, and for data the equivalent is the data), **SEO** (a crawler indexes the table, not the path geometry), and **verifiability** (Ctrl+A over a chart yields nothing; over this it yields a pasteable TSV).\n\n' +
          'Axe cannot verify any of it — it reads an SVG as one opaque node and scores a labelled chart green whether or not the values are reachable.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {
  args: {
    series: [{ label: 'npm downloads', points: RISING.slice(0, 7) }],
    caption: 'npm downloads — first week',
    hidden: false,
  },
};

export const MultiSeries: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Two series on one date axis. A metric that started late still lines up column-for-column.',
      },
    },
  },
  args: {
    series: [
      { label: 'Downloads', points: RISING.slice(0, 7) },
      { label: 'Stars', points: WITH_GAPS.slice(2, 7) },
    ],
    caption: 'Downloads vs stars',
    hidden: false,
  },
};

export const Gaps: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A gap is spelled "No data" — a screen reader announces an em dash as nothing at all.',
      },
    },
  },
  args: {
    series: [{ label: 'Stars', points: WITH_GAPS.slice(0, 6) }],
    caption: 'A series with holes',
    hidden: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('No data').length).toBeGreaterThan(0);
  },
};

export const ScreenReaderOnly: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The default. Present in the accessibility tree and the DOM, absent from the layout — this is what sits under every chart.',
      },
    },
  },
  args: { series: [{ label: 'Downloads', points: RISING.slice(0, 5) }], caption: 'Hidden equivalent' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // sr-only is not `hidden`: still queryable, still announced.
    await expect(canvas.getByRole('table')).toBeTruthy();
  },
};

export const Dark: Story = {
  args: { series: [{ label: 'Downloads', points: RISING.slice(0, 7) }], caption: 'Downloads', hidden: false },
  decorators: [withDark],
};
export const Rtl: Story = {
  args: { series: [{ label: 'Downloads', points: RISING.slice(0, 7) }], caption: 'Downloads', hidden: false },
  decorators: [withRtl],
};
