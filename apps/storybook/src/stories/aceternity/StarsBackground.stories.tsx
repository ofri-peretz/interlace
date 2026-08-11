import { ShootingStars, StarsBackground } from '@interlace/ui/aceternity/stars-background';
import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * StarsBackground stories
 *
 * A twinkling canvas starfield for night-themed hero surfaces. Star count is
 * derived from the container area times starDensity, so it self-scales to
 * whatever box it fills. Neither this component nor its sibling
 * ShootingStars sets aria-hidden on its own root, so every story wraps the
 * layer itself before compositing content above it. Both pause their
 * animation via IntersectionObserver when scrolled out of view, and
 * StarsBackground paints one static frame under prefers-reduced-motion
 * (ShootingStars renders nothing at all in that case).
 */

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-[280px] w-full overflow-hidden rounded-lg border border-border bg-slate-950">
    {children}
  </div>
);

const Sky = ({ children }: { children: React.ReactNode }) => (
  <div aria-hidden="true" className="absolute inset-0">
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

const meta: Meta<typeof StarsBackground> = {
  title: 'Aceternity/StarsBackground',
  component: StarsBackground,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A canvas starfield that twinkles independently per star. Fill the sibling ShootingStars alongside it for an occasional streak across the same surface. Neither primitive sets aria-hidden on its own root, so a consumer wraps the pair before dropping it behind hero content.',
      },
    },
  },
  argTypes: {
    starDensity: {
      control: { type: 'number', min: 0.00005, max: 0.001, step: 0.00005 },
      description: 'Stars per square pixel of the container, multiplied by width times height to get the star count.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.00015' }, category: 'Data' },
    },
    allStarsTwinkle: {
      control: 'boolean',
      description: 'When true every star twinkles. When false, twinkleProbability decides per star.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Behavior' },
    },
    twinkleProbability: {
      control: { type: 'range', min: 0, max: 1, step: 0.05 },
      description: 'Chance a given star twinkles, used only when allStarsTwinkle is false.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.7' }, category: 'Behavior' },
    },
    minTwinkleSpeed: {
      control: { type: 'number', min: 0.1, max: 3, step: 0.1 },
      description: 'Fastest twinkle period, in seconds, for a twinkling star.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.5' }, category: 'Motion' },
    },
    maxTwinkleSpeed: {
      control: { type: 'number', min: 0.1, max: 3, step: 0.1 },
      description: 'Slowest twinkle period, in seconds, for a twinkling star.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '1' }, category: 'Motion' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof StarsBackground>;

export const Default: Story = {
  args: {
    starDensity: 0.00015,
    allStarsTwinkle: true,
    twinkleProbability: 0.7,
    minTwinkleSpeed: 0.5,
    maxTwinkleSpeed: 1,
  },
  render: (args) => (
    <Frame>
      <Sky>
        <StarsBackground {...args} />
      </Sky>
      <Caption>Night hero backdrop</Caption>
    </Frame>
  ),
};

export const Dense: Story = {
  name: 'starDensity=0.0006',
  args: { ...Default.args, starDensity: 0.0006 },
  render: (args) => (
    <Frame>
      <Sky>
        <StarsBackground {...args} />
      </Sky>
      <Caption>A denser field</Caption>
    </Frame>
  ),
};

export const SlowTwinkle: Story = {
  name: 'minTwinkleSpeed=1.5, maxTwinkleSpeed=3',
  args: { ...Default.args, minTwinkleSpeed: 1.5, maxTwinkleSpeed: 3 },
  render: (args) => (
    <Frame>
      <Sky>
        <StarsBackground {...args} />
      </Sky>
      <Caption>Slower, calmer twinkle</Caption>
    </Frame>
  ),
};

export const WithShootingStars: Story = {
  name: 'Composed with the sibling ShootingStars primitive',
  args: { ...Default.args },
  render: (args) => (
    <Frame>
      <Sky>
        <StarsBackground {...args} />
        <ShootingStars minDelay={400} maxDelay={1200} />
      </Sky>
      <Caption>Twinkling field plus an occasional shooting star</Caption>
    </Frame>
  ),
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
