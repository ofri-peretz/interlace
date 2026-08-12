import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack, Cluster } from '@interlace/ui/stack';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Stack> = {
  title: 'Primitives/Stack',
  component: Stack,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The one-dimensional layout primitive: a flex row or column whose gap is picked from the six-step token scale in LAYOUT_PHILOSOPHY.md §3, so spacing is never a per-page guess. `Cluster` is the same component pre-set to a wrapping horizontal row (tag rows, button rows). Reach for `Grid` instead when items need to line up in both axes, and for plain margins when a single element needs to move.',
      },
    },
  },
  argTypes: {
    direction: {
      control: 'select',
      options: ['vertical', 'horizontal'],
      description:
        'Main axis. `horizontal` also turns wrapping on, so a row degrades to multiple lines instead of overflowing.',
      table: {
        category: 'Layout',
        type: { summary: "'vertical' | 'horizontal'" },
        defaultValue: { summary: "'vertical'" },
      },
    },
    gap: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'],
      description:
        'Space between children, from the DS `--spacing-*` scale: xs 8 · sm 16 · md 24 · lg 40 · xl 64 · 2xl 96 (px). Shared with `Grid` so the two stay rhythm-consistent.',
      table: {
        category: 'Layout',
        type: { summary: "'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'" },
        defaultValue: { summary: "'md'" },
      },
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
      description:
        'Cross-axis alignment (`align-items`). `baseline` is the one to use when a row mixes type sizes.',
      table: {
        category: 'Layout',
        type: { summary: "'start' | 'center' | 'end' | 'stretch' | 'baseline'" },
      },
    },
    justify: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around'],
      description: 'Main-axis distribution (`justify-content`).',
      table: {
        category: 'Layout',
        type: { summary: "'start' | 'center' | 'end' | 'between' | 'around'" },
      },
    },
    render: {
      control: false,
      description:
        'Swap the rendered element — e.g. `render={<ul />}` when the stack is a real list. Same seam as the rest of the DS.',
      table: { category: 'Slots', type: { summary: 'RenderProp' } },
    },
    children: {
      control: false,
      description: 'The items being laid out. Stack owns the gaps, never the items.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description:
        'Merged last, so a one-off `w-full` / `max-w-prose` still wins over the variant classes.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  args: {
    direction: 'vertical',
    gap: 'md',
  },
};

export default meta;
type Story = StoryObj<typeof Stack>;

const Pill = ({ label }: { label: string }) => (
  <div className="rounded-md border border-border bg-card/40 px-4 py-2 text-sm">
    {label}
  </div>
);

export const Vertical: Story = {
  args: { direction: 'vertical', gap: 'md', align: 'stretch', justify: 'start' },
  render: (args) => (
    <Stack {...args}>
      <Pill label="Item 1" />
      <Pill label="Item 2" />
      <Pill label="Item 3" />
    </Stack>
  ),
};

export const Horizontal: Story = {
  args: { direction: 'horizontal', gap: 'sm', align: 'center', justify: 'start' },
  render: (args) => (
    <Stack {...args}>
      <Pill label="Item 1" />
      <Pill label="Item 2" />
      <Pill label="Item 3" />
      <Pill label="Item 4" />
    </Stack>
  ),
};

export const GapScale: Story = {
  render: () => (
    <Stack gap="lg">
      {(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const).map((gap) => (
        <div key={gap}>
          <div className="mb-2 text-xs font-mono uppercase text-muted-foreground">
            gap=&quot;{gap}&quot;
          </div>
          <Stack direction="horizontal" gap={gap}>
            <Pill label="A" />
            <Pill label="B" />
            <Pill label="C" />
          </Stack>
        </div>
      ))}
    </Stack>
  ),
};

export const ClusterChips: Story = {
  render: () => (
    <Cluster gap="xs">
      {['Browser', 'JWT', 'Express', 'Node.js', 'MongoDB', 'NestJS', 'Lambda', 'Vercel AI'].map((tag) => (
        <span
          key={tag}
          className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-900 dark:text-orange-100"
        >
          {tag}
        </span>
      ))}
    </Cluster>
  ),
};

export const Dark: Story = {
  ...ClusterChips,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...ClusterChips,
  decorators: [withRtl],
};
