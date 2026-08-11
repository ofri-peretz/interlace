import { SunnyBackground } from '@interlace/ui/aceternity/sunny-background';
import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * SunnyBackground stories
 *
 * A layered daylight atmosphere: corona, glow, overexposed core, rotating
 * conic light rays, lens flares, a horizon band and a depth vignette. It is
 * aria-hidden, pointer-events-none and absolute inset-0 on its own root, so
 * every story only needs a sized relative overflow-hidden parent.
 */

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-[280px] w-full overflow-hidden rounded-lg border border-border">
    {children}
  </div>
);

const Caption = ({ children }: { children: React.ReactNode }) => (
  <div className="relative z-10 flex h-full items-center justify-center p-6">
    <span className="rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground">
      {children}
    </span>
  </div>
);

const meta: Meta<typeof SunnyBackground> = {
  title: 'Aceternity/SunnyBackground',
  component: SunnyBackground,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A consumer-agnostic daylight surface for hero and section backdrops. Every color arrives as a prop funneled into CSS variables, so the whole system re-tints per brand or theme. size scales the entire disc without layout drift, and the conic ray rotation is suppressed under prefers-reduced-motion even mid-session.',
      },
    },
  },
  argTypes: {
    'data-testid': {
      control: 'text',
      description: 'Optional stable selector for end-to-end tests. Has no runtime default.',
      table: { type: { summary: 'string' }, category: 'Testing' },
    },
    size: {
      control: 'text',
      description: 'Diameter of the sun disc plus corona, as a CSS length. Every layer scales relative to this one value.',
      table: { type: { summary: 'string' }, defaultValue: { summary: '20rem' }, category: 'Appearance' },
    },
    corner: {
      control: 'select',
      options: ['top-right', 'top-left', 'center'],
      description: 'Where the sun disc anchors within the surface.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'top-right' }, category: 'Layout' },
    },
    animated: {
      control: 'boolean',
      description: 'Rotate the conic light rays. Disabled automatically under prefers-reduced-motion; the static layers keep rendering either way.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Motion' },
    },
    raysDurationSeconds: {
      control: { type: 'number', min: 10, max: 300, step: 10 },
      description: 'Seconds for one full rotation of the light rays.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '120' }, category: 'Motion' },
    },
    coreColor: {
      control: 'color',
      description: 'Overexposed core color, the brightest point of the sun.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'oklch(1 0 0)' }, category: 'Appearance' },
    },
    glowColor: {
      control: 'color',
      description: 'Warm halo color radiating from the core through the corona.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'oklch(0.95 0.06 85)' }, category: 'Appearance' },
    },
    skyTopColor: {
      control: 'color',
      description: 'Sky color at the zenith, the top of the surface.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'oklch(0.7 0.13 240)' }, category: 'Appearance' },
    },
    skyBottomColor: {
      control: 'color',
      description: 'Sky color at the horizon, the golden-hour band at the bottom.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'oklch(0.93 0.05 85)' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SunnyBackground>;

export const Default: Story = {
  args: {
    'data-testid': 'sunny-default',
    size: '20rem',
    corner: 'top-right',
    animated: true,
    raysDurationSeconds: 120,
  },
  render: (args) => (
    <Frame>
      <SunnyBackground {...args} />
      <Caption>Golden-hour hero</Caption>
    </Frame>
  ),
};

export const TopLeft: Story = {
  name: 'corner=top-left',
  args: { ...Default.args, 'data-testid': 'sunny-top-left', corner: 'top-left' },
  render: (args) => (
    <Frame>
      <SunnyBackground {...args} />
      <Caption>Anchored top-left</Caption>
    </Frame>
  ),
};

export const CustomPalette: Story = {
  name: 'Custom sunset palette',
  args: {
    ...Default.args,
    'data-testid': 'sunny-custom-palette',
    coreColor: 'oklch(1 0 0)',
    glowColor: 'oklch(0.85 0.15 25)',
    skyTopColor: 'oklch(0.3 0.08 280)',
    skyBottomColor: 'oklch(0.6 0.15 30)',
  },
  render: (args) => (
    <Frame>
      <SunnyBackground {...args} />
      <Caption>Retinted via the color props</Caption>
    </Frame>
  ),
};

export const Static: Story = {
  name: 'animated=false',
  args: { ...Default.args, 'data-testid': 'sunny-static', animated: false },
  render: (args) => (
    <Frame>
      <SunnyBackground {...args} />
      <Caption>Rays frozen, no rotation</Caption>
    </Frame>
  ),
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
