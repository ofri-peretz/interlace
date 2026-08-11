import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Distribution } from '@interlace/ui/charts/distribution';
import { withRtl } from '@/decorators';

import { AUDIENCE_CLOCK, AUDIENCE_CLOCK_WITH_GAPS, BY_WEEKDAY } from './fixtures';

const meta: Meta<typeof Distribution> = {
  title: 'Charts/Distribution',
  component: Distribution,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One quantity spread across a fixed set of bins — hours of the day, days of the week, cohorts, buckets — with an optional REFERENCE distribution drawn over it.\n\n' +
          '**Why not `TimeSeries` with three more props.** Its axis keys are `day(t)`, sorted: a calendar. Bins are names, and sorting `[Thu, Fri, Sat]` gives `[Fri, Sat, Thu]` — a week that does not exist. A line asserts the metric passed through every value between two samples, and between two hourly aggregates there is nothing to pass through. And `delta()` — first → last — is arithmetic performed on a circle when the axis is cyclical.\n\n' +
          '**The reference is the point.** A distribution alone answers "when did this happen". The question worth asking is "when did this happen *against what was available*". The gap between the bars and the step IS the finding.\n\n' +
          '**One y domain, always.** Same rule as `TimeSeries`: two axes let an author slide one series against the other until they cross where the argument needs them to. So the reference must be in the same unit as the bars — usually both as shares of their own denominator. Converting is the caller\'s job, not a second axis.\n\n' +
          '**An unmeasured bin is not an empty bin.** This is where a bar chart is most dangerous: a bar of height zero and a bar that was never drawn are the same picture. A `null` bin therefore hatches — the same mark `not-counted` carries in `DataStateBadge` and `Meter` — and the accessible sentence counts the gaps out loud.\n\n' +
          '**The bar axis starts at zero and cannot be told not to.** On an axis starting at 3,412 a bar twice as long is a value 2.5% larger.',
      },
    },
  },
  argTypes: {
    bins: {
      control: 'object',
      description:
        '`{ label, v, note?, reference? }`, in the order they belong on the axis — that order IS the axis, and nothing here sorts it. `v: null` is a bin nobody measured and hatches rather than drawing a zero-length bar. `reference` lives on the bin rather than in a parallel array because a parallel array is a silent off-by-one: every bar would line up against its neighbour\'s reference.',
      table: { type: { summary: 'readonly DistributionBin[]' }, category: 'Data' },
    },
    label: {
      control: 'text',
      description:
        'Name of the plotted quantity. One string does four jobs — figcaption, accessible label, legend entry and data-table column — so they cannot drift apart.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    referenceLabel: {
      control: 'text',
      description:
        'Names the reference overlay, which is drawn whenever any bin carries a `reference`. An unnamed second series is a second line the reader cannot identify.',
      table: { type: { summary: 'string' }, defaultValue: { summary: "'Reference'" }, category: 'Data' },
    },
    unit: {
      control: 'text',
      description: 'Noun appended to the readout and the accessible sentence — "14:00 · 9.4 %".',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    binLabel: {
      control: 'text',
      description: 'Column header for the bin column of the data table — "Hour", "Weekday".',
      table: { type: { summary: 'string' }, defaultValue: { summary: "'Bin'" }, category: 'Data' },
    },
    height: {
      control: { type: 'range', min: 120, max: 480, step: 20 },
      description:
        'Drawing height in user units. The rendered width always follows the container (the plot is `viewBox`-sized), so this is really the aspect-ratio knob.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '220' }, category: 'Appearance' },
    },
    showTable: {
      control: 'boolean',
      description:
        'Render the data table visibly instead of `sr-only`. It carries both series and both axis readings, so it is a lossless copy of the picture.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'Appearance' },
    },
    loading: {
      control: 'boolean',
      description:
        'Reserve the chart box. Checked before every "nothing to draw" branch — "no bins" while the request is in flight is a claim the reader cannot check.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    error: {
      control: 'text',
      description:
        'The fetch failed. A different STATEMENT from "every bin is empty", which is a real finding about the subject — this is a fact about the request. Ranked directly under `loading`, per `DATA_STATES`.',
      table: { type: { summary: 'unknown' }, category: 'State' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The chart this component was extracted from: the one dashboard element that
 * could not be converted onto the design system.
 */
export const AudienceClock: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Where the week\'s reading actually happened (bars) against how much of the readership was awake at that hour (step). The gap between them is the entire point: where the step is high and the bars are low is an unserved window.\n\n' +
          'Both series are percentages, which is what lets them share one domain honestly. The bars are shares of the week\'s reading and sum to 100; the step is the share of readers awake at that hour and does not — those shares overlap. Saying so is the caller\'s job, and the reason the component refuses a second y axis.',
      },
    },
  },
  args: {
    bins: AUDIENCE_CLOCK,
    label: 'Share of reading',
    referenceLabel: 'Readers awake',
    unit: '%',
    binLabel: 'Hour (UTC)',
    height: 240,
  },
};

/**
 * The second axis family, printed rather than toggled.
 */
export const TwoAxisFamilies: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Every hand-rolled clock chart has a UTC/local toggle. A toggle shows one axis and hides the other, so a reader comparing their own morning against a UTC peak has to hold one of the two in their head — and the hidden one is missing from any screenshot of the chart.\n\n' +
          '`note` prints the second reading under the first. It travels into the crosshair readout and into the data table too, so the pair is never separated.',
      },
    },
  },
  args: {
    bins: AUDIENCE_CLOCK,
    label: 'Share of reading',
    referenceLabel: 'Readers awake',
    unit: '%',
    showTable: true,
    binLabel: 'Hour (UTC / +03:00)',
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('the axis prints both readings', async () => {
      // 13:00 UTC is one of the eight labelled slots; 16:00 is the same
      // instant three hours east.
      const axis = canvasElement.querySelector('[data-slot="distribution-axis"]')!;
      await expect(axis.textContent).toContain('13:00');
      await expect(axis.textContent).toContain('16:00');
    });

    await step('and the data table keeps them together', async () => {
      await expect(canvas.getByRole('rowheader', { name: '12:00 (15:00)' })).toBeTruthy();
    });
  },
};

/**
 * A gap is not a zero — the rule `charts/scale.ts` has always encoded, drawn.
 */
export const UnmeasuredBins: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Two hours nobody measured. Elsewhere in this package a `null` can simply be dropped; here dropping it silently asserts a zero, because a bar of height zero and a bar that was never drawn are the same picture. So the slot hatches — `--viz-axis` at 3.49:1 light / 3.83:1 dark, clearing SC 1.4.11 for non-text content — and the accessible sentence counts the gaps, because a hatch that exists only in pixels is worse than no hatch at all.',
      },
    },
  },
  args: {
    bins: AUDIENCE_CLOCK_WITH_GAPS,
    label: 'Share of reading',
    referenceLabel: 'Readers awake',
    unit: '%',
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('the unmeasured slots are drawn, not skipped', async () => {
      await expect(
        canvasElement.querySelectorAll('[data-slot="distribution-gap"]').length,
      ).toBe(2);
    });

    await step('and they are audible, not only visible', async () => {
      await expect(canvas.getByRole('img').getAttribute('aria-label')).toContain(
        '2 bins not measured',
      );
    });
  },
};

export const CategoricalOrder: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Seven bins whose order is not their alphabetical order. Sorted, this table reads Fri, Mon, Sat, Sun, Thu, Tue, Wed — and would then disagree with the picture directly above it about what order the week happens in. `SeriesTable` takes `axis="category"` for exactly this, which also stops it truncating a bin name to ten characters the way a date key does.',
      },
    },
  },
  args: {
    bins: BY_WEEKDAY,
    label: 'Deploys',
    unit: 'deploys',
    binLabel: 'Weekday',
    showTable: true,
  },
  play: async ({ canvasElement }) => {
    const headers = [...canvasElement.querySelectorAll('tbody th')].map((h) => h.textContent);
    await expect(headers).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  },
};

export const KeyboardCrosshair: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Focus the plot and press ArrowRight. Axe cannot press a key, so a hover-only chart scores green while its values exist for mouse users and for nobody else. The pointer path resolves through `slotAt` — band containment, because a bar owns its whole band — and the keyboard steps the same index, so the two cannot disagree.',
      },
    },
  },
  args: {
    bins: AUDIENCE_CLOCK_WITH_GAPS,
    label: 'Share of reading',
    referenceLabel: 'Readers awake',
    unit: '%',
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const plot = canvas.getByRole('img');

    await step('the plot is reachable by keyboard at all', async () => {
      plot.focus();
      await expect(document.activeElement).toBe(plot);
    });

    await step('Home reads out the first bin, naming both series', async () => {
      await userEvent.keyboard('{Home}');
      await waitFor(() => {
        const text = canvasElement.querySelector('output')?.textContent ?? '';
        expect(text).toContain('Share of reading');
        expect(text).toContain('Readers awake');
      });
    });

    await step('an unmeasured bin reads "not measured", never zero', async () => {
      await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
      await waitFor(() =>
        expect(canvasElement.querySelector('output')?.textContent).toContain(
          'Share of reading not measured',
        ),
      );
    });

    await step('Escape clears the crosshair (WCAG 2.1.2)', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(canvasElement.querySelector('output')?.textContent).toBe(''));
    });
  },
};

export const NoReference: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Without a reference there is no legend — it would restate the figcaption directly beneath it — and the readout drops the series name for the same reason.',
      },
    },
  },
  args: { bins: BY_WEEKDAY, label: 'Deploys', unit: 'deploys', binLabel: 'Weekday' },
};

export const NoBins: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'No bins at all, which is NOT the same as an axis whose bins were never measured — that case (see `UnmeasuredBins`) draws a full plot of hatch, because "we looked at all 24 hours and measured none of them" is a finding and an empty box is not.',
      },
    },
  },
  args: { bins: [], label: 'Deploys' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No bins to plot/i)).toBeTruthy();
  },
};

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Reserves the box the chart will occupy. Checked before every absence branch: "no bins to plot" while the request is still in flight is a claim the reader cannot check.',
      },
    },
  },
  args: { bins: [], label: 'Share of reading', loading: true },
};

export const FetchFailed: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '**A failed fetch is not a flat distribution.** `DATA_STATES` ranks `error` above `empty` because they are different claims: an empty result is a statement about the subject and a reader can act on it; a failed request is a statement about the request and licenses nothing. This is `role="alert"` in `--destructive`, not the muted empty-state line, and the sentence comes from `announceDataState` so it cannot drift from what every other surface says.',
      },
    },
  },
  args: {
    bins: AUDIENCE_CLOCK,
    label: 'Share of reading',
    error: 'ECONNRESET',
    announce: { noun: 'reading hours' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert').textContent).toMatch(/could not be loaded/i);
    // The empty copy must never stand in for this.
    await expect(canvas.queryByText(/No bins to plot/i)).toBeNull();
  },
};

export const FetchFailedDark: Story = {
  ...FetchFailed,
  globals: { theme: 'dark' },
};

export const MinViewport: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A 24-bin clock in a hard 320px box. The label row is one flex cell per bin, so a label stays centred under its own band at every width without an inline style, and below `sm` the MIDDLE labels drop — never an end, because the ends are the range.\n\n' +
          'The `play` measures rendered boxes. jsdom reports every box as 0×0, so a unit test cannot tell whether two labels overlap; this is the only gate that can.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320, outline: '1px dashed color-mix(in oklch, currentColor 25%, transparent)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    bins: AUDIENCE_CLOCK,
    label: 'Share of reading',
    referenceLabel: 'Readers awake',
    unit: '%',
  },
  play: async ({ canvasElement, step }) => {
    const axis = canvasElement.querySelector('[data-slot="distribution-axis"]')!;
    const visible = [...axis.querySelectorAll(':scope > span > span')].filter(
      (span) => span.getBoundingClientRect().width > 0,
    );

    await step('the axis still labels something', async () => {
      await expect(visible.length).toBeGreaterThanOrEqual(2);
    });

    await step('no two labels overlap', async () => {
      const boxes = visible.map((span) => span.getBoundingClientRect());
      for (let i = 1; i < boxes.length; i += 1) {
        await expect(boxes[i].left).toBeGreaterThanOrEqual(boxes[i - 1].right);
      }
    });

    await step('the labels are legible, not viewBox-scaled to 4px', async () => {
      await expect(
        Number.parseFloat(getComputedStyle(visible[0]).fontSize),
      ).toBeGreaterThanOrEqual(11);
    });

    await step('nothing forces the page to scroll sideways', async () => {
      const root = document.documentElement;
      await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    });
  },
};

export const Dark: Story = {
  ...AudienceClock,
  globals: { theme: 'dark' },
};

export const Rtl: Story = {
  args: {
    bins: BY_WEEKDAY,
    label: 'Deploys',
    unit: 'deploys',
  },
  decorators: [withRtl],
};
