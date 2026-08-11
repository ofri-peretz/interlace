import type { Meta, StoryObj } from '@storybook/react-vite';
import { Meter, RankedBarList } from '@interlace/ui/meter';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Meter> = {
  title: 'Primitives/Meter',
  component: Meter,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'ONE inline bar, absorbing three that were hand-rolled separately across the phase-10 corpus: an odds bar, a score meter and a reviewer bar.\n\n**Magnitude is carried by length AND by the printed number, never by hue.** The value is not optional — colour answers "is this good", never "how big". A consequence worth stating: the fill is clamped to the track, so a value over its stated maximum draws full and the overage is visible only in the number.\n\nTwo absences, drawn differently on purpose. **`hatch`** is *uncountable* — no run happened, so the track is hatched end to end with no fill, because a fill of zero length is indistinguishable from a measured zero. It is the DEFAULT for `value: null`; you have to work to make this component draw an empty bar for missing data. **`dead`** is *dormant* — real but no longer live, receding without vanishing, because a dormant row still holds its rank.\n\n`RankedBarList` is the repeated-row composition, and it supports a **log scale** because one artifact encodes reach logarithmically so a 10k row and a 10M row can share an axis. It is opt-in and it is labelled: an unlabelled log axis flatters every small row on the list.',
      },
    },
  },
  argTypes: {
    value: {
      control: 'number',
      description:
        '`null` means UNMEASURED and renders the hatch. It does not render a zero-length bar — a zero-length bar and a measured zero are the same picture.',
      table: { type: { summary: 'number | null' }, category: 'Data' },
    },
    max: {
      control: 'number',
      description:
        'The denominator. `null` means there is no stated maximum, so no fraction can be computed and the bar hatches — a bar without a denominator is a length with no scale behind it.',
      table: { type: { summary: 'number | null' }, category: 'Data' },
    },
    fraction: {
      control: 'number',
      description:
        'Override the computed fill, `0..1`. For the odds-bar case where the ratio being drawn is not `value / max`.',
      table: { type: { summary: 'number | null' }, category: 'Data' },
    },
    scale: {
      control: 'inline-radio',
      options: ['linear', 'log'],
      description:
        'Log is opt-in. It flatters small numbers, so `RankedBarList` prints "log scale" beside the caption whenever it is on.',
      table: { type: { summary: "'linear' | 'log'" }, defaultValue: { summary: 'linear' }, category: 'Scale' },
    },
    variant: {
      control: 'inline-radio',
      options: ['default', 'hatch', 'dead'],
      description:
        'Defaults to `hatch` whenever the value or the denominator is missing. Name it explicitly for the case where a number exists but must not be counted.',
      table: { type: { summary: 'MeterVariant' }, category: 'Appearance' },
    },
    tone: {
      control: 'inline-radio',
      options: ['default', 'positive', 'negative', 'neutral'],
      description:
        'What the fill MEANS. Never how big it is — two values at the same tone differ only in width.',
      table: { type: { summary: 'MeterTone' }, defaultValue: { summary: 'default' }, category: 'Appearance' },
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md'],
      table: { type: { summary: "'sm' | 'md'" }, defaultValue: { summary: 'md' }, category: 'Appearance' },
    },
    state: {
      control: 'object',
      description: 'Absence flags for this row, over and above the value being `null`.',
      table: { type: { summary: 'DataStateFlags' }, category: 'State' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Meter>;

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="font-mono text-ui-sm uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    {children}
  </div>
);

export const Default: Story = {
  args: {
    label: 'Statement coverage',
    value: 96,
    max: 100,
    unit: '%',
    className: 'w-[420px] max-w-full',
  },
};

/**
 * The three bars this component replaced, next to each other. They differed in
 * tone and in what the denominator meant; they did not differ in anything that
 * justified three components.
 */
export const ThreeBarsInOne: Story = {
  render: () => (
    <div className="flex w-[420px] max-w-full flex-col gap-6">
      <Row label="odds bar — an explicit fraction">
        <Meter
          label="Merge odds"
          value={3}
          max={4}
          fraction={0.75}
          display="3 in 4"
          tone="positive"
        />
      </Row>
      <Row label="score meter — a bounded percentage">
        <Meter label="Gate score" value={8.7} max={10} display="8.7 / 10" />
      </Row>
      <Row label="reviewer bar — a count against a peer maximum">
        <Meter label="Reviewer: technical" value={412} max={980} unit="findings" />
      </Row>
    </div>
  ),
};

/**
 * The pair that matters. A measured zero draws an empty bar; an unmeasured row
 * hatches and has no fill at all. Turn the page greyscale and the distinction
 * survives, because it is texture and text rather than hue.
 */
export const ZeroIsNotMissing: Story = {
  render: () => (
    <div className="flex w-[420px] max-w-full flex-col gap-6">
      <Row label="measured zero — we ran it, the answer was none">
        <Meter label="Findings" value={0} max={120} unit="findings" />
      </Row>
      <Row label="not counted — no run happened">
        <Meter label="Findings" value={null} max={120} unit="findings" />
      </Row>
      <Row label="dormant — real, no longer live, still holds its rank">
        <Meter label="Findings" value={44} max={120} unit="findings" variant="dead" />
      </Row>
      <Row label="no denominator — a length with no scale behind it">
        <Meter label="Findings" value={44} max={null} unit="findings" />
      </Row>
    </div>
  ),
};

/** Tone answers "is this good". It never answers "how big". */
export const Tones: Story = {
  render: () => (
    <div className="flex w-[420px] max-w-full flex-col gap-6">
      <Meter label="Coverage" value={96} max={100} unit="%" tone="positive" />
      <Meter label="False positives" value={30} max={100} tone="negative" />
      <Meter label="Rules" value={409} max={500} tone="neutral" />
      <Meter label="Adoption" value={68} max={102} unit="repos" />
    </div>
  ),
};

export const Loading: Story = {
  args: { label: 'Coverage', value: null, loading: true, className: 'w-[420px] max-w-full' },
};

// ── RankedBarList ───────────────────────────────────────────────────────────

const reach = [
  { key: 'npm', label: 'npm registry', value: 10_400_000, unit: 'downloads' },
  { key: 'gh', label: 'github', value: 486_000, unit: 'views' },
  { key: 'devto', label: 'dev.to', value: 91_400, unit: 'views' },
  { key: 'blog', label: 'ofriperetz.dev', value: 10_200, unit: 'views' },
  { key: 'talks', label: 'conference talks', value: null, unit: 'attendees' },
];

/**
 * A linear axis is the honest default, and it is brutal: at 10.4M the top row
 * owns the track and everything under 1% of it is a hairline. That hairline is
 * a true statement about the data — and it is also unreadable, which is the
 * problem the next story solves.
 */
export const RankedLinear: StoryObj<typeof RankedBarList> = {
  render: () => (
    <div className="w-[520px] max-w-full">
      <RankedBarList caption="reach by surface · 90 days" rows={reach} />
    </div>
  ),
};

/**
 * The same rows on a log axis. Both the 10.4M row and the 10.2k row are
 * legible and the ordering survives, which is what a ranked list is for. The
 * "log scale" chip is not decoration — an unlabelled log axis is an argument
 * disguised as a measurement.
 */
export const RankedLog: StoryObj<typeof RankedBarList> = {
  render: () => (
    <div className="w-[520px] max-w-full">
      <RankedBarList caption="reach by surface · 90 days" rows={reach} scale="log" />
    </div>
  ),
};

/**
 * Truncated and partially covered at once. The list is wrong twice and says so
 * twice — a resolver that returned a single winner would drop the second fact.
 */
export const RankedTruncated: StoryObj<typeof RankedBarList> = {
  render: () => (
    <div className="w-[520px] max-w-full">
      <RankedBarList
        caption="top 5 of an unknown total"
        rows={reach}
        scale="log"
        state={{ truncated: true, partial: true }}
        announce={{ shown: 5, coverage: '3 of 7 surfaces reported' }}
      />
    </div>
  ),
};

/** Nothing in the list was measured, so no row pretends to be zero. */
export const RankedAllUnmeasured: StoryObj<typeof RankedBarList> = {
  render: () => (
    <div className="w-[520px] max-w-full">
      <RankedBarList
        caption="not yet instrumented"
        rows={[
          { key: 'a', label: 'newsletter', value: null },
          { key: 'b', label: 'podcast', value: null },
          { key: 'c', label: 'workshops', value: null },
        ]}
      />
    </div>
  ),
};

export const RankedLoading: StoryObj<typeof RankedBarList> = {
  render: () => (
    <div className="w-[520px] max-w-full">
      <RankedBarList caption="reach by surface" rows={[]} loading loadingRows={5} />
    </div>
  ),
};

export const Dark: Story = {
  ...ZeroIsNotMissing,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...ZeroIsNotMissing,
  decorators: [withRtl],
};
