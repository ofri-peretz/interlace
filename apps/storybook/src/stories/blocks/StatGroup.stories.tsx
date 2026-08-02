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
    cols: { control: 'inline-radio', options: [2, 3, 4] },
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
  args: { stats: STATS.slice(0, 3), cols: 3 },
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
