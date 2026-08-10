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
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { points: RISING, label: 'npm downloads', unit: 'downloads' },
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
