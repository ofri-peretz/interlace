import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ChoroplethMap, type MapArea } from '@interlace/ui/charts/choropleth-map';
import { withRtl } from '@/decorators';

// An invented region drawn as a hex grid: no real place, no real border.
// Real maps pass paths projected from their own boundary files.
const COLS = 7;
const ROWS = 5;
const R = 20;
const W = Math.sqrt(3) * R;

function hex(cx: number, cy: number): string {
  const points = Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k - Math.PI / 6;
    return `${(cx + R * Math.cos(a)).toFixed(1)} ${(cy + R * Math.sin(a)).toFixed(1)}`;
  });
  return `M${points.join('L')}Z`;
}

const NAMES = [
  'Alder', 'Birch', 'Cedar', 'Dune', 'Elm', 'Fern', 'Glen', 'Heath', 'Ivy', 'Juniper', 'Kestrel', 'Larch',
  'Meadow', 'Nettle', 'Oak', 'Pine', 'Quarry', 'Rowan', 'Sorrel', 'Thorn', 'Upland', 'Vale', 'Willow',
  'Yarrow', 'Zinnia', 'Ash', 'Bramble', 'Clover', 'Dell', 'Ember', 'Ford', 'Grove', 'Holly', 'Iris', 'Jasper',
];

const AREAS: MapArea[] = Array.from({ length: COLS * ROWS }, (_, i) => {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  const cx = W / 2 + 4 + col * W + (row % 2 ? W / 2 : 0);
  const cy = R + 4 + row * R * 1.5;
  return { id: `d${i}`, label: NAMES[i]!, d: hex(cx, cy) };
});

const VIEWBOX = `0 0 ${Math.ceil(W * (COLS + 0.5) + 8)} ${Math.ceil(R * 1.5 * (ROWS - 1) + 2 * R + 8)}`;

// A smooth invented gradient from one corner, with two districts missing.
const VALUES: Record<string, number | null> = Object.fromEntries(
  AREAS.map((a, i) => {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const v = 0.08 + 0.05 * col + 0.04 * row + ((i * 7) % 5) * 0.01;
    return [a.id, i === 11 || i === 26 ? null : Number(v.toFixed(3))];
  }),
);

const meta = {
  title: 'Charts/ChoroplethMap',
  component: ChoroplethMap,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A value per area, as shades of one colour on a map.\n\n' +
          '**Interlace ships no geography.** You pass SVG paths already projected into `viewBox`; the component never fetches or bundles a boundary file.\n\n' +
          '**Classes, not a smooth ramp.** Values go into a few classes (`bins`, 5 by default; quantile, `equal` or your own `breaks`), each one shade, light to dark.\n\n' +
          '**Missing is not zero.** An area without a value is hatched and the legend says "No data".\n\n' +
          '**Every area without a mouse.** Focus the map, then arrow keys step through the areas in name order; the readout says the area, value and class. A legend entry picks out its class; a table of every area sits behind the picture.',
      },
    },
  },
  args: {
    areas: AREAS,
    values: VALUES,
    viewBox: VIEWBOX,
    label: 'Homes with solar panels, by district (invented data)',
    legendLabel: 'Share of homes',
    format: { style: 'percent', maximumFractionDigits: 0 },
    locale: 'en-US',
  },
  argTypes: {
    areas: { control: false, table: { type: { summary: 'readonly MapArea[]' }, category: 'Data' } },
    values: { control: 'object', table: { category: 'Data' } },
    viewBox: { control: 'text', table: { category: 'Data' } },
    bins: { control: { type: 'range', min: 2, max: 7 }, table: { category: 'Classes' } },
    binning: { control: 'inline-radio', options: ['quantile', 'equal'], table: { category: 'Classes' } },
    breaks: { control: 'object', table: { category: 'Classes' } },
    tone: { control: 'inline-radio', options: [1, 2, 3, 4, 5], table: { category: 'Look' } },
    format: { control: 'object', table: { category: 'Content' } },
    locale: { control: 'text', table: { category: 'Content' } },
    label: { control: 'text', table: { category: 'Content' } },
    legendLabel: { control: 'text', table: { category: 'Content' } },
    showTable: { control: 'boolean', table: { category: 'A11y' } },
    loading: { control: 'boolean', table: { category: 'State' } },
  },
} satisfies Meta<typeof ChoroplethMap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="max-w-160">
      <ChoroplethMap {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelectorAll('[data-slot="choropleth-map-area"]')).toHaveLength(35);
    await userEvent.click(canvas.getByRole('img'));
    await userEvent.keyboard('{Home}');
    await expect(canvasElement.querySelector('[data-slot="choropleth-map-readout"]')?.textContent).toMatch(/^Alder: /);
  },
};

/** Equal intervals in three classes, another tone. */
export const EqualIntervals: Story = { args: { binning: 'equal', bins: 3, tone: 3 }, render: Default.render };

/** Your own breaks: under 15%, 15–25%, 25–35%, over 35%. */
export const OwnBreaks: Story = { args: { breaks: [0.15, 0.25, 0.35] }, render: Default.render };

/** The table behind the picture, shown. */
export const WithTable: Story = { args: { showTable: true }, render: Default.render };

/** A 360px column. */
export const NarrowColumn: Story = {
  render: (args) => (
    <div className="w-[22.5rem] max-w-full">
      <ChoroplethMap {...args} />
    </div>
  ),
};

export const Loading: Story = { args: { loading: true }, render: Default.render };

export const Empty: Story = { args: { areas: [] }, render: Default.render };

export const Dark: Story = { ...Default, play: undefined, globals: { theme: 'dark' } };

export const Rtl: Story = { ...Default, play: undefined, decorators: [withRtl] };
