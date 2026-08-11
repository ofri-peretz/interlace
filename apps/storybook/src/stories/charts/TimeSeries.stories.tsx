import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { TimeSeries } from '@interlace/ui/charts/time-series';
import { withRtl } from '@/decorators';

import { ANNOTATIONS, COMPARING, FALLING, FLAT, RAGGED, RISING, TINY, WITH_GAPS } from './fixtures';

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
          '**Every chart ships an `sr-only` data table.** Axe reads an SVG as one opaque node and will score a labelled chart green whether or not the values are reachable.\n\n' +
          '**Two metrics, one y domain.** `compare` adds series against the same axes; the domain is the union of every value, because a second y axis lets an author slide two unrelated series until they appear to cross wherever the argument needs them to.\n\n' +
          '**The x labels are HTML, not SVG text.** At a 320 viewport the plot is 288px wide against a 900-unit `viewBox`, so `text-xs` inside the SVG paints at 4px. Measured in Chrome, not reasoned about.',
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
    compare: {
      control: 'object',
      description:
        'Further series drawn against the SAME axes — `{ points, label, unit }`, `label` required. Additive: `points` is still the single-series prop it always was, so no existing call site moves. Identity is a DASH PATTERN first and a `--chart-N` hue second, matched by the legend swatch, so two lines stay two lines in greyscale. Capped at five drawn series (the size of the palette); anything past that stays in the data table and the legend says how many.',
      table: { type: { summary: 'readonly ComparisonSeries[]' }, defaultValue: { summary: '[]' }, category: 'Data' },
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

export const TwoSeries: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The most-asked-for chart behaviour there is. `compare` is additive — `points` is unchanged, so nothing that already calls this component moves.\n\n' +
          'The second line is **dashed as well as differently coloured**, and the legend swatch repeats the dash. A legend of five identical bars in five hues identifies nothing in a greyscale print or to a red-green colour-blind reader — the same rule the annotation shapes follow.\n\n' +
          'The crosshair reads out BOTH series at once, from one `<output>`. There is no second, hover-only tooltip to drift out of step with it.',
      },
    },
  },
  args: {
    points: RISING,
    label: 'npm downloads',
    unit: 'downloads',
    compare: [{ points: COMPARING, label: 'Docs page views', unit: 'views' }],
  },
};

export const TwoSeriesCrosshair: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The multi-series readout under keyboard control. Both series are named and valued in the single live region, so a keyboard user gets exactly what a mouse user gets — and `RAGGED` starts a week late, so the early slots read "no data" rather than borrowing the neighbouring value.',
      },
    },
  },
  args: {
    points: RISING,
    label: 'npm downloads',
    unit: 'downloads',
    compare: [{ points: RAGGED, label: 'Registry installs', unit: 'installs' }],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const plot = canvas.getByRole('img');

    await step('Home reads out both series, naming each one', async () => {
      plot.focus();
      await userEvent.keyboard('{Home}');
      await waitFor(() => {
        const text = canvasElement.querySelector('output')?.textContent ?? '';
        expect(text).toContain('npm downloads');
        // The comparison series has no reading on day one — say so, do not
        // silently attribute the first value it does have to this date.
        expect(text).toContain('Registry installs no data');
      });
    });

    await step('End reaches a slot where both series have a value', async () => {
      await userEvent.keyboard('{End}');
      await waitFor(() =>
        expect(canvasElement.querySelector('output')?.textContent).toContain('2,205'),
      );
    });

    await step('the legend names every drawn series', async () => {
      const legend = canvasElement.querySelector('[data-slot="time-series-legend"]');
      await expect(legend?.textContent).toContain('Registry installs');
    });
  },
};

export const RaggedDates: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The x axis is the UNION of every series\' days, not the first series\'. Letting series 0 own the axis is one line cheaper and drops every reading the others took on a day it missed — silently, and only in the picture, while the data table below still lists them. A chart that disagrees with its own table is worse than no chart.',
      },
    },
  },
  args: {
    points: RAGGED,
    label: 'Registry installs',
    compare: [{ points: RISING, label: 'npm downloads' }],
    showTable: true,
  },
};

export const DifferentMagnitudes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'One y domain, always. The smaller series renders as a flat line at the floor — which is the true statement about a metric two orders of magnitude down. The fix a charting library offers here is a second y axis, and a second y axis is how two unrelated series are slid until they appear to cross wherever the argument needs them to. Give it its own chart, or a `MetricTable` row.',
      },
    },
  },
  args: {
    points: RISING,
    label: 'npm downloads',
    compare: [{ points: TINY, label: 'Paying teams' }],
  },
};

export const PaletteExhausted: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`--chart-1..5` is the whole identity palette and there are five line styles to pair with it, so five series are drawn and a sixth is not. A sixth would have to repeat both, which is two lines a reader cannot tell apart — worse than one that is not drawn. The cap is a DRAWING limit and never a data limit: the sixth series is still a column in the data table, and the legend says how many are missing from the picture.',
      },
    },
  },
  args: {
    points: RISING,
    label: 'npm downloads',
    showTable: true,
    compare: [
      { points: COMPARING, label: 'Docs page views' },
      { points: WITH_GAPS, label: 'GitHub stars' },
      { points: RAGGED, label: 'Registry installs' },
      { points: FLAT, label: 'Rules shipped' },
      { points: FALLING, label: 'Open issues' },
    ],
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

export const MinViewportAxis: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The x axis at `MIN_VIEWPORT`. The labels are HTML at a real 12px — SVG text inside this `viewBox` paints at **4px** at this width, which is why the y labels shrink and these do not (the y scale survives in the readout row below, which is also HTML).\n\n' +
          'The `play` measures the rendered boxes. jsdom reports every box as 0×0, so a unit test cannot tell whether two labels overlap; this is the only gate that can.',
      },
    },
  },
  decorators: [
    (Story) => (
      // Not Tailwind: the point of this story is a hard 320px box, and the
      // component must survive one whatever the surrounding viewport is.
      <div style={{ width: 320, outline: '1px dashed color-mix(in oklch, currentColor 25%, transparent)' }}>
        <Story />
      </div>
    ),
  ],
  args: { points: RISING, label: 'npm downloads', unit: 'downloads' },
  play: async ({ canvasElement, step }) => {
    const axis = canvasElement.querySelector('[data-slot="time-series-axis"]')!;
    const visible = [...axis.querySelectorAll('span')].filter(
      (span) => span.getBoundingClientRect().width > 0,
    );

    await step('the axis actually labels something', async () => {
      await expect(visible.length).toBeGreaterThanOrEqual(2);
    });

    await step('no two labels overlap', async () => {
      const boxes = visible.map((span) => span.getBoundingClientRect());
      for (let i = 1; i < boxes.length; i += 1) {
        await expect(boxes[i].left).toBeGreaterThan(boxes[i - 1].right);
      }
    });

    await step('the labels are legible, not viewBox-scaled to 4px', async () => {
      await expect(
        Number.parseFloat(getComputedStyle(visible[0]).fontSize),
      ).toBeGreaterThanOrEqual(11);
    });

    await step('the first label starts where the plot does', async () => {
      const svg = canvasElement.querySelector('[data-slot="time-series-plot"]')!;
      const plotBox = svg.getBoundingClientRect();
      // PAD_LEFT is 44 of 900 user units; the row pads by the same fraction.
      const expected = plotBox.left + (44 / 900) * plotBox.width;
      await expect(Math.abs(visible[0].getBoundingClientRect().left - expected)).toBeLessThan(2);
    });

    await step('nothing forces the page to scroll sideways', async () => {
      const root = document.documentElement;
      await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    });
  },
};

export const Dark: Story = {
  args: {
    points: RISING,
    annotations: ANNOTATIONS,
    label: 'npm downloads',
    compare: [{ points: COMPARING, label: 'Docs page views' }],
  },
  globals: { theme: 'dark' },
};

export const Rtl: Story = {
  args: { points: RISING, label: 'npm downloads' },
  decorators: [withRtl],
};
