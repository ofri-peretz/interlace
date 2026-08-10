import type { Meta, StoryObj } from '@storybook/react-vite';
import { Activity, Download, Star, TrendingUp } from 'lucide-react';
import { StatGroup } from '@interlace/ui/patterns/stat-group';

const meta: Meta<typeof StatGroup> = {
  title: 'Blocks/StatGroup',
  component: StatGroup,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The KPI row at the top of a stats or dashboard page — a grid of StatCards ' +
          'from one array. `cols` is a closed set (2 / 3 / 4) rather than a free ' +
          'number because the grid track has to stay inside the DS layout scale.',
      },
    },
  },
  argTypes: {
    stats: {
      // Not an `object` control: every entry is a StatCard prop bag, and the
      // realistic ones carry a lucide element in `icon`. A JSON editor cannot
      // round-trip a React element — it would hand the card a plain object and
      // React would throw on render. Edit the individual card in Blocks/StatCard
      // instead; this control owns the layout, not the cell.
      control: false,
      description:
        'One StatCard prop bag per cell — `{ label, value, delta?, footnote?, icon?, tone? }`. The group renders them in order and adds nothing: anything you want a card to say, say it here.',
      table: { type: { summary: 'StatCardProps[]' }, defaultValue: { summary: '[]' }, category: 'Data' },
    },
    cols: {
      control: 'inline-radio',
      options: [2, 3, 4],
      description:
        'DESKTOP track count, and a closed set rather than a free number because the grid has to stay on the DS layout scale. It collapses to one column below `sm` — handed to the grid unqualified, 4 tracks at 375px is a 68px card whose label and trend icon spill off the viewport.',
      table: { type: { summary: '2 | 3 | 4' }, defaultValue: { summary: '3' }, category: 'Appearance' },
    },
    loading: {
      control: 'boolean',
      description:
        'Render `cols` skeleton cards instead of the stats. The placeholder count follows `cols`, not `stats.length`, because on first paint the array is empty and the row would otherwise reserve nothing.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    className: {
      control: 'text',
      description: 'Merged onto the `<section>`. The group is `w-full`; constrain it from the page, not here.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const STATS = [
  {
    label: 'Weekly downloads',
    value: '70,348',
    delta: '+12.3% · 30d',
    icon: <Download className="size-4" />,
    tone: 'success' as const,
  },
  {
    label: 'GitHub stars',
    value: '1,247',
    delta: '+47 · 30d',
    icon: <Star className="size-4" />,
    tone: 'success' as const,
  },
  {
    label: 'Reach',
    value: '103,412',
    delta: '+8.2% · 30d',
    icon: <Activity className="size-4" />,
  },
  {
    label: 'Engagement rate',
    value: '4.1%',
    delta: '-0.2pp · 30d',
    icon: <TrendingUp className="size-4" />,
    tone: 'warning' as const,
  },
];

export const Default: Story = {
  args: { stats: STATS.slice(0, 3), cols: 3, loading: false },
};

export const FourColumns: Story = {
  args: { stats: STATS, cols: 4 },
};

export const TwoColumns: Story = {
  args: { stats: STATS.slice(0, 2), cols: 2 },
};

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Every number here comes from an aggregate query, and the row sits at the ' +
          'top of the page — so a missing skeleton means the entire page content ' +
          'jumps down once the numbers land. The placeholder count follows `cols`.',
      },
    },
  },
  args: { loading: true, cols: 4 },
};

export const DarkMode: Story = {
  globals: { theme: 'dark' },
  args: { stats: STATS, cols: 4 },
};
