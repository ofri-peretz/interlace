import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tag, TagList } from '@interlace/ui/tag';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/Tag',
  component: Tag,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Inline taxonomy chip. `Tag` is a rounded-full anchor with three tones (`default`, `primary`, `muted`); `TagList` wraps an array of items into an unordered list with `flex-wrap` + `gap-2`. Always a link (never a button) — use a real `href`. MIN_VIEWPORT=320: chips wrap cleanly down to the narrowest supported screen.',
      },
    },
  },
  argTypes: {
    tone: { control: 'select', options: ['default', 'primary', 'muted'] },
    href: { control: 'text' },
  },
  args: {
    href: '#',
    children: 'security',
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
  decorators: [withDark],
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
