import type { Meta, StoryObj } from '@storybook/react-vite';
import { CloudParticles } from '@interlace/ui/aceternity/cloud-particles';

/**
 * CloudParticles stories
 *
 * A decorative, aria-hidden overlay of drifting volumetric clouds, rendered
 * with a five-pass SVG filter and a pure CSS drift keyframe. The component is
 * `pointer-events-none absolute inset-0`, so every story bounds it inside a
 * fixed-height, positioned, clipped container and layers real content above
 * it on an opaque token surface rather than directly on the effect.
 */

const meta: Meta<typeof CloudParticles> = {
  title: 'Aceternity/CloudParticles',
  component: CloudParticles,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Volumetric, drifting clouds painted as a decorative backdrop. Absolutely positioned over the nearest positioned ancestor, aria-hidden, and reserves no layout space (CLS=0). Reduced-motion users get a static cloud field instead of the drift animation.',
      },
    },
  },
  argTypes: {
    count: {
      control: { type: 'number', min: 0, max: 8, step: 1 },
      description: 'Number of cloud particles on viewports at or above mobileBreakpoint.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '3' }, category: 'Layout' },
    },
    mobileCount: {
      control: { type: 'number', min: 0, max: 8, step: 1 },
      description: 'Maximum cloud count below mobileBreakpoint, to protect the GPU budget on phones.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '2' }, category: 'Layout' },
    },
    minSpeed: {
      control: { type: 'number', min: 20, max: 400, step: 10 },
      description: 'Slowest drift duration in seconds. Larger is slower.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '150' }, category: 'Motion' },
    },
    maxSpeed: {
      control: { type: 'number', min: 20, max: 400, step: 10 },
      description: 'Fastest drift duration in seconds.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '250' }, category: 'Motion' },
    },
    minScale: {
      control: { type: 'number', min: 0.1, max: 2, step: 0.1 },
      description: 'Smallest cloud scale (1 = native 320x140px).',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.5' }, category: 'Appearance' },
    },
    maxScale: {
      control: { type: 'number', min: 0.1, max: 2, step: 0.1 },
      description: 'Largest cloud scale.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.9' }, category: 'Appearance' },
    },
    bodyColor: {
      control: 'color',
      description: 'Main cloud-body color. Defaults through a CSS custom property so the design system owns the palette.',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'var(--cloud-body-color, currentColor)' },
        category: 'Appearance',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CloudParticles>;

export const Default: Story = {
  args: {
    'data-testid': 'cloud-particles',
    count: 3,
  },
  render: (args) => (
    <div className="relative h-[260px] w-full overflow-hidden rounded-lg border border-border">
      <CloudParticles {...args} />
      <div className="relative z-10 flex h-full items-center justify-center">
        <div className="rounded-md bg-background px-4 py-2 text-sm text-foreground">
          Drifting cloud backdrop
        </div>
      </div>
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const DenseAndSlow: Story = {
  name: 'Dense and slow (count=6, minSpeed=250, maxSpeed=350)',
  args: { ...Default.args, count: 6, minSpeed: 250, maxSpeed: 350 },
  render: Default.render,
};

export const Sparse: Story = {
  name: 'Sparse (count=1)',
  args: { ...Default.args, count: 1 },
  render: Default.render,
};
