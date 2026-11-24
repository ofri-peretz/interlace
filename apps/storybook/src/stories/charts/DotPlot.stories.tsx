import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { DotPlot, type DotRow, type DotSeries } from '@interlace/ui/charts/dot-plot';
import { withRtl } from '@/decorators';

// An invented survey: "I would use a new night bus", by age, in two years.
const YEARS: DotSeries[] = [
  { id: 'before', label: 'Year one' },
  { id: 'after', label: 'Year two' },
];

const BY_AGE: DotRow[] = [
  { label: '18 to 29', values: { before: 0.48, after: 0.67 }, note: '312 people' },
  { label: '30 to 44', values: { before: 0.44, after: 0.58 }, note: '401 people' },
  { label: '45 to 59', values: { before: 0.39, after: 0.46 }, note: '377 people' },
  { label: '60 to 74', values: { before: 0.31, after: 0.33 }, note: '298 people' },
  { label: '75 and over', values: { before: 0.27, after: 0.24 }, note: '121 people' },
];

// An invented price check: one basket in three cities.
const CITIES: DotSeries[] = [
  { id: 'a', label: 'River City' },
  { id: 'b', label: 'Port Town' },
  { id: 'c', label: 'Hill Town' },
];

const BASKET: DotRow[] = [
  { label: 'Bread', values: { a: 2.1, b: 2.6, c: 2.3 } },
  { label: 'Milk, 1 litre', values: { a: 1.2, b: 1.5, c: 1.1 } },
  { label: 'Coffee, 250 g', values: { a: 5.4, b: 6.9, c: 6.1 } },
  { label: 'Apples, 1 kg', values: { a: 3.2, b: 2.8, c: null } },
];

const meta = {
  title: 'Charts/DotPlot',
  component: DotPlot,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One dot per value on a shared axis, one row per thing compared. With two or more series, a line joins each row\'s dots: its length is the gap, its direction the change.\n\n' +
          '**Dots, not bars,** when values cluster far from zero or when two values per row are compared: the axis does not have to start at zero, and the reader compares positions.\n\n' +
          '**Shape as well as colour.** The first series is a hollow ring, the others are filled. The legend names them, each row has a sentence, and a table sits behind the picture.\n\n' +
          '**Pointing at a series** dims the others and prints its value at the end of every row; click a legend entry to pin it.\n\n' +
          '**Motion.** On first view each line draws from the first dot towards the last, once; under reduced motion it is simply there.',
      },
    },
  },
  args: {
    series: YEARS,
    rows: BY_AGE,
    format: { style: 'percent', maximumFractionDigits: 0 },
    locale: 'en-US',
    label: '"I would use a new night bus", by age (invented data)',
  },
  argTypes: {
    series: { control: 'object', table: { type: { summary: 'readonly DotSeries[]' }, category: 'Data' } },
    rows: { control: 'object', table: { type: { summary: 'readonly DotRow[]' }, category: 'Data' } },
    domain: { control: 'object', table: { category: 'Axis' } },
    order: { control: 'inline-radio', options: ['given', 'descending', 'change'], table: { category: 'Layout' } },
    format: { control: 'object', table: { category: 'Content' } },
    locale: { control: 'text', table: { category: 'Content' } },
    label: { control: 'text', table: { category: 'Content' } },
    showTable: { control: 'boolean', table: { category: 'A11y' } },
    loading: { control: 'boolean', table: { category: 'State' } },
  },
} satisfies Meta<typeof DotPlot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="max-w-192">
      <DotPlot {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelectorAll('[data-slot="dot-plot-row"]')).toHaveLength(5);
    await userEvent.click(canvas.getByRole('button', { name: 'Year one' }));
    await expect(canvasElement.querySelector('[data-slot="dot-plot-end"]')?.textContent).toBe('48%');
  },
};

/** Sorted by the change from the first year to the second. */
export const ByChange: Story = { args: { order: 'change' }, render: Default.render };

/** The whole 0–100% axis, for a reader who needs the scale. */
export const FullScale: Story = { args: { domain: [0, 1] }, render: Default.render };

/** Three series; one price is missing and draws no dot. */
export const ThreeSeries: Story = {
  args: {
    series: CITIES,
    rows: BASKET,
    format: { style: 'currency', currency: 'EUR' },
    label: 'One basket in three cities (invented prices)',
    order: 'descending',
  },
  render: Default.render,
};

/** The table behind the picture, shown. */
export const WithTable: Story = { args: { showTable: true }, render: Default.render };

/** A 360px column: each label sits above its row. */
export const NarrowColumn: Story = {
  render: (args) => (
    <div className="w-[22.5rem] max-w-full">
      <DotPlot {...args} />
    </div>
  ),
};

export const Loading: Story = { args: { loading: true }, render: Default.render };

export const Empty: Story = { args: { rows: [] }, render: Default.render };

export const Dark: Story = { ...Default, play: undefined, globals: { theme: 'dark' } };

export const Rtl: Story = { ...Default, play: undefined, decorators: [withRtl] };
