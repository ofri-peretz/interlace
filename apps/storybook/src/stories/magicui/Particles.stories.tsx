import { Particles } from '@interlace/ui/magicui/particles';
import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * Particles stories
 *
 * Decorative-only: the component renders `aria-hidden` and
 * `pointer-events-none` on its own, so it never enters the a11y tree. It
 * paints in the wrapper's resolved `currentColor` rather than a hex prop —
 * retint by putting a Tailwind text token on the wrapper `className`.
 *
 * Every story below gives the canvas a sized `relative overflow-hidden`
 * parent (it is absolutely positioned and fills its container) and keeps any
 * caption text in a `relative z-10` layer above the field.
 */

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-[240px] w-full overflow-hidden rounded-lg border border-border bg-background">
    {children}
  </div>
);

const Caption = ({ children }: { children: React.ReactNode }) => (
  <div className="relative z-10 flex h-full items-center justify-center">
    <span className="rounded-lg bg-background/80 px-4 py-2 text-sm font-medium text-foreground backdrop-blur-sm">
      {children}
    </span>
  </div>
);

const meta: Meta<typeof Particles> = {
  title: 'MagicUI/Particles',
  component: Particles,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An ambient canvas particle field for hero and section backdrops. ' +
          'Respects `prefers-reduced-motion` by painting one static frame instead ' +
          'of animating, and skips the pointer listener entirely when ' +
          '`interactive` is off.',
      },
    },
  },
  argTypes: {
    quantity: {
      control: { type: 'number', min: 10, max: 400, step: 10 },
      description: 'Number of particles to render.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '100' }, category: 'Data' },
    },
    staticity: {
      control: { type: 'number', min: 10, max: 200, step: 10 },
      description: 'Resistance to the pointer — higher values drift less toward the cursor.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '50' }, category: 'Behavior' },
    },
    ease: {
      control: { type: 'number', min: 10, max: 200, step: 10 },
      description: 'Easing factor for pointer-follow interpolation — higher is slower and smoother.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '50' }, category: 'Behavior' },
    },
    size: {
      control: { type: 'number', min: 0.1, max: 3, step: 0.1 },
      description: 'Base particle radius in CSS pixels; each particle adds 0-2px of jitter.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.4' }, category: 'Appearance' },
    },
    vx: {
      control: { type: 'number', min: -2, max: 2, step: 0.1 },
      description: 'Ambient horizontal drift applied every frame.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0' }, category: 'Behavior' },
    },
    vy: {
      control: { type: 'number', min: -2, max: 2, step: 0.1 },
      description: 'Ambient vertical drift applied every frame.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0' }, category: 'Behavior' },
    },
    interactive: {
      control: 'boolean',
      description: 'Drift toward the pointer as it moves over the field. Off for a purely ambient backdrop.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Behavior' },
    },
    className: {
      control: 'text',
      description: 'A Tailwind text token recolors the field, e.g. `text-primary`.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Particles>;

export const Default: Story = {
  args: { quantity: 100, staticity: 50, ease: 50, size: 0.4, interactive: true },
  render: (args) => (
    <Frame>
      <Particles {...args} className="absolute inset-0 text-foreground" />
      <Caption>Hero backdrop</Caption>
    </Frame>
  ),
};

export const Dense: Story = {
  args: { ...Default.args, quantity: 300, size: 0.6 },
  render: (args) => (
    <Frame>
      <Particles {...args} className="absolute inset-0 text-foreground" />
      <Caption>Dense field — quantity=300</Caption>
    </Frame>
  ),
};

export const BrandColor: Story = {
  name: 'Recolored via className',
  args: { ...Default.args, quantity: 140 },
  render: (args) => (
    <Frame>
      <Particles {...args} className="absolute inset-0 text-primary" />
      <Caption>className=&quot;text-primary&quot;</Caption>
    </Frame>
  ),
};

export const NonInteractive: Story = {
  name: 'interactive={false}',
  args: { ...Default.args, interactive: false },
  render: (args) => (
    <Frame>
      <Particles {...args} className="absolute inset-0 text-foreground" />
      <Caption>Ambient only — no pointer listener</Caption>
    </Frame>
  ),
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
