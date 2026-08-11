import type { Meta, StoryObj } from '@storybook/react-vite';
import { AnimatedGridPattern } from '@interlace/ui/magicui/animated-grid-pattern';

/**
 * AnimatedGridPattern stories
 *
 * A tiled SVG grid that fills its nearest positioned ancestor
 * (`absolute inset-0`) and softly pulses a handful of cells. It is
 * `aria-hidden` and `pointer-events-none` in the source itself, so no
 * story needs to add that — it is purely a backdrop.
 *
 * Because the root is absolutely positioned, every story wraps it in a
 * `relative` parent with an explicit height (it has no intrinsic size to
 * report). The foreground copy sits in its own opaque `bg-background`
 * chip rather than directly over the animated cells, so axe scores a
 * stable background rather than the pattern layered underneath moving
 * squares.
 */

const meta: Meta<typeof AnimatedGridPattern> = {
  title: 'MagicUI/AnimatedGridPattern',
  component: AnimatedGridPattern,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A breathing graph-paper backdrop for heroes and section bands: a tiled grid where `numSquares` cells fade in and out and teleport to a fresh cell each cycle. Color comes from `currentColor` via the default `text-muted-foreground/20` class — override with any `text-*` utility rather than an inline color. `numSquares` is clamped to whatever the measured container can actually fit, so requesting more than the grid has room for never stacks invisible duplicates. Respects `prefers-reduced-motion` by rendering a static grid with no pulsing.',
      },
    },
  },
  argTypes: {
    width: {
      control: 'select',
      options: [24, 32, 40, 56, 80],
      description: 'Width of a single grid cell, in pixels.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '40' }, category: 'Geometry' },
    },
    height: {
      control: 'select',
      options: [24, 32, 40, 56, 80],
      description: 'Height of a single grid cell, in pixels.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '40' }, category: 'Geometry' },
    },
    strokeDasharray: {
      control: 'select',
      options: [0, 2, 4, 8],
      description: 'Dash length for the grid lines. `0` draws solid lines.',
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '0' },
        category: 'Geometry',
      },
    },
    numSquares: {
      control: 'select',
      options: [10, 30, 50, 80],
      description:
        'Number of cells pulsing at once, clamped to what the measured container can fit.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '50' }, category: 'Motion' },
    },
    maxOpacity: {
      control: 'select',
      options: [0.2, 0.35, 0.5, 0.7],
      description: 'Peak opacity each cell fades to at the top of its pulse (0-1).',
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '0.5' },
        category: 'Appearance',
      },
    },
    duration: {
      control: 'select',
      options: [1, 2, 4, 6],
      description: 'Duration of a single fade-in/out cycle, in seconds.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '4' }, category: 'Motion' },
    },
    repeatDelay: {
      control: 'select',
      options: [0, 0.5, 1, 2],
      description:
        'Pause between a cell finishing its cycle and teleporting to a new position, in seconds.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.5' }, category: 'Motion' },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the `<svg>` — the seam for color (`text-*`) and any mask-image vignette.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AnimatedGridPattern>;

export const Default: Story = {
  args: {
    width: 40,
    height: 40,
    numSquares: 30,
    maxOpacity: 0.5,
    duration: 4,
    repeatDelay: 0.5,
  },
  render: (args) => (
    <div className="relative h-[220px] w-full overflow-hidden rounded-lg border border-border bg-background">
      <AnimatedGridPattern {...args} />
      <div className="relative flex h-full items-center justify-center p-6">
        <div className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground">
          Hero band backdrop
        </div>
      </div>
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const Dense: Story = {
  name: 'Dense, faster pulse',
  args: { ...Default.args, numSquares: 80, duration: 1.5, repeatDelay: 0.1 },
  render: Default.render,
};

export const Sparse: Story = {
  name: 'Sparse, slow and faint',
  args: { ...Default.args, numSquares: 10, maxOpacity: 0.2, duration: 6 },
  render: Default.render,
};

export const LargeDashedCells: Story = {
  name: 'Large cells, dashed lines',
  args: { ...Default.args, width: 80, height: 80, strokeDasharray: 4 },
  render: Default.render,
};
