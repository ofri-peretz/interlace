import type { Meta, StoryObj } from '@storybook/react-vite';
import { BorderBeam } from '@interlace/ui/magicui/border-beam';

/**
 * BorderBeam stories
 *
 * The component is `pointer-events-none absolute inset-0` with
 * `rounded-[inherit]` — it traces the border of whatever positions it, and
 * takes its corner radius from that parent rather than owning one itself.
 * Every story therefore wraps it in a `relative overflow-hidden` card with
 * an explicit height and its own `rounded-lg`, and puts the beam AFTER the
 * card content so it paints on top as an overlay rather than under it.
 */

const meta: Meta<typeof BorderBeam> = {
  title: 'MagicUI/BorderBeam',
  component: BorderBeam,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A single beam of light that travels around a border, built on CSS `offset-path` rather than Framer Motion for GPU-accelerated animation. Drop it into any `relative` container as a trailing sibling to get a traced-border effect — it never affects layout, since it is fully absolutely positioned. `size` is the length of the beam segment (not a radius), and `colorFrom`/`colorTo` paint a linear gradient along that segment.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: [30, 50, 80, 120],
      description: 'Length, in pixels, of the animated beam segment that travels the border.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '50' }, category: 'Geometry' },
    },
    borderWidth: {
      control: 'select',
      options: [1, 2, 3, 4],
      description: 'Thickness, in pixels, of the border the beam travels along.',
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '1' },
        category: 'Geometry',
      },
    },
    duration: {
      control: 'select',
      options: [3, 6, 10, 15],
      description: 'Seconds for one full trip around the border.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '6' }, category: 'Motion' },
    },
    delay: {
      control: 'select',
      options: [0, 1, 2, 3],
      description:
        'Negative animation-delay, in seconds, applied at mount — offsets the starting point without a visible jump-cut. Useful for staggering several beams on one page.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0' }, category: 'Motion' },
    },
    initialOffset: {
      control: 'select',
      options: [0, 25, 50, 75],
      description: 'Starting position along the border path, 0-100.',
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '0' },
        category: 'Motion',
      },
    },
    reverse: {
      control: 'boolean',
      description: 'Reverse the travel direction.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'Motion' },
    },
    colorFrom: {
      control: 'color',
      description: 'Leading edge color of the beam gradient.',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: '#ffaa40' },
        category: 'Appearance',
      },
    },
    colorTo: {
      control: 'color',
      description: 'Trailing edge color of the beam gradient, fading to transparent.',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: '#9c40ff' },
        category: 'Appearance',
      },
    },
    className: {
      control: 'text',
      description: 'Merged onto the beam element itself — the seam for size or blend-mode overrides.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof BorderBeam>;

export const Default: Story = {
  args: {
    size: 50,
    duration: 6,
    borderWidth: 1,
    colorFrom: '#ffaa40',
    colorTo: '#9c40ff',
  },
  render: (args) => (
    <div className="relative h-[220px] w-full overflow-hidden rounded-lg border border-border bg-background p-6">
      <p className="text-sm font-medium text-foreground">Card with a border beam</p>
      <p className="mt-2 text-xs text-muted-foreground">
        The beam traces the card border, not the content inside it.
      </p>
      <BorderBeam {...args} />
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const Reverse: Story = {
  name: 'Reverse direction',
  args: { ...Default.args, reverse: true },
  render: Default.render,
};

export const ThickAndSlow: Story = {
  name: 'Thick beam, slow trip (borderWidth=3, duration=15)',
  args: { ...Default.args, borderWidth: 3, size: 80, duration: 15 },
  render: Default.render,
};

export const BrandGradient: Story = {
  name: 'Interlace brand gradient',
  args: { ...Default.args, colorFrom: '#f4794a', colorTo: '#a84c17' },
  render: Default.render,
};
