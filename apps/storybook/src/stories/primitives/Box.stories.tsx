import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@interlace/ui/box';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Box> = {
  title: 'Primitives/Box',
  component: Box,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Lowest-altitude layout primitive: one element carrying a surface and a box-model, drawn only from foundation tokens. Reach for it when you need a padded/bordered wrapper and nothing semantic — `Card` is Box with a card identity, `Section`/`Container` own page rhythm. The variant set is deliberately closed (no `sx`, no `mt`/`bgcolor` system props) so it cannot reopen the magic-number problem `LAYOUT_PHILOSOPHY.md` closes.',
      },
    },
  },
  argTypes: {
    surface: {
      control: 'select',
      options: ['none', 'card', 'muted', 'accent'],
      description:
        'Background plus its paired foreground token, so every surface is AA by construction. `none` inherits from the parent.',
      table: {
        category: 'Appearance',
        type: { summary: "'none' | 'card' | 'muted' | 'accent'" },
        defaultValue: { summary: 'none' },
      },
    },
    padding: {
      control: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'],
      description:
        'Padding from the foundation --spacing scale (xs 8 / sm 16 / md 24 / lg 40 / xl 64 px).',
      table: {
        category: 'Appearance',
        type: { summary: "'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'" },
        defaultValue: { summary: 'none' },
      },
    },
    radius: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
      description: 'Corner radius from the 3-step foundation scale (8/12/16px).',
      table: {
        category: 'Appearance',
        type: { summary: "'none' | 'sm' | 'md' | 'lg'" },
        defaultValue: { summary: 'none' },
      },
    },
    border: {
      control: 'boolean',
      description: '1px `border-border` hairline.',
      table: { category: 'Appearance', defaultValue: { summary: 'false' } },
    },
    as: {
      control: 'select',
      options: ['div', 'section', 'article', 'aside', 'ul', 'li', 'span'],
      description:
        'Render a different element. Use it to keep the document outline honest — a Box is not automatically a `<div>`-shaped idea.',
      table: {
        category: 'Appearance',
        type: { summary: 'React.ElementType' },
        defaultValue: { summary: 'div' },
      },
    },
    children: {
      control: 'text',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description:
        'Anything outside the closed variant set (width, flex, grid) lives here.',
      table: { category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Box>;

export const Default: Story = {
  args: {
    surface: 'card',
    padding: 'md',
    radius: 'md',
    border: true,
    as: 'div',
    children: 'The token-aware surface primitive.',
  },
  render: (args) => <Box {...args} />,
};

// The four real `surface` values — each ships its paired foreground token,
// which is why none of these need an explicit text colour.
export const Surfaces: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Box surface="card" padding="md" radius="md" border>card</Box>
      <Box surface="muted" padding="md" radius="md">muted</Box>
      <Box surface="accent" padding="md" radius="md">accent</Box>
      <Box surface="none" padding="md" radius="md" border>none (inherits)</Box>
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
