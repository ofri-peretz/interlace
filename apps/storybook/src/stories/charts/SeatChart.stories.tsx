import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { SeatChart, SeatChartCompare, type SeatGroup, type SeatSide } from '@interlace/ui/charts/seat-chart';
import { withRtl } from '@/decorators';

// Invented lists for a 120-seat assembly, largest first. No real parties.
// No tones given: the chart runs through the five hues, then the same hues a
// shade further, so all eleven lists get their own colour.
const EARLIER: SeatGroup[] = [
  { label: 'List A', seats: 32 },
  { label: 'List B', seats: 24 },
  { label: 'List C', seats: 12 },
  { label: 'List D', seats: 11 },
  { label: 'List E', seats: 8 },
  { label: 'List F', seats: 7 },
  { label: 'List G', seats: 7 },
  { label: 'List H', seats: 6 },
  { label: 'List I', seats: 5 },
  { label: 'List J', seats: 4 },
  { label: 'List K', seats: 4 },
];

const LATER: SeatGroup[] = [
  { label: 'List A', seats: 28 },
  { label: 'List B', seats: 27 },
  { label: 'List C', seats: 15 },
  { label: 'List E', seats: 10 },
  { label: 'List D', seats: 9 },
  { label: 'List F', seats: 8 },
  { label: 'List G', seats: 6 },
  { label: 'List H', seats: 6 },
  { label: 'List I', seats: 5 },
  { label: 'List L', seats: 4 },
  { label: 'List M', seats: 2 },
];

// Two invented sides; the lists in each take shades of the side's tone.
const SIDES: SeatSide[] = [
  { id: 'coalition', label: 'Coalition', tone: 3 },
  { id: 'opposition', label: 'Opposition', tone: 1 },
];

const SIDED_EARLIER: SeatGroup[] = [
  { label: 'List A', seats: 32, side: 'coalition' },
  { label: 'List B', seats: 24, side: 'opposition' },
  { label: 'List C', seats: 12, side: 'coalition' },
  { label: 'List D', seats: 11, side: 'coalition' },
  { label: 'List E', seats: 8, side: 'opposition' },
  { label: 'List F', seats: 7, side: 'coalition' },
  { label: 'List G', seats: 7, side: 'opposition' },
  { label: 'List H', seats: 6, side: 'opposition' },
  { label: 'List I', seats: 5, side: 'opposition' },
  { label: 'List J', seats: 4 },
  { label: 'List K', seats: 4, side: 'opposition' },
];

const SIDED_LATER: SeatGroup[] = [
  { label: 'List A', seats: 28, side: 'coalition' },
  { label: 'List B', seats: 27, side: 'opposition' },
  { label: 'List C', seats: 15, side: 'coalition' },
  { label: 'List D', seats: 9, side: 'coalition' },
  { label: 'List E', seats: 10, side: 'opposition' },
  { label: 'List F', seats: 8, side: 'coalition' },
  { label: 'List G', seats: 6, side: 'opposition' },
  { label: 'List H', seats: 6, side: 'opposition' },
  { label: 'List I', seats: 5, side: 'coalition' },
  { label: 'List L', seats: 4 },
  { label: 'List M', seats: 2, side: 'opposition' },
];

const meta = {
  title: 'Charts/SeatChart',
  component: SeatChart,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'How an assembly divides its seats: a half-circle of dots, one per seat, filled group by group from left to right, so each group is a wedge and the seat at the top centre is the one a majority must reach.\n\n' +
          '**One colour per list.** By default each group takes the next chart hue, and after five the hues repeat one shade further, so eleven lists stay apart in light and dark.\n\n' +
          '**Sides.** Give groups a `side` and pass `sides`: every group on a side is a shade of its tone, so the split reads first. The first side fills from the left, the last from the right, and their totals sit above the arc.\n\n' +
          '**Colour is never the only channel.** The legend prints each count beside its name, in wedge order; the picture carries a sentence naming the total, every group and the distance to a majority; a table of seats and shares sits behind it (`showTable` shows it).\n\n' +
          '**Pointing at a group.** Hover a seat or a legend entry, or focus one, to dim the rest and see its count; click to pin it.\n\n' +
          '**Motion.** The SVG is in the server HTML. The first time it scrolls into view the seats fill in once, left to right, in under a second; under reduced motion they are simply there.\n\n' +
          '**Side by side.** `SeatChartCompare` sets two or three charts next to each other once its own box is wide enough, and stacks them otherwise.',
      },
    },
  },
  args: { groups: LATER, majority: 61, label: 'Assembly, later election' },
  argTypes: {
    groups: {
      control: 'object',
      description: 'The groups in wedge order, left to right: `{ label, seats, side?, tone? }`. Without a `tone`, groups take the five chart hues in order, then the same hues a shade further, so eleven lists get eleven colours. `tone` is 1–5 or `neutral`.',
      table: { type: { summary: 'readonly SeatGroup[]' }, category: 'Data' },
    },
    total: {
      control: 'number',
      description: 'Seats in the assembly. Defaults to the sum of the groups; any seats beyond it are drawn as outlines and counted as vacant.',
      table: { category: 'Data' },
    },
    sides: {
      control: 'object',
      description: 'Sides the groups belong to: `{ id, label, tone }`. Each group on a side takes a shade of its tone; the first side fills from the left, the last from the right.',
      table: { type: { summary: 'readonly SeatSide[]' }, category: 'Data' },
    },
    tally: {
      control: 'inline-radio',
      options: ['none', 'sides', 'leaders'],
      description: 'Big totals above the arc. Defaults to `sides` when there are sides.',
      table: { category: 'Content' },
    },
    majorityLabel: { control: 'text', table: { category: 'Content' } },
    majority: {
      control: 'number',
      description: 'Seats needed for a majority. Marked at the top of the arc and stated in the sentence. Leave out for no mark.',
      table: { category: 'Data' },
    },
    label: { control: 'text', table: { category: 'Content' } },
    seatsLabel: { control: 'text', table: { category: 'Content', defaultValue: { summary: 'seats' } } },
    seatLabel: { control: 'text', description: 'The noun for a count of one.', table: { category: 'Content', defaultValue: { summary: 'seat' } } },
    showTable: { control: 'boolean', table: { category: 'A11y' } },
    loading: { control: 'boolean', table: { category: 'State' } },
  },
} satisfies Meta<typeof SeatChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="max-w-128">
      <SeatChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img').getAttribute('aria-label')).toContain('A majority is 61.');
    await expect(canvasElement.querySelectorAll('[data-slot="seat-chart-seat"]')).toHaveLength(120);
  },
};

/**
 * Sides: each list takes a shade of its side's tone, the first side fills
 * from the left and the last from the right, and their totals sit above the
 * arc. Hover a list or a seat, or focus a legend entry, to pick a list out.
 */
export const Sides: Story = {
  args: { groups: SIDED_LATER, sides: SIDES, majority: 61, label: 'Assembly, later election' },
  render: (args) => (
    <div className="max-w-128">
      <SeatChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelector('[data-slot="seat-chart-tally"]')?.textContent).toBe('Coalition65Opposition51');
    await expect(canvas.getByRole('img').getAttribute('aria-label')).toContain('Coalition holds a majority.');
  },
};

/** Two elections by side, side by side; they stack when the box is narrow. */
export const CompareSides: Story = {
  render: () => (
    <SeatChartCompare>
      <SeatChart groups={SIDED_EARLIER} sides={SIDES} majority={61} label="Earlier election" />
      <SeatChart groups={SIDED_LATER} sides={SIDES} majority={61} label="Later election" />
    </SeatChartCompare>
  ),
};

/** Without sides, the two largest lists can lead instead. */
export const Leaders: Story = {
  args: { tally: 'leaders' },
  render: (args) => (
    <div className="max-w-128">
      <SeatChart {...args} />
    </div>
  ),
};

/** Two elections side by side; they stack when the box is narrow. */
export const Compare: Story = {
  render: () => (
    <SeatChartCompare>
      <SeatChart groups={EARLIER} majority={61} label="Earlier election" />
      <SeatChart groups={LATER} majority={61} label="Later election" />
    </SeatChartCompare>
  ),
};

/** The comparison by side in a 360px column: stacked, legend in one column. */
export const NarrowColumn: Story = {
  render: () => (
    <div className="w-[22.5rem] max-w-full">
      <SeatChartCompare>
        <SeatChart groups={SIDED_EARLIER} sides={SIDES} majority={61} label="Earlier election" />
        <SeatChart groups={SIDED_LATER} sides={SIDES} majority={61} label="Later election" />
      </SeatChartCompare>
    </div>
  ),
};

/** The table behind the picture, shown. */
export const WithTable: Story = {
  args: { showTable: true },
  render: (args) => (
    <div className="max-w-128">
      <SeatChart {...args} />
    </div>
  ),
};

/** Seats no group holds are outlines, counted as vacant. */
export const VacantSeats: Story = {
  args: {
    groups: [
      { label: 'List A', seats: 40, tone: 1 },
      { label: 'List B', seats: 35, tone: 2 },
      { label: 'List C', seats: 30, tone: 3 },
    ],
    total: 120,
  },
  render: (args) => (
    <div className="max-w-128">
      <SeatChart {...args} />
    </div>
  ),
};

/** A large chamber: the rows multiply and the seats shrink to fit. */
export const LargeAssembly: Story = {
  args: {
    groups: [
      { label: 'Bloc A', seats: 260, tone: 1 },
      { label: 'Bloc B', seats: 210, tone: 3 },
      { label: 'Bloc C', seats: 90, tone: 2 },
      { label: 'Bloc D', seats: 60, tone: 4 },
      { label: 'Others', seats: 30, tone: 'neutral' },
    ],
    majority: 326,
    label: 'A 650-seat chamber',
  },
  render: (args) => (
    <div className="max-w-168">
      <SeatChart {...args} />
    </div>
  ),
};

export const Loading: Story = {
  args: { loading: true },
  render: (args) => (
    <div className="max-w-128">
      <SeatChart {...args} />
    </div>
  ),
};

export const Dark: Story = { ...CompareSides, globals: { theme: 'dark' } };

export const Rtl: Story = { ...Default, play: undefined, decorators: [withRtl] };
