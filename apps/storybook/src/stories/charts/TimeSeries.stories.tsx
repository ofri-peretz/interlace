import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { TimeSeries } from '@interlace/ui/charts/time-series';
import { withDark, withRtl } from '@/decorators';

import { ANNOTATIONS, RISING, WITH_GAPS } from './fixtures';

const meta: Meta<typeof TimeSeries> = {
  title: 'Charts/TimeSeries',
  component: TimeSeries,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One metric over time, with the actions that moved it drawn ON the curve.\n\n' +
          '**The annotation is the point.** A line going up is a fact; a line going up with a publish marker at the inflection is an argument. Grid, axis and crosshair are chrome that exists so the annotation can be read against a scale.\n\n' +
          '**The crosshair works from the keyboard** — ←/→ step, Home/End jump, Escape clears, and the readout is `aria-live="polite"`. This is the part charting libraries almost universally get wrong: hover-only inspection means the values exist for mouse users and nobody else. The pointer path and the keyboard path resolve through the same `nearestIndex` call, so they can never disagree.\n\n' +
          '**Every chart ships an `sr-only` data table.** Axe reads an SVG as one opaque node and will score a labelled chart green whether or not the values are reachable.',
      },
    },
  },
  argTypes: {
    points: {
      control: 'object',
      description:
        'The series, oldest first. `{ t, v }` where `t` is an ISO date (or any string that sorts correctly) and `v: null` is a day nobody measured — nulls are dropped, never coerced to zero. Below two numeric points the component says why it cannot plot instead of drawing an empty box.',
      table: { type: { summary: 'readonly Point[]' }, category: 'Data' },
    },
    annotations: {
      control: 'object',
      description:
        'Marks drawn ON the curve — `{ t, label, kind }`. `kind` is one of `publish` / `release` / `action` and picks a SHAPE first (circle / diamond / triangle) and a hue second, so the distinction survives a greyscale print. An annotation whose day is not in `points` is skipped rather than snapped to a neighbour.',
      table: { type: { summary: 'readonly Annotation[]' }, defaultValue: { summary: '[]' }, category: 'Data' },
    },
    label: {
      control: 'text',
      description:
        'Series name. One string does three jobs: the visible figcaption, the accessible label, and the data table caption — so they can never drift apart.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    unit: {
      control: 'text',
      description: 'Noun appended to the crosshair readout — "2026-07-14 · 2,205 downloads".',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    height: {
      control: { type: 'range', min: 120, max: 480, step: 20 },
      description:
        'Drawing height in user units. The rendered width always follows the container (the plot is `viewBox`-sized), so this is really the aspect ratio knob.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '220' }, category: 'Appearance' },
    },
    showTable: {
      control: 'boolean',
      description:
        'Render the data table visibly under the chart instead of `sr-only`. A "show data" toggle beside a chart is a good default, not an admission.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'Appearance' },
    },
    loading: {
      control: 'boolean',
      description:
        'Render a `<Skeleton variant="chart" />` at the same height the chart will occupy. Checked BEFORE the not-enough-data branch: "no data yet" while the request is still in flight is a different claim, and a wrong one.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the `<figure>`. `w-full` is applied internally and is load-bearing — a figure that collapses to zero width paints nothing at all.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    points: RISING,
    annotations: [],
    label: 'npm downloads',
    unit: 'downloads',
    height: 220,
    showTable: false,
    loading: false,
  },
};

export const WithAnnotations: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Three annotation kinds, distinguished by SHAPE first and hue second — circle (publish), diamond (release), triangle (action). Shape is what survives a greyscale print and a colour-blind reader.',
      },
    },
  },
  args: {
    points: RISING,
    annotations: ANNOTATIONS,
    label: 'npm downloads',
    unit: 'downloads',
  },
};

export const KeyboardCrosshair: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Focus the plot and press ArrowRight. Axe cannot press a key, so this path is invisible to it — the `play` function is the gate.',
      },
    },
  },
  args: { points: RISING, label: 'npm downloads', unit: 'downloads' },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const plot = canvas.getByRole('img');

    await step('the plot is reachable by keyboard at all', async () => {
      plot.focus();
      await expect(document.activeElement).toBe(plot);
    });

    await step('ArrowRight reads out a specific value', async () => {
      await userEvent.keyboard('{ArrowRight}');
      await waitFor(() =>
        expect(canvasElement.querySelector('output')?.textContent).toMatch(/\d/),
      );
    });

    await step('End jumps to the last observation', async () => {
      await userEvent.keyboard('{End}');
      await waitFor(() =>
        expect(canvasElement.querySelector('output')?.textContent).toContain('2026-07-14'),
      );
    });

    await step('Escape clears the crosshair (WCAG 2.1.2)', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(canvasElement.querySelector('output')?.textContent).toBe(''));
    });
  },
};

export const WithGaps: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A `null` is a day nobody measured, not a day the metric was zero. Gaps are dropped rather than coerced — averaging over an invented zero silently manufactures data.',
      },
    },
  },
  args: { points: WITH_GAPS, label: 'GitHub stars', unit: 'stars' },
};

export const DataTableVisible: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The same table every chart already ships `sr-only`. A "show data" toggle beside a chart is a good default, not an admission — and it is what makes the numbers copy-pasteable into a spreadsheet.',
      },
    },
  },
  args: { points: RISING.slice(0, 6), label: 'npm downloads', unit: 'downloads', showTable: true },
};

export const NotEnoughData: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Says why it cannot plot. History cannot be back-filled, and an empty box reads as a bug.',
      },
    },
  },
  args: { points: RISING.slice(0, 1), label: 'New metric' },
};

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Reserves the same box the chart will occupy. A spinner reserves nothing and guarantees a layout shift the moment the series lands — and "No data yet" while the request is still in flight is a claim the reader cannot check.',
      },
    },
  },
  args: { points: [], label: 'npm downloads', loading: true },
};

export const Dark: Story = {
  args: { points: RISING, annotations: ANNOTATIONS, label: 'npm downloads' },
  decorators: [withDark],
};

export const Rtl: Story = {
  args: { points: RISING, label: 'npm downloads' },
  decorators: [withRtl],
};
