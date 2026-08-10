import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Sparkline } from '@interlace/ui/charts/sparkline';
import { withDark, withRtl } from '@/decorators';

import { FLAT, FALLING, RISING } from './fixtures';

const meta: Meta<typeof Sparkline> = {
  title: 'Charts/Sparkline',
  component: Sparkline,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A trend in the width of a table cell — the densest thing in the package. It exists so a MetricTable row can show *shape* without spending a chart\'s worth of pixels.\n\n' +
          'Direction is carried by the accessible name as well as the colour, because roughly 8% of men cannot tell the rising and falling tones apart. Pass `decorative` when the same numbers are already announced adjacently (inside a MetricTable row they are) — a second announcement is noise, not redundancy.\n\n' +
          'No charting dependency: SVG plus a scale function is the whole engine.',
      },
    },
  },
  argTypes: {
    points: {
      control: 'object',
      description:
        'The series, oldest first. `{ t, v }` where `v: null` is a real gap — nulls are dropped, never coerced to zero. Fewer than two numeric points renders the empty placeholder instead of a line.',
      table: { type: { summary: 'readonly Point[]' }, category: 'Data' },
    },
    polarity: {
      control: 'inline-radio',
      options: ['normal', 'inverse'],
      description:
        'Which direction counts as good. Without it the line coloured purely by DIRECTION, so an inverse-polarity row drew a red line beside a green delta — one row asserting "bad" and "good" at the same time, with every unit test green.',
      table: {
        type: { summary: "'normal' | 'inverse'" },
        defaultValue: { summary: 'normal' },
        category: 'Data',
      },
    },
    label: {
      control: 'text',
      description:
        'Series name used in the computed accessible label ("Weekly downloads, up 77.8%…"). Ignored when `decorative`.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    width: {
      control: { type: 'range', min: 40, max: 320, step: 10 },
      description:
        'Intrinsic width in px. Fixed rather than fluid because this lives in a table cell and must not force its column wider than the container.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '90' }, category: 'Appearance' },
    },
    height: {
      control: { type: 'range', min: 12, max: 80, step: 2 },
      description: 'Intrinsic height in px. Keep it near the line-height of the row it sits in.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '22' }, category: 'Appearance' },
    },
    decorative: {
      control: 'boolean',
      description:
        'Renders `aria-hidden` instead of `role="img"`. Set it when the same numbers are already announced adjacently — inside a MetricTable row the value and delta cells say it, so a second announcement is noise rather than redundancy.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    loading: {
      control: 'boolean',
      description:
        'Renders a `<Skeleton variant="sparkline" />` at the exact inline cell size, so a metric arriving mid-window does not reflow its column.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    className: {
      control: 'text',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Rising: Story = {
  args: {
    points: RISING,
    label: 'Weekly downloads',
    polarity: 'normal',
    width: 90,
    height: 22,
    decorative: false,
    loading: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The direction has to survive with the colour removed.
    const chart = canvas.getByRole('img');
    await expect(chart.getAttribute('aria-label')).toMatch(/up/);
    await expect(chart).toHaveAttribute('data-direction', 'up');
  },
};

export const Falling: Story = {
  args: { points: FALLING, label: 'Open issues' },
};

export const Flat: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A metric that never moved is centred, not pinned to the top edge — a zero-span series rendered against its own maximum reads as a metric at its ceiling.',
      },
    },
  },
  args: { points: FLAT, label: 'Rules shipped' },
};

export const NotEnoughData: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'One point cannot show a trend. The placeholder still reserves the full footprint so a table does not reflow when a metric starts mid-window.',
      },
    },
  },
  args: { points: RISING.slice(0, 1), label: 'New metric' },
};

export const Decorative: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Inside a row whose cells already announce the values. Renders `aria-hidden`, so a screen reader hears the numbers once.',
      },
    },
  },
  args: { points: RISING, decorative: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('img')).toBeNull();
  },
};

export const Loading: Story = {
  parameters: {
    docs: { description: { story: 'The exact 90×22 inline cell, so the table column never reflows.' } },
  },
  args: { points: [], loading: true },
};

export const InContext: Story = {
  parameters: {
    // A composition demo, not a prop demo: the row builds three Sparklines of
    // its own, so leaving the panel on would show controls that move nothing.
    controls: { disable: true },
    docs: {
      description: {
        story:
          'What it is actually for. At 90×22 the component alone in a wide canvas teaches nothing — it is sized to sit between a metric name and its number, where it adds *shape* to a row that otherwise only has a latest value.',
      },
    },
  },
  render: () => (
    <ul className="flex w-full max-w-content flex-col divide-y divide-border rounded-lg border border-border">
      {[
        { label: 'npm downloads', value: '2,205', points: RISING, polarity: 'normal' as const },
        { label: 'Open issues', value: '19', points: FALLING, polarity: 'inverse' as const },
        { label: 'Rules shipped', value: '409', points: FLAT, polarity: 'normal' as const },
      ].map((row) => (
        <li key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="flex items-center gap-4">
            <Sparkline points={row.points} polarity={row.polarity} decorative />
            <span className="w-16 text-right tabular-nums">{row.value}</span>
          </span>
        </li>
      ))}
    </ul>
  ),
};

export const Dark: Story = { args: { points: RISING, label: 'Downloads' }, decorators: [withDark] };
export const Rtl: Story = { args: { points: RISING, label: 'Downloads' }, decorators: [withRtl] };
