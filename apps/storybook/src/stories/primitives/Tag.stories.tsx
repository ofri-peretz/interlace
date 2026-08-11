import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tag, TagList } from '@interlace/ui/tag';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/Tag',
  component: Tag,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Inline taxonomy chip that navigates — a rule category, a plugin tag, an article topic. Always a link with a real `href`, never a button: if activating the chip filters in place rather than going somewhere, use a Toggle or a Badge instead (Badge is the non-interactive sibling). `TagList` ships the `<ul>`/`<li>` semantics a bare flex row of anchors would lose, and wraps cleanly down to the 320px floor.',
      },
    },
  },
  argTypes: {
    tone: {
      control: 'select',
      options: ['default', 'primary', 'muted'],
      description:
        'Emphasis of the chip text. `muted` is for low-signal taxonomy (dates, counts); `primary` marks the one chip that is currently in effect.',
      table: {
        category: 'Appearance',
        type: { summary: "'default' | 'primary' | 'muted'" },
        defaultValue: { summary: "'default'" },
      },
    },
    href: {
      control: 'text',
      description:
        'Destination. Required in the idle state — a Tag with no href is an anchor with no role and no tab stop.',
      table: { category: 'Behaviour', type: { summary: 'string' } },
    },
    children: {
      control: 'text',
      description: 'Chip label. Keep it to one or two words — the chip does not wrap internally.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    loading: {
      control: 'boolean',
      description:
        'Render a shape-matched `Skeleton` (h-5 w-12 pill) instead of the link, so a tag cluster keeps its silhouette while the taxonomy loads.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    className: {
      control: 'text',
      description: 'Merged after the cva classes.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  args: {
    href: '#',
    children: 'security',
    tone: 'default',
    loading: false,
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE_ITEMS = [
  { label: 'security', href: '#security' },
  { label: 'browser', href: '#browser', tone: 'primary' as const },
  { label: 'jwt', href: '#jwt' },
  { label: 'express', href: '#express' },
  { label: 'lambda', href: '#lambda' },
  { label: 'mongodb', href: '#mongodb' },
  { label: 'updated 2026-05', href: '#dates', tone: 'muted' as const },
];

export const Default: Story = {
  args: {
    href: '#security',
    children: 'security',
  },
  // Shown inside the meta row a chip actually lives in — a lone pill in an
  // empty canvas says nothing about its size relative to surrounding text.
  render: (args) => (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      Filed under
      <Tag {...args} />
      <span>· 6 min read</span>
    </p>
  ),
};

export const Variants: Story = {
  render: () => (
    <TagList
      items={[
        { label: 'default tone', href: '#default' },
        { label: 'primary tone', href: '#primary', tone: 'primary' },
        { label: 'muted tone', href: '#muted', tone: 'muted' },
      ]}
    />
  ),
};

export const List: Story = {
  render: () => <TagList items={SAMPLE_ITEMS} />,
};

export const Dark: Story = {
  ...List,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...List,
  decorators: [withRtl],
};

export const BelowMinViewport: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
    docs: {
      description: {
        story:
          'Renders at sub-320 widths to confirm the wrap contract holds and chips never overflow horizontally. Below MIN_VIEWPORT (320) the preflight contract may flag a dev-mode outline; the component itself still renders.',
      },
    },
  },
  render: () => (
    <div style={{ width: 280 }}>
      <TagList items={SAMPLE_ITEMS} />
    </div>
  ),
};
