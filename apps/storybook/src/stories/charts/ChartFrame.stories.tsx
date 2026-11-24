import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ChartFrame } from '@interlace/ui/charts/chart-frame';
import { ShareChart, type ShareCategory, type ShareRow } from '@interlace/ui/charts/share-chart';
import { withRtl } from '@/decorators';

// An invented count: how residents of an invented city get to work.
const MODES: ShareCategory[] = [
  { id: 'walk', label: 'Walk' },
  { id: 'bike', label: 'Bike' },
  { id: 'bus', label: 'Bus' },
  { id: 'car', label: 'Car' },
];

const ROWS: ShareRow[] = [
  { label: '2019', values: { walk: 1840, bike: 920, bus: 2610, car: 4380 } },
  { label: '2022', values: { walk: 2010, bike: 1330, bus: 2240, car: 4120 } },
  { label: '2025', values: { walk: 2280, bike: 2210, bus: 2690, car: 2560 } },
];

const FLAT = ROWS.map((row) => ({ year: row.label, ...row.values }));

const TABLE = (
  <table className="w-full text-ui-sm tabular-nums">
    <thead>
      <tr className="border-border border-b">
        <th scope="col" className="py-1.5 pe-4 text-start font-medium">
          Year
        </th>
        {MODES.map((m) => (
          <th key={m.id} scope="col" className="py-1.5 pe-4 text-end font-medium">
            {m.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {ROWS.map((row) => (
        <tr key={row.label} className="border-border border-b">
          <th scope="row" className="py-1.5 pe-4 text-start font-normal">
            {row.label}
          </th>
          {MODES.map((m) => (
            <td key={m.id} className="py-1.5 pe-4 text-end">
              {row.values[m.id]!.toLocaleString('en-US')}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

const meta = {
  title: 'Charts/ChartFrame',
  component: ChartFrame,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The frame a published chart sits in: a title that states the finding, a line on what is measured, the chart, and a footer with where the numbers came from and a copy of them to take away.\n\n' +
          '**The footer is the receipt.** `sources` (linked when they have an address), `note` and `updated` are plain HTML under the chart, never behind a click.\n\n' +
          '**Chart or table.** Pass `table` to offer both views as tabs; both stay in the server HTML.\n\n' +
          '**Take the data.** `download` writes the rows as a UTF-8 CSV into a link at render time, so it works before scripts load, and defuses cells a spreadsheet would run as a formula.\n\n' +
          '**Words.** Every fixed word comes from `labels`, and the date goes through `Intl` in `locale`.',
      },
    },
  },
  args: {
    title: 'Walking, cycling and the bus now carry three in four trips',
    subtitle: 'Share of trips to work by main mode, an invented city, 2019 to 2025',
    sources: [{ label: 'City travel survey (sample data)', href: 'https://example.org/travel-survey' }],
    note: 'Trips shorter than 500 metres are left out. Numbers are invented for this example.',
    updated: '2025-10-01',
    locale: 'en-US',
    download: { filename: 'trips-to-work', rows: FLAT },
    table: TABLE,
  },
  argTypes: {
    title: { control: 'text', table: { category: 'Content' } },
    subtitle: { control: 'text', table: { category: 'Content' } },
    headingLevel: { control: 'inline-radio', options: ['h2', 'h3', 'h4'], table: { category: 'Content' } },
    sources: { control: 'object', table: { type: { summary: 'readonly ChartSource[]' }, category: 'Footer' } },
    note: { control: 'text', table: { category: 'Footer' } },
    updated: { control: 'text', description: 'An ISO date.', table: { category: 'Footer' } },
    download: { control: 'object', table: { type: { summary: 'ChartDownload' }, category: 'Footer' } },
    table: { control: false, table: { category: 'Views' } },
    defaultView: { control: 'inline-radio', options: ['chart', 'table'], table: { category: 'Views' } },
    locale: { control: 'text', table: { category: 'Content' } },
    labels: { control: 'object', table: { category: 'Content' } },
  },
} satisfies Meta<typeof ChartFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="max-w-192">
      <ChartFrame {...args}>
        <ShareChart categories={MODES} rows={ROWS} />
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: 'Download data (CSV)' }).getAttribute('download')).toBe('trips-to-work.csv');
    await userEvent.click(canvas.getByRole('tab', { name: 'Table' }));
    await expect(canvas.getByRole('tab', { name: 'Table' }).getAttribute('aria-selected')).toBe('true');
  },
};

/** No table, no download: the chart and its receipt. */
export const SourceOnly: Story = {
  args: { table: undefined, download: undefined, updated: undefined },
  render: Default.render,
};

/** Several sources, one without an address. */
export const Sources: Story = {
  args: {
    sources: [
      { label: 'City travel survey (sample data)', href: 'https://example.org/travel-survey' },
      { label: 'Transit operator counts (sample data)' },
    ],
  },
  render: Default.render,
};

/** Another language passes its own words and locale. */
export const OtherWords: Story = {
  args: {
    locale: 'fr-FR',
    labels: { chart: 'Graphique', table: 'Tableau', source: 'Source', note: 'Remarque', updated: 'Mis à jour le', download: 'Télécharger les données (CSV)', views: 'Affichage' },
  },
  render: Default.render,
};

/** A 360px column: the footer wraps under the chart. */
export const NarrowColumn: Story = {
  render: (args) => (
    <div className="w-[22.5rem] max-w-full">
      <ChartFrame {...args}>
        <ShareChart categories={MODES} rows={ROWS} />
      </ChartFrame>
    </div>
  ),
};

export const Dark: Story = { ...Default, play: undefined, globals: { theme: 'dark' } };

export const Rtl: Story = { ...Default, play: undefined, decorators: [withRtl] };
