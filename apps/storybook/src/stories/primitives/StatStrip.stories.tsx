import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatStrip, type StatItem } from '@interlace/ui/stat-strip';
import { DataState } from '@interlace/ui/data-state';
import { Delta } from '@interlace/ui/charts/delta';
import { withRtl } from '@/decorators';

const meta: Meta<typeof StatStrip> = {
  title: 'Primitives/StatStrip',
  component: StatStrip,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The measurement strip — a dense row of labelled numbers, mono micro-label over a `tabular-nums` value, with an optional note and an optional change. It appeared in **all six** artifacts catalogued for phase 10, hand-rolled four separate times.\n\nIt is not `StatGroup` with tighter padding. `StatGroup` renders cards: three to five numbers, each of which is the point of the page. A strip is eight to twelve numbers read as a set, where the comparison BETWEEN them is what the reader came for — so a rail instead of a border, because eight boxes at this density is a grid of frames with numbers trapped inside them.\n\nThe reason it exists is the **three-state null**. `prior: null` means there IS no prior reading: the strip shows "first measurement" and refuses to render the caller\'s `delta` node at all, so there is no path by which a missing prior surfaces as `+0%`. `value: null` means unmeasured: it renders the matching state badge, never `0` and never a bare dash.',
      },
    },
  },
  argTypes: {
    items: {
      control: false,
      description:
        'The measurements. Each carries `label`, `value`, and optionally `unit`, `note`, `prior`, `delta`, `state`.',
      table: { type: { summary: 'readonly StatItem[]' }, category: 'Data' },
    },
    cols: {
      control: 'select',
      options: [2, 3, 4, 5, 6],
      description:
        'Desktop track count. A CEILING, not a promise: every strip collapses to two tracks at the 320 floor, because six tracks on a phone gives each metric ~45px and clips the value it exists to show.',
      table: { type: { summary: '2 | 3 | 4 | 5 | 6' }, defaultValue: { summary: '4' }, category: 'Layout' },
    },
    caption: {
      control: 'text',
      description:
        'Visible caption and the strip\'s accessible name. A `<dl>` of eight numbers with no name is eight numbers from nowhere.',
      table: { type: { summary: 'ReactNode' }, category: 'Content' },
    },
    state: {
      control: 'object',
      description:
        'Strip-wide absence flags. `partial` is the `partialCoverage: true` case — it qualifies every number below as a floor, so it is announced once at the top rather than repeated per cell.',
      table: { type: { summary: 'DataStateFlags' }, category: 'State' },
    },
    announce: {
      control: 'object',
      description:
        'Context for every spoken sentence this strip emits — `noun`, `shown`, `coverage`, `reason`.',
      table: { type: { summary: 'AnnouncementOptions' }, category: 'State' },
    },
    loading: {
      control: 'boolean',
      description:
        'Render the `stat-strip` skeleton — label/value pairs on the strip\'s own grid, so the placeholder reflows at exactly the breakpoints the real strip does.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatStrip>;

const points = (values: number[]) =>
  values.map((v, i) => ({ t: `2026-07-${String(i + 1).padStart(2, '0')}`, v }));

/** The everyday case: real numbers, real priors, real deltas. */
export const Default: Story = {
  args: {
    caption: 'ecosystem · last 30 days',
    cols: 4,
    items: [
      {
        key: 'downloads',
        label: 'npm downloads',
        value: 41_820,
        prior: 38_100,
        delta: <Delta points={points([38_100, 41_820])} unit="downloads" />,
      },
      {
        key: 'stars',
        label: 'github stars',
        value: 1_284,
        prior: 1_240,
        delta: <Delta points={points([1_240, 1_284])} unit="stars" />,
      },
      {
        key: 'rules',
        label: 'shipped rules',
        value: 409,
        note: 'across 21 plugins',
      },
      {
        key: 'latency',
        label: 'p95 lint time',
        value: 812,
        unit: 'ms',
        prior: 940,
        delta: (
          <Delta points={points([940, 812])} polarity="inverse" unit="ms" />
        ),
      },
    ],
  },
};

/**
 * The three-state null, side by side. Read the third cell: it has a value and
 * no prior, so it says **first measurement** — the `delta` node passed in is
 * dropped entirely rather than being allowed to compute `+0%` against a
 * baseline that does not exist.
 */
export const ThreeStateNull: Story = {
  args: {
    caption: 'the three states a metric can be in',
    cols: 3,
    items: [
      {
        key: 'has-prior',
        label: 'value + prior',
        value: 1_240,
        prior: 1_100,
        delta: <Delta points={points([1_100, 1_240])} unit="views" />,
        note: 'a real comparison',
      },
      {
        key: 'no-prior',
        label: 'value, no prior',
        value: 1_240,
        prior: null,
        // Deliberately supplied, and deliberately never rendered.
        delta: <Delta points={points([1_240, 1_240])} unit="views" />,
        note: 'the delta above is dropped, not zeroed',
      },
      {
        key: 'no-value',
        label: 'no value at all',
        value: null,
        state: { notCounted: true },
        note: 'no run happened — not a zero',
      },
    ],
  },
};

/**
 * Every absence the vocabulary knows, in the slot where it actually appears.
 * Note that `measured zero` and `not counted` are neighbours on purpose: they
 * are the pair that four hand-rolled strips rendered identically.
 */
export const AbsenceVocabulary: Story = {
  args: {
    caption: 'absence is a value',
    cols: 4,
    items: [
      { key: 'zero', label: 'measured zero', value: 0, note: 'we ran it; the answer was none' },
      {
        key: 'not-counted',
        label: 'not counted',
        value: null,
        state: { notCounted: true },
        note: 'no run happened',
      },
      {
        key: 'n-a',
        label: 'not applicable',
        value: null,
        state: { notApplicable: true },
        announce: { reason: 'package has no test suite' },
        note: 'recedes — it was never going to have a value',
      },
      {
        key: 'first',
        label: 'first measurement',
        value: 96,
        prior: null,
        note: 'the one absence you can act on',
      },
      {
        key: 'partial',
        label: 'partial coverage',
        value: 128,
        state: { partial: true },
        announce: { coverage: '4 of 9 sources reported' },
        note: 'treat the count as a floor',
      },
      {
        key: 'truncated',
        label: 'truncated',
        value: 10,
        state: { truncated: true },
        announce: { shown: 10 },
        note: 'never a denominator',
      },
      {
        key: 'empty',
        label: 'empty',
        value: null,
        note: 'a complete result with nothing in it',
      },
      {
        key: 'error',
        label: 'failed',
        value: null,
        state: { error: 'ECONNRESET' },
        note: 'not the same as "none"',
      },
    ],
  },
};

/**
 * `partialCoverage: true` at the strip level. Announced once above the grid
 * rather than stamped on every cell — the caveat is about the collection, not
 * about any one number.
 */
export const PartialCoverage: Story = {
  args: {
    caption: 'adoption sweep',
    cols: 3,
    state: { partial: true, truncated: true },
    announce: { coverage: '68 of 102 repositories cloned', shown: 68 },
    items: [
      { key: 'repos', label: 'repos scanned', value: 68 },
      { key: 'findings', label: 'findings', value: 1_204 },
      { key: 'fps', label: 'confirmed FPs', value: 30 },
    ],
  },
};

/** Six tracks on desktop, two at the 320 floor. Resize the canvas to see it. */
export const Dense: Story = {
  args: {
    caption: 'six tracks',
    cols: 6,
    items: [
      { key: 'a', label: 'plugins', value: 21 },
      { key: 'b', label: 'rules', value: 409 },
      { key: 'c', label: 'tests', value: 12_480 },
      { key: 'd', label: 'coverage', value: 100, unit: '%' },
      { key: 'e', label: 'repos', value: 102 },
      { key: 'f', label: 'benchmarks', value: null, state: { notCounted: true } },
    ],
  },
};

export const Loading: Story = {
  args: { caption: 'loading', loading: true, items: [] },
};

/* ── Whole-strip absence ────────────────────────────────────────────────────
 *
 * `AbsenceVocabulary` above shows PER-CELL absence: a strip that exists, with
 * some cells that could not be measured. These two are the other axis — the
 * strip itself has nothing to show, or could not be fetched at all.
 *
 * `StatStrip` deliberately has no `empty` or `error` prop. An empty `items`
 * array renders an empty `<dl>`: structurally fine, and silent about whether
 * the filter matched nothing or the request failed. The composition below is
 * the intended answer — `DataState` owns the absence, `StatStrip` owns the
 * numbers, and neither grows a prop that duplicates the other.
 * ──────────────────────────────────────────────────────────────────────────── */

export const EmptyState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'No metrics at all — as against `AbsenceVocabulary`, where the strip exists and individual cells are unmeasured. `announce.noun` turns the default "No data." into "No metrics.", which is the sentence a screen reader actually gets.',
      },
    },
  },
  render: () => (
    <DataState<StatItem[]> empty data={[]} announce={{ noun: 'metrics' }}>
      {(items) => <StatStrip caption="ecosystem · last 30 days" cols={4} items={items} />}
    </DataState>
  ),
};

export const ErrorState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A failed fetch. Critically NOT the same rendering as `EmptyState`: "we asked and there are none" and "we could not ask" are different facts, and only one of them means the reader should retry. The message goes out through `role="alert"`.',
      },
    },
  },
  render: () => (
    <DataState<StatItem[]>
      error={new Error('metrics API unreachable')}
      data={undefined}
      announce={{ noun: 'metrics' }}
    >
      {(items) => <StatStrip caption="ecosystem · last 30 days" cols={4} items={items} />}
    </DataState>
  ),
};

export const EmptyStateDark: Story = { ...EmptyState, globals: { theme: 'dark' } };
export const ErrorStateDark: Story = { ...ErrorState, globals: { theme: 'dark' } };

export const Dark: Story = {
  ...AbsenceVocabulary,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...AbsenceVocabulary,
  decorators: [withRtl],
};
