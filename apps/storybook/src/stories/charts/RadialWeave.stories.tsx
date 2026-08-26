import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { RadialWeave } from '@interlace/ui/charts/radial-weave';

import { COMPARING, FLAT, RISING, WITH_GAPS } from './fixtures';

const meta: Meta<typeof RadialWeave> = {
  title: 'Charts/RadialWeave',
  component: RadialWeave,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The same series `TimeSeries` plots, wrapped around a dial — the POSTER form: ' +
          'identity and shape, composed to be looked at and shared.\n\n' +
          '**The gap in the circle is a statement.** The sweep is 300°, not 360: a closed circle ' +
          'claims the newest observation meets the oldest. The gap sits at the bottom — the ' +
          'speedometer convention — so time starts bottom-left and runs clockwise over the top.\n\n' +
          '**No crosshair, on purpose.** A radial plot trades inspection for composition; the ' +
          'trade is only honest because the inspection surfaces still exist — the `aria-label` ' +
          'sentence, the lossless `sr-only` data table, and the HTML `min`/`max` readout. A value ' +
          'a reader needs to inspect is `TimeSeries`’ job.\n\n' +
          '**Identity survives the form change.** Series draw with the exact dash+hue table ' +
          '`TimeSeries` uses, so “the dashed thread” names the same series in both forms. A ' +
          '`null` breaks the arc rather than bridging it — an arc over a gap is a drawn value ' +
          'nobody measured.',
      },
    },
  },
  argTypes: {
    points: {
      control: 'object',
      description:
        'The primary series, oldest first. Same `Point` contract as every chart: `v: null` is a ' +
        'gap, dropped rather than coerced to zero, and it BREAKS the arc. Below two numeric ' +
        'points the component says why it cannot plot.',
      table: { type: { summary: 'readonly Point[]' }, category: 'Data' },
    },
    compare: {
      control: 'object',
      description:
        'Further series wrapped around the SAME dial — one radial domain, shared, for the same ' +
        'reason `TimeSeries` refuses a second y axis. Capped at five drawn series (the identity ' +
        'palette); the rest stay in the data table.',
      table: { type: { summary: 'readonly ComparisonSeries[]' }, defaultValue: { summary: '[]' }, category: 'Data' },
    },
    label: {
      control: 'text',
      description: 'Series name — caption, accessible sentence, table caption.',
      table: { category: 'Naming' },
    },
    unit: {
      control: 'text',
      description: 'Noun for the values, printed under the centre value.',
      table: { category: 'Naming' },
    },
    showTable: {
      control: 'boolean',
      description: 'Render the data table visibly instead of `sr-only`.',
      table: { category: 'Data', defaultValue: { summary: 'false' } },
    },
    loading: {
      control: 'boolean',
      description: 'Render the chart skeleton — reserves the box, no layout shift on arrival.',
      table: { category: 'Data states', defaultValue: { summary: 'false' } },
    },
    error: {
      control: 'boolean',
      description:
        'The fetch failed — a different statement from an empty series, announced as one.',
      table: { category: 'Data states' },
    },
  },
};
export default meta;

type Story = StoryObj<typeof RadialWeave>;

export const Default: Story = {
  args: { points: RISING, label: 'npm downloads', unit: 'downloads / week' },
};

export const WovenPair: Story = {
  args: {
    points: RISING,
    label: 'Downloads',
    compare: [{ points: COMPARING, label: 'Docs visits' }],
  },
  play: async ({ canvasElement }) => {
    // Both series wrap the one dial, each with its legend identity. The
    // names deliberately ALSO appear in the figcaption and the data
    // table (the lossless surfaces), so the query scopes to the legend.
    const legend = canvasElement.querySelector('[data-slot="radial-weave-legend"]');
    await expect(legend?.textContent).toContain('Downloads');
    await expect(legend?.textContent).toContain('Docs visits');
  },
};

export const WithGaps: Story = {
  args: { points: WITH_GAPS, label: 'Stars observed' },
  parameters: {
    docs: {
      description: {
        story: 'The nulls BREAK the arc. An arc bridging a gap is a drawn value nobody measured.',
      },
    },
  },
};

export const FlatSeries: Story = {
  args: { points: FLAT, label: 'Rules shipped' },
  parameters: {
    docs: {
      description: {
        story:
          'A zero span centres between the rings — the same rule every chart in the package ' +
          'applies, so “never moved” cannot render as “at its maximum”.',
      },
    },
  },
};

export const NotEnoughData: Story = {
  args: { points: [{ t: '2026-07-01T00:00:00Z', v: 12 }], label: 'New metric' },
};

export const Loading: Story = {
  args: { points: [], loading: true },
};

export const FetchFailed: Story = {
  args: { points: [], error: new Error('upstream 500'), label: 'Downloads' },
};

export const VisibleTable: Story = {
  args: { points: RISING, label: 'Downloads', unit: 'downloads', showTable: true },
};
