import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatsTemplate } from '@interlace/ui/templates/stats-template';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof StatsTemplate> = {
  title: 'Templates/StatsTemplate',
  component: StatsTemplate,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Public metrics page — headline KPIs in a StatGroup above arbitrary chart or table content, with an optional methodology footnote. Each region sits in its own SectionBoundary, so the KPIs paint while slower detail queries are still in flight.",
      },
    },
  },
  argTypes: {
    topbar: { control: 'object', description: 'Props forwarded to Topbar.', table: { category: 'Data' } },
    title: { control: 'text', description: 'Page heading.', table: { category: 'Content' } },
    lead: { control: 'text', description: 'One-line framing under the heading — say what the numbers mean.', table: { category: 'Content' } },
    hero: { control: 'object', description: 'Headline KPI stats (StatCardProps[]), rendered as a StatGroup.', table: { category: 'Data', type: { summary: 'StatCardProps[]' } } },
    children: { control: false, description: 'Detail region — charts, tables, whatever the page needs.', table: { category: 'Slots', type: { summary: 'ReactNode' } } },
    methodology: { control: 'text', description: 'How the numbers were collected. Omit to drop the footnote.', table: { category: 'Content' } },
    footer: { control: 'object', description: 'Props forwarded to Footer.', table: { category: 'Data' } },
  },
};

export default meta;
type Story = StoryObj<typeof StatsTemplate>;

const logo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-md bg-linear-to-br from-primary to-chart-2"
    />
    <span>Interlace</span>
  </a>
);

export const Default: Story = {
  args: {
    topbar: { logo, links: [{ href: '/', label: 'Home' }] },
    title: 'Stats',
    lead: 'Live numbers for the Interlace ecosystem. Engagement is the North Star Metric.',
    hero: [
      { label: 'npm installs · 30d', value: '2.1M', delta: '+12% 30d' },
      { label: 'GitHub stars', value: '745', delta: '+8 today' },
      { label: 'Active consumers', value: '38K' },
      { label: 'Rules shipped', value: '124' },
    ],
    children: (
      <div className="border-border bg-card rounded-lg border p-md">
        <p className="text-muted-foreground text-sm">
          (Charts and detail tables go here — consumer-supplied)
        </p>
      </div>
    ),
    methodology:
      'Updated nightly from npm + GitHub. Engagement = comments + reactions on shipped articles. See sources at the footer.',
    footer: { copyright: '© 2026 Interlace.' },
  },
};

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };

/**
 * PageSkeleton — the page-level loading state a consumer renders from
 * `loading.tsx` while the whole route is in flight. Shapes mirror the
 * real layout so the swap costs no layout shift (R23).
 */
export const PageSkeleton: Story = {
  render: () => <StatsTemplate.Skeleton />,
};
