import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { MetricTable } from '@interlace/ui/charts/metric-table';
import { TimeSeries } from '@interlace/ui/charts/time-series';
import { withDark, withRtl } from '@/decorators';

import { ANNOTATIONS, METRIC_ROWS } from './fixtures';

const meta: Meta<typeof MetricTable> = {
  title: 'Charts/MetricTable',
  component: MetricTable,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The roic.ai row: metric name, values across time, sparkline, delta.\n\n' +
          '**This is the centrepiece of the package, not the chart.** roic.ai did not build 186 visualisations — they built ONE row and repeated it, then let a click promote any row into the chart above. Density is the product: the eye scans a column of rows and reads a decade. Anything that looks like a new chart type should first be attempted as a new ROW.\n\n' +
          'It is a real `<table>` — `<th scope="row">` per metric, `<th scope="col">` per date — so a screen reader announces "Open issues, 2026-07-03, 81" instead of a bare number.\n\n' +
          'Selection is owned by the caller so the selected metric can live in the URL and a view can be linked to a colleague.',
      },
    },
  },
  argTypes: {
    rows: {
      control: 'object',
      description:
        'One entry per metric: `{ key, label, points, polarity?, unit? }`. `points` is the full history — the table shows the last `maxColumns` dates, the sparkline and the `sr-only` table keep the rest, so nothing is dropped.',
      table: { type: { summary: 'readonly MetricRow[]' }, category: 'Data' },
    },
    caption: {
      control: 'text',
      description:
        'The `<caption>`. Required — an unnamed table of numbers is a wall of numbers. When the table is selectable it also carries the sr-only "press Enter or Space on a focused row" instruction.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    maxColumns: {
      control: { type: 'range', min: 2, max: 14, step: 1 },
      description:
        'How many date columns to show. Defaults to 6, not 8: at 8 the dates consumed the whole width at a typical content measure and pushed trend and change off the right edge — the two columns the reader actually came for. Individual dates are the least valuable cells in the row, so they give up space first.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '6' }, category: 'Appearance' },
    },
    selected: {
      control: 'text',
      description:
        'The `key` of the highlighted row, or `null`. Deliberately NOT internal state — the selected metric belongs in the URL so a view can be linked to a colleague. Type a key here (e.g. `issues`) to see the selected row style.',
      table: { type: { summary: 'string | null' }, defaultValue: { summary: 'null' }, category: 'State' },
    },
    onSelect: {
      action: 'select',
      description:
        'Called with the row `key` on click and on Enter/Space over a focused row. Passing it is what makes rows focusable at all. Note the row will not highlight until the caller feeds the key back through `selected` — that round trip is the point.',
      table: { type: { summary: '(key: string) => void' }, category: 'Events' },
    },
    loading: {
      control: 'boolean',
      description:
        'Render a `<Skeleton variant="metric-table" />` — header row plus body rows at the width the data will occupy.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the scroll container. The table scrolls horizontally inside its own box; the page never does.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    rows: METRIC_ROWS,
    caption: 'Ecosystem metrics — last 14 days',
    maxColumns: 6,
    selected: null,
    loading: false,
  },
};

export const Polarity: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '"Good" is not a property of a number. **Open issues** falls and reads as positive because it declares `polarity: "inverse"`; every other row uses the default. Without it a dashboard cheerfully paints a regression green.',
      },
    },
  },
  args: { rows: METRIC_ROWS, caption: 'Mixed polarity' },
  play: async ({ canvasElement }) => {
    const tones = [...canvasElement.querySelectorAll('[data-slot="delta"]')].map((d) =>
      d.getAttribute('data-tone'),
    );
    // downloads up = good · stars up = good · rules flat · issues down = good
    await expect(tones).toEqual(['good', 'good', 'flat', 'good']);
  },
};

export const Selectable: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Rows select by click AND by Enter/Space on a focused row. A click handler alone would make the whole table mouse-only — the failure axe cannot see.',
      },
    },
  },
  render: function Selectable() {
    const [selected, setSelected] = React.useState<string | null>('downloads');
    const row = METRIC_ROWS.find((r) => r.key === selected);
    return (
      <div className="flex w-full max-w-content flex-col gap-6">
        {row ? (
          <TimeSeries
            points={row.points}
            annotations={ANNOTATIONS}
            label={row.label}
            unit={row.unit}
          />
        ) : null}
        <MetricTable
          rows={METRIC_ROWS}
          caption="Click or press Enter on a row to promote it into the chart"
          selected={selected}
          onSelect={(key) => setSelected((current) => (current === key ? null : key))}
        />
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    await step('a row selects from the keyboard', async () => {
      const rows = canvasElement.querySelectorAll<HTMLElement>('[data-slot="metric-table-row"]');
      rows[3].focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(rows[3]).toHaveAttribute('aria-selected', 'true'));
    });

    await step('the promoted metric is the one now charted', async () => {
      // Assert on the CHART'S OWN CAPTION, not on canvas text. "Open issues"
      // appears at least four times once promoted — the metric table's row
      // header, plus the chart's figcaption, its sr-only data-table <caption>
      // and that table's <th>. A getByText for it therefore always threw
      // "Found multiple elements", and scoping to `[data-slot="time-series"]`
      // is not enough because three of the four live inside the chart.
      // The figcaption is the single node that names what got promoted.
      await waitFor(() => {
        const caption = canvasElement.querySelector('[data-slot="time-series"] figcaption');
        expect(caption?.textContent).toMatch(/Open issues/);
      });
    });
  },
};

export const Sparse: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A gap is spelled out, not left as an em dash — a screen reader announces "—" as nothing at all.',
      },
    },
  },
  args: { rows: METRIC_ROWS.slice(1, 2), caption: 'A metric with holes', maxColumns: 6 },
};

export const Loading: Story = {
  parameters: {
    docs: { description: { story: 'Header row plus rows, at the width the data will occupy.' } },
  },
  args: { rows: [], caption: 'Ecosystem metrics', loading: true },
};

export const Dark: Story = {
  args: { rows: METRIC_ROWS, caption: 'Ecosystem metrics' },
  decorators: [withDark],
};

export const Rtl: Story = {
  args: { rows: METRIC_ROWS, caption: 'Ecosystem metrics' },
  decorators: [withRtl],
};
