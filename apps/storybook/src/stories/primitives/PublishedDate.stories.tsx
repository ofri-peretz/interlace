import type { Meta, StoryObj } from '@storybook/react-vite';
import { PublishedDate, MIN_VIEWPORT } from '@interlace/ui/published-date';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/PublishedDate',
  component: PublishedDate,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The publish stamp in an article header or list card. Keeps the two readings of a date apart: the `<time dateTime>` attribute carries the machine value that RSS, JSON-LD and assistive tech consume, while the visible label is formatted at render by `Intl.DateTimeFormat` in the runtime locale. Use it wherever a date is content; for a relative "3 days ago" or an edited-at line, format above this primitive and pass the result as the label.',
      },
    },
  },
  argTypes: {
    dateIso: {
      control: 'text',
      description:
        'ISO 8601 timestamp — `2026-05-30` or `2026-05-30T14:00:00Z`. Emitted verbatim as `dateTime`, so it must stay machine-parseable no matter how the label is formatted.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    format: {
      control: 'inline-radio',
      options: ['long', 'short'],
      description:
        '`long` → "May 30, 2026" for article headers and cards; `short` → "5/30/26" for dense metadata rows and footers.',
      table: {
        type: { summary: "'long' | 'short'" },
        defaultValue: { summary: 'long' },
        category: 'Appearance',
      },
    },
    loading: {
      control: 'boolean',
      description:
        'Swap in a text skeleton sized to the "Month DD, YYYY" footprint. Also the fallback when `dateIso` is missing, so a header row reserves its space instead of collapsing.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    className: {
      control: 'text',
      description:
        'Merged after `text-muted-foreground text-sm` — the seam for a header that wants the date at full foreground weight.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
  args: {
    dateIso: '2026-05-30',
    format: 'long',
    loading: false,
  },
} satisfies Meta<typeof PublishedDate>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Shown in the metadata row it actually ships in — a bare `<time>` alone in a
 * 1200px canvas says nothing about how the stamp sits next to its neighbours.
 */
export const Default: Story = {
  render: (args) => (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-foreground font-medium">Ofri Peretz</span>
      <span className="text-muted-foreground">·</span>
      <PublishedDate {...args} />
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">6 min read</span>
    </div>
  ),
};

/**
 * Loading — the skeleton is sized to the long-format footprint, so the header
 * row keeps its width and the layout doesn't shift when the date arrives.
 */
export const Loading: Story = {
  args: { loading: true },
  render: (args) => (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-foreground font-medium">Ofri Peretz</span>
      <span className="text-muted-foreground">·</span>
      <PublishedDate {...args} />
    </div>
  ),
};

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
  globals: { theme: 'dark' },
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
