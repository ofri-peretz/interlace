import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Delta } from '@interlace/ui/charts/delta';
import { withRtl } from '@/decorators';

import { FALLING, FLAT, RISING } from './fixtures';

const meta: Meta<typeof Delta> = {
  title: 'Charts/Delta',
  component: Delta,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '"It moved, this much, this way." The smallest complete unit of analysis and the most-repeated element in a dense view.\n\n' +
          '**Three signals, not one.** Direction is carried by a glyph (▲ ▼ –), a sign (+ / −), and a colour — in that order of reliability. Colour is last on purpose: it is the one that disappears in greyscale, in bright sun, and for the ~8% of men with red-green colour vision deficiency.\n\n' +
          '**"Good" is not a property of a number.** A rising error rate is bad; a rising follower count is good. Metrics like latency, cost and bounce rate must pass `polarity="inverse"`.',
      },
    },
  },
  argTypes: {
    points: {
      control: 'object',
      description:
        'The series to compare. Only the first and last numeric observations decide the answer — everything between them is context. `{ t, v }` where `v: null` is a day nobody measured, never a zero.',
      table: { type: { summary: 'readonly Point[]' }, category: 'Data' },
    },
    polarity: {
      control: 'inline-radio',
      options: ['normal', 'inverse'],
      description:
        'Which direction counts as good. `inverse` for latency, cost, bounce rate, open issues. Flip it and the tone flips while the digits stay exactly where they were.',
      table: {
        type: { summary: "'normal' | 'inverse'" },
        defaultValue: { summary: 'normal' },
        category: 'Data',
      },
    },
    unit: {
      control: 'text',
      description:
        'Noun for the accessible sentence — "up 965 downloads, 77.8%, from 1,240 to 2,205". Never rendered visually; it exists for the screen reader.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    percent: {
      control: 'boolean',
      description:
        'Show the percentage beside the absolute change. Turn it off where the base is small enough that a percentage flatters — 1 → 3 is "+200%".',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
        category: 'Appearance',
      },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the `<span>`. Note this renders as plain inline text, not inline-flex — inside a `<td>` a shrink-to-fit box measured 0px wide while its digits painted 113px over the next column.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Up: Story = {
  args: { points: RISING, polarity: 'normal', percent: true, unit: 'downloads' },
};
export const Down: Story = { args: { points: FALLING, unit: 'issues' } };
export const Flat: Story = {
  parameters: { docs: { description: { story: 'Says "unchanged" rather than "up 0".' } } },
  args: { points: FLAT, unit: 'rules' },
};

export const InversePolarity: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The same falling series, declared as a metric where down is good. Tone flips; the numbers do not.',
      },
    },
  },
  args: { points: FALLING, polarity: 'inverse', unit: 'issues' },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-slot="delta"]');
    await expect(el).toHaveAttribute('data-tone', 'good');
    await expect(el).toHaveAttribute('data-direction', 'down');
  },
};

export const ZeroBaseline: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A percentage change from zero is undefined, not infinite. "+Infinity%" on a dashboard is how a metric that started at nothing gets reported as an achievement.',
      },
    },
  },
  args: { points: [{ t: '2026-07-01', v: 0 }, { t: '2026-07-02', v: 240 }], unit: 'installs' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).not.toContain('Infinity');
  },
};

export const NotEnoughData: Story = {
  args: { points: RISING.slice(0, 1) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Not enough data to compare')).toBeTruthy();
  },
};

export const Dark: Story = { args: { points: RISING, unit: 'downloads' }, globals: { theme: 'dark' } };
export const Rtl: Story = { args: { points: RISING, unit: 'downloads' }, decorators: [withRtl] };
