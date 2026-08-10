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
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Rising: Story = {
  args: { points: RISING, label: 'Weekly downloads' },
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

export const Dark: Story = { args: { points: RISING, label: 'Downloads' }, decorators: [withDark] };
export const Rtl: Story = { args: { points: RISING, label: 'Downloads' }, decorators: [withRtl] };
