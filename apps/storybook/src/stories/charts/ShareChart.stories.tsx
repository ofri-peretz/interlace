import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ShareChart, type ShareCategory, type ShareRow } from '@interlace/ui/charts/share-chart';
import { withRtl } from '@/decorators';

// An invented survey: "The new bridge has made my commute easier."
const AGREEMENT: ShareCategory[] = [
  { id: 'sd', label: 'Strongly disagree' },
  { id: 'd', label: 'Disagree' },
  { id: 'n', label: 'Neither' },
  { id: 'a', label: 'Agree' },
  { id: 'sa', label: 'Strongly agree' },
];

const BY_DISTRICT: ShareRow[] = [
  { label: 'North bank', values: { sd: 6, d: 10, n: 18, a: 38, sa: 28 }, note: '412 residents' },
  { label: 'South bank', values: { sd: 9, d: 14, n: 22, a: 33, sa: 22 }, note: '388 residents' },
  { label: 'Old town', values: { sd: 18, d: 24, n: 25, a: 21, sa: 12 }, note: '290 residents' },
  { label: 'Harbour', values: { sd: 27, d: 26, n: 19, a: 17, sa: 11 }, note: '205 residents' },
  { label: 'Hill quarter', values: { sd: 12, d: 19, n: 31, a: 24, sa: 14 }, note: '173 residents' },
];

// An invented count: how residents get to work.
const MODES: ShareCategory[] = [
  { id: 'walk', label: 'Walk' },
  { id: 'bike', label: 'Bike' },
  { id: 'bus', label: 'Bus' },
  { id: 'car', label: 'Car' },
  { id: 'other', label: 'Other', tone: 'neutral' },
];

const BY_YEAR: ShareRow[] = [
  { label: '2019', values: { walk: 1840, bike: 920, bus: 2610, car: 4380, other: 250 } },
  { label: '2021', values: { walk: 2010, bike: 1330, bus: 2240, car: 4120, other: 300 } },
  { label: '2023', values: { walk: 2150, bike: 1790, bus: 2480, car: 3320, other: 260 } },
  { label: '2025', values: { walk: 2280, bike: 2210, bus: 2690, car: 2560, other: 260 } },
];

const meta = {
  title: 'Charts/ShareChart',
  component: ShareChart,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'How a whole splits into parts, one bar per row, on one shared scale.\n\n' +
          '**Stacked** for parts with no direction (how people get to work). **Diverging** for an ordered scale with two ends (disagree to agree): one side runs to the start of a shared zero line, the other to the end, a `neutral` category straddles it, and each side\'s total is printed at its end.\n\n' +
          '**Shares, not raw numbers.** Each value is divided by its row\'s total (the sum, or `total`), so counts and percentages both work, and a row can keep a "no answer" gap honest with `total: 100`.\n\n' +
          '**Colour is never the only channel.** The legend names every category in order, each row carries a sentence with every share, and a table of values sits behind the picture (`showTable` shows it).\n\n' +
          '**Pointing at a category.** Hover a segment or a legend entry, or focus one, to dim the rest and print that share on every row; click to pin it.\n\n' +
          '**Motion.** On first view each bar grows out of its zero line once; under reduced motion the bars are simply there.\n\n' +
          '**Container, not viewport.** Wide enough, label and bar share a line; narrower, the label sits above. In a right-to-left page the bars mirror.',
      },
    },
  },
  args: {
    categories: AGREEMENT,
    rows: BY_DISTRICT,
    layout: 'diverging',
    neutral: 'n',
    sideLabels: ['Disagree', 'Agree'],
    label: '"The new bridge has made my commute easier", by district',
  },
  argTypes: {
    categories: {
      control: 'object',
      description: 'The parts in order: `{ id, label, tone? }`. For `diverging`, from one end of the scale to the other.',
      table: { type: { summary: 'readonly ShareCategory[]' }, category: 'Data' },
    },
    rows: {
      control: 'object',
      description: 'One bar per row: `{ label, values, total?, note? }`. `values` maps category ids to numbers; shares are of `total`, or of the sum.',
      table: { type: { summary: 'readonly ShareRow[]' }, category: 'Data' },
    },
    layout: { control: 'inline-radio', options: ['stacked', 'diverging'], table: { category: 'Layout' } },
    neutral: { control: 'text', description: 'Diverging: the middle category, across the zero line.', table: { category: 'Layout' } },
    split: { control: 'number', description: 'Diverging without a neutral: categories on the start side.', table: { category: 'Layout' } },
    poles: { control: 'object', description: 'Diverging: the tones of the two ends.', table: { category: 'Layout' } },
    sideLabels: { control: 'object', table: { category: 'Content' } },
    order: { control: 'inline-radio', options: ['given', 'descending'], table: { category: 'Layout' } },
    sortBy: { control: 'text', table: { category: 'Layout' } },
    label: { control: 'text', table: { category: 'Content' } },
    locale: { control: 'text', table: { category: 'Content' } },
    precision: { control: 'number', table: { category: 'Content' } },
    showTable: { control: 'boolean', table: { category: 'A11y' } },
    loading: { control: 'boolean', table: { category: 'State' } },
  },
} satisfies Meta<typeof ShareChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="max-w-192">
      <ShareChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelectorAll('[data-slot="share-chart-row"]')).toHaveLength(5);
    await expect(canvas.getByText(/^North bank: Strongly disagree 6%/)).toBeTruthy();
    await userEvent.click(canvas.getByRole('button', { name: 'Strongly agree' }));
    await expect(canvas.getByRole('button', { name: 'Strongly agree' }).getAttribute('aria-pressed')).toBe('true');
  },
};

/** Sorted by the share that agrees, largest first. */
export const Sorted: Story = {
  args: { order: 'descending' },
  render: Default.render,
};

/** Stacked counts: each value becomes a share of its year. */
export const Stacked: Story = {
  args: {
    categories: MODES,
    rows: BY_YEAR,
    layout: 'stacked',
    neutral: undefined,
    sideLabels: undefined,
    label: 'How residents get to work',
  },
  render: Default.render,
};

/** The table behind the picture, shown. */
export const WithTable: Story = { ...Stacked, args: { ...Stacked.args, showTable: true } };

/** A 360px column: each label sits above its bar. */
export const NarrowColumn: Story = {
  render: (args) => (
    <div className="w-[22.5rem] max-w-full">
      <ShareChart {...args} />
    </div>
  ),
};

/** Other poles, and one decimal place. */
export const Poles: Story = { args: { poles: [4, 5], precision: 1 }, render: Default.render };

export const Loading: Story = { args: { loading: true }, render: Default.render };

export const Empty: Story = { args: { rows: [] }, render: Default.render };

export const Dark: Story = { ...Default, play: undefined, globals: { theme: 'dark' } };

export const Rtl: Story = { ...Default, play: undefined, decorators: [withRtl] };
