import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { SeatChart, SeatChartCompare, type SeatGroup } from '@interlace/ui/charts/seat-chart';
import { withRtl } from '@/decorators';

// Invented lists for a 120-seat assembly. No real parties.
const EARLIER: SeatGroup[] = [
  { label: 'List A', seats: 32, tone: 1 },
  { label: 'List B', seats: 24, tone: 2 },
  { label: 'List C', seats: 12, tone: 3 },
  { label: 'List D', seats: 11, tone: 4 },
  { label: 'List E', seats: 8, tone: 5 },
  { label: 'List F', seats: 7, tone: 'neutral' },
  { label: 'List G', seats: 7, tone: 'neutral' },
  { label: 'List H', seats: 6, tone: 'neutral' },
  { label: 'List I', seats: 5, tone: 'neutral' },
  { label: 'List J', seats: 4, tone: 'neutral' },
  { label: 'List K', seats: 4, tone: 'neutral' },
];

const LATER: SeatGroup[] = [
  { label: 'List A', seats: 28, tone: 1 },
  { label: 'List B', seats: 27, tone: 2 },
  { label: 'List C', seats: 15, tone: 3 },
  { label: 'List D', seats: 9, tone: 4 },
  { label: 'List E', seats: 10, tone: 5 },
  { label: 'List F', seats: 8, tone: 'neutral' },
  { label: 'List G', seats: 6, tone: 'neutral' },
  { label: 'List H', seats: 6, tone: 'neutral' },
  { label: 'List I', seats: 5, tone: 'neutral' },
  { label: 'List L', seats: 4, tone: 'neutral' },
  { label: 'List M', seats: 2, tone: 'neutral' },
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
          '**Colour is never the only channel.** The legend prints each count beside its name, in wedge order; the picture carries a sentence naming the total, every group and the distance to a majority; a table of seats and shares sits behind it (`showTable` shows it).\n\n' +
          '**Motion.** The SVG is in the server HTML. The first time it scrolls into view the seats fill in once, left to right, in under a second; under reduced motion they are simply there.\n\n' +
          '**Side by side.** `SeatChartCompare` sets two or three charts next to each other once its own box is wide enough, and stacks them otherwise.',
      },
    },
  },
  args: { groups: LATER, majority: 61, label: 'Assembly, later election' },
  argTypes: {
    groups: {
      control: 'object',
      description: 'The groups in wedge order, left to right: `{ label, seats, tone? }`. `tone` is 1–5 (the chart palette) or `neutral`.',
      table: { type: { summary: 'readonly SeatGroup[]' }, category: 'Data' },
    },
    total: {
      control: 'number',
      description: 'Seats in the assembly. Defaults to the sum of the groups; any seats beyond it are drawn as outlines and counted as vacant.',
      table: { category: 'Data' },
    },
    majority: {
      control: 'number',
      description: 'Seats needed for a majority. Marked at the top of the arc and stated in the sentence. Leave out for no mark.',
      table: { category: 'Data' },
    },
    label: { control: 'text', table: { category: 'Content' } },
    seatsLabel: { control: 'text', table: { category: 'Content', defaultValue: { summary: 'seats' } } },
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

/** Two elections side by side; they stack when the box is narrow. */
export const Compare: Story = {
  render: () => (
    <SeatChartCompare>
      <SeatChart groups={EARLIER} majority={61} label="Earlier election" />
      <SeatChart groups={LATER} majority={61} label="Later election" />
    </SeatChartCompare>
  ),
};

/** The same comparison in a 360px column: stacked, legend in one column. */
export const NarrowColumn: Story = {
  render: () => (
    <div className="w-[22.5rem] max-w-full">
      <SeatChartCompare>
        <SeatChart groups={EARLIER} majority={61} label="Earlier election" />
        <SeatChart groups={LATER} majority={61} label="Later election" />
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

export const Dark: Story = { ...Compare, globals: { theme: 'dark' } };

export const Rtl: Story = { ...Default, play: undefined, decorators: [withRtl] };
