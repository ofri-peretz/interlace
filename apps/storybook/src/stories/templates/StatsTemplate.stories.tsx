import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatsTemplate } from '@interlace/ui/templates/stats-template';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof StatsTemplate> = {
  title: 'Templates/StatsTemplate',
  component: StatsTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof StatsTemplate>;

const logo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-md bg-linear-to-br from-violet-500 to-violet-700"
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
