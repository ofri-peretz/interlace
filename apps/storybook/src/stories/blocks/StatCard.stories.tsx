import type { Meta, StoryObj } from '@storybook/react-vite';
import { Activity, Download, Shield, TrendingUp } from 'lucide-react';
import { StatCard } from '@interlace/ui/patterns/stat-card';

const meta: Meta<typeof StatCard> = {
  title: 'Blocks/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One labelled number and, optionally, what it did recently. The unit dashboards and scorecards are built from — use it where a single figure is the point, and reach for MetricTable instead the moment a reader would want to compare several metrics across the same dates.\n\n' +
          'Value and delta are `ReactNode`, not `number`: formatting (locale, compaction, currency) belongs to the caller, because the card cannot know whether 70348 should read as "70,348" or "70.3K". Numbers render with tabular numerals so digits do not jump as a value updates in place.\n\n' +
          '`tone` is a claim about whether the movement is good, and nothing else derives it — a falling number is not automatically `danger`, which is exactly the mistake that paints a dropping error rate red.',
      },
    },
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'What the number is. Sits above the value in muted UI type.',
      table: { type: { summary: 'ReactNode' }, category: 'Data' },
    },
    value: {
      control: 'text',
      description:
        'The figure itself, pre-formatted by the caller. Rendered at h2 scale with tabular numerals.',
      table: { type: { summary: 'ReactNode' }, category: 'Data' },
    },
    delta: {
      control: 'text',
      description:
        'The change line — "+12.3% · 30d". Takes its colour from `tone`, so this string and that prop have to agree; nothing cross-checks them.',
      table: { type: { summary: 'ReactNode' }, category: 'Data' },
    },
    footnote: {
      control: 'text',
      description:
        'Secondary line under the delta — the window or the caveat ("since launch", "excludes CI").',
      table: { type: { summary: 'ReactNode' }, category: 'Data' },
    },
    tone: {
      control: 'select',
      options: ['default', 'success', 'warning', 'danger'],
      description:
        'Tints the card border and the delta text. It is an editorial judgement, not a function of the sign: `success` on a falling number is correct when the metric is latency or open issues.',
      table: {
        type: { summary: "'default' | 'success' | 'warning' | 'danger'" },
        defaultValue: { summary: 'default' },
        category: 'Appearance',
      },
    },
    icon: {
      control: false,
      description:
        'Lucide icon pinned to the top-right, rendered `aria-hidden` — it is a scanning aid for a grid of cards, never the only thing identifying the metric.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    loading: {
      control: 'boolean',
      description:
        'Render a `<Skeleton variant="stat-card" />` at the card\'s own size. These numbers come from aggregate queries and land late; without it a KPI row shoves the whole page down when it resolves.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    className: {
      control: 'text',
      description: 'Merged after the tone variant, so it wins.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Weekly downloads',
    value: '70,348',
    delta: '+12.3% · 30d',
    footnote: 'across 19 published packages',
    tone: 'default',
    loading: false,
  },
};

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Reserves the card\'s exact footprint. A KPI row sits at the very top of the page, so a card that appears late does not shift itself — it shifts everything below it.',
      },
    },
  },
  args: { label: 'Weekly downloads', loading: true },
};

export const WithIcon: Story = {
  args: {
    label: 'Rules shipped',
    value: '397',
    delta: '+24 this quarter',
    icon: <Shield className="size-4" />,
    tone: 'success',
  },
};

export const Grid: Story = {
  parameters: {
    docs: { description: { story: 'KPI row — typical dashboard composition.' } },
  },
  render: () => (
    <div className="grid w-full max-w-content grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Reach"
        value="103,412"
        delta="+8.2% · 30d"
        icon={<Activity className="size-4" />}
        tone="success"
      />
      <StatCard
        label="Stars"
        value="1,247"
        delta="+47 · 30d"
        icon={<TrendingUp className="size-4" />}
        tone="success"
      />
      <StatCard
        label="Downloads"
        value="70.3K"
        delta="+12.3% · 30d"
        icon={<Download className="size-4" />}
      />
      <StatCard
        label="Engagement rate"
        value="4.1%"
        delta="-0.2pp · 30d"
        tone="warning"
      />
    </div>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="grid w-full max-w-content grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Default" value="1,234" delta="+5% · 30d" tone="default" />
      <StatCard label="Success" value="98.3%" delta="+0.4pp" tone="success" />
      <StatCard label="Warning" value="412ms" delta="+18ms" tone="warning" />
      <StatCard label="Danger" value="3 issues" delta="+2 today" tone="danger" />
    </div>
  ),
};
