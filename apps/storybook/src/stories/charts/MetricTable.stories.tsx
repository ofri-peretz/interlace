import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
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
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { rows: METRIC_ROWS, caption: 'Ecosystem metrics — last 14 days' },
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
    const canvas = within(canvasElement);

    await step('a row selects from the keyboard', async () => {
      const rows = canvasElement.querySelectorAll<HTMLElement>('[data-slot="metric-table-row"]');
      rows[3].focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(rows[3]).toHaveAttribute('aria-selected', 'true'));
    });

    await step('the promoted metric is the one now charted', async () => {
      await waitFor(() => expect(canvas.getByText(/Open issues/)).toBeTruthy());
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

export const Dark: Story = {
  args: { rows: METRIC_ROWS, caption: 'Ecosystem metrics' },
  decorators: [withDark],
};

export const Rtl: Story = {
  args: { rows: METRIC_ROWS, caption: 'Ecosystem metrics' },
  decorators: [withRtl],
};
