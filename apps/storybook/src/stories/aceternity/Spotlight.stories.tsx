import { Spotlight } from '@interlace/ui/aceternity/spotlight';
import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * Spotlight stories
 *
 * Decorative-only: the component renders aria-hidden, focusable=false and
 * pointer-events-none on its own root, so it never enters the a11y tree.
 * fill defaults to currentColor, so every story sets a Tailwind text token
 * on the wrapper to drive the glow color. The fade-in reveal is driven by
 * motion and is disabled automatically under prefers-reduced-motion.
 */

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-[280px] w-full overflow-hidden rounded-lg border border-border bg-background text-primary">
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

const meta: Meta<typeof Spotlight> = {
  title: 'Aceternity/Spotlight',
  component: Spotlight,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A soft, blurred conic glow that fades in to draw the eye toward hero content. Absolutely positioned so it never affects layout (CLS is zero). Reach for it behind a hero headline or CTA row, on top of a relative ancestor that sets a text color.',
      },
    },
  },
  argTypes: {
    'data-testid': {
      control: 'text',
      description: 'Required stable selector for end-to-end tests. Has no runtime default so an omission surfaces in review.',
      table: { type: { summary: 'string' }, category: 'Testing' },
    },
    fill: {
      control: 'text',
      description: 'Fill color of the glow. Accepts a CSS color token, a CSS custom property, or currentColor to inherit the surrounding text color.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'currentColor' }, category: 'Appearance' },
    },
    fillOpacity: {
      control: { type: 'range', min: 0, max: 1, step: 0.01 },
      description: 'Opacity of the glow once fully revealed.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.21' }, category: 'Appearance' },
    },
    duration: {
      control: { type: 'number', min: 0, max: 5, step: 0.1 },
      description: 'Duration of the fade-in reveal, in seconds. Ignored under prefers-reduced-motion.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '1.5' }, category: 'Motion' },
    },
    delay: {
      control: { type: 'number', min: 0, max: 3, step: 0.1 },
      description: 'Delay before the reveal starts, in seconds. Ignored under prefers-reduced-motion.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.2' }, category: 'Motion' },
    },
    className: {
      control: 'text',
      description: 'Merged onto the absolutely positioned root svg. Use it to reposition the glow, e.g. -top-40 left-0.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Spotlight>;

export const Default: Story = {
  args: {
    'data-testid': 'spotlight-default',
    fill: 'currentColor',
    fillOpacity: 0.21,
    duration: 1.5,
    delay: 0.2,
  },
  render: (args) => (
    <Frame>
      <Spotlight {...args} />
      <Caption>Hero headline sits above the glow</Caption>
    </Frame>
  ),
};

export const HighOpacity: Story = {
  name: 'fillOpacity=0.5',
  args: { ...Default.args, 'data-testid': 'spotlight-high-opacity', fillOpacity: 0.5 },
  render: (args) => (
    <Frame>
      <Spotlight {...args} />
      <Caption>Brighter glow for a darker surface</Caption>
    </Frame>
  ),
};

export const SlowReveal: Story = {
  name: 'duration=3, delay=1',
  args: { ...Default.args, 'data-testid': 'spotlight-slow-reveal', duration: 3, delay: 1 },
  render: (args) => (
    <Frame>
      <Spotlight {...args} />
      <Caption>A calmer, later fade-in</Caption>
    </Frame>
  ),
};

export const Repositioned: Story = {
  name: 'className repositions the glow',
  args: { ...Default.args, 'data-testid': 'spotlight-repositioned', className: '-top-20 left-1/4' },
  render: (args) => (
    <Frame>
      <Spotlight {...args} />
      <Caption>className=&quot;-top-20 left-1/4&quot;</Caption>
    </Frame>
  ),
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
