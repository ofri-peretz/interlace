import type { Meta, StoryObj } from '@storybook/react-vite';
import { PublishedDate, MIN_VIEWPORT } from '@interlace/ui/published-date';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/PublishedDate',
  component: PublishedDate,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Article publish-date stamp. Renders a semantic `<time dateTime={iso}>` with a human-readable label produced by `Intl.DateTimeFormat` at render time. `long` is the article-header default (May 30, 2026); `short` is for tight metadata rows (5/30/26). Server component.',
      },
    },
  },
  argTypes: {
    dateIso: { control: 'text' },
    format: { control: 'inline-radio', options: ['long', 'short'] },
  },
  args: {
    dateIso: '2026-05-30',
    format: 'long',
  },
} satisfies Meta<typeof PublishedDate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 bg-background p-6 text-foreground">
      <div>
        <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">
          format=&quot;long&quot; (default)
        </div>
        <PublishedDate dateIso="2026-05-30" format="long" />
      </div>
      <div>
        <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">
          format=&quot;short&quot;
        </div>
        <PublishedDate dateIso="2026-05-30" format="short" />
      </div>
      <div>
        <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">
          With full ISO timestamp
        </div>
        <PublishedDate dateIso="2026-05-30T14:00:00Z" format="long" />
      </div>
      <div>
        <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">
          In an article header row
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-foreground">Ofri Peretz</span>
          <span className="text-muted-foreground">·</span>
          <PublishedDate dateIso="2026-05-30" format="long" />
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">6 min read</span>
        </div>
      </div>
    </div>
  ),
};

export const Dark: Story = {
  ...Variants,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Variants,
  decorators: [withRtl],
};

export const BelowMinViewport: Story = {
  render: () => (
    <div
      data-interlace-dev
      style={{ width: MIN_VIEWPORT - 1 }}
      className="border-2 border-dashed border-muted bg-background p-4 text-foreground"
    >
      <div className="flex flex-col gap-2 text-sm">
        <PublishedDate dateIso="2026-05-30" format="long" />
        <PublishedDate dateIso="2026-05-30" format="short" />
      </div>
    </div>
  ),
};
