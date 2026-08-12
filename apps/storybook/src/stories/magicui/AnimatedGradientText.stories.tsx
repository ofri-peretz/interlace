import type { Meta, StoryObj } from '@storybook/react-vite';
import { AnimatedGradientText } from '@interlace/ui/magicui/animated-gradient-text';

/**
 * AnimatedGradientText stories
 *
 * The component is a single `<span>` whose fill is a scrolling two-stop
 * gradient (`background-position` driven by the `animate-gradient`
 * keyframe), clipped to the text with `bg-clip-text text-transparent`.
 * There is no decorative wrapper to hide behind — the text itself is the
 * effect — so every story renders it under a plain, token-colored caption
 * inside a bordered card. That gives axe a stable non-gradient anchor
 * nearby and gives the registry thumbnail a realistic marketing-eyebrow
 * composition instead of one line of text floating on a blank canvas.
 */

const meta: Meta<typeof AnimatedGradientText> = {
  title: 'MagicUI/AnimatedGradientText',
  component: AnimatedGradientText,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A scrolling two-stop gradient clipped to inline text — the copy-side equivalent of `ShimmerButton`: spend it once per surface, on the phrase that should read as new or premium, never on body copy. `speed` widens the gradient tile (`--bg-size: speed * 300%`); the loop duration is fixed, so a wider tile reads as a slower sweep. `colorFrom`/`colorTo` are raw hex values fed straight into `--color-from`/`--color-to` — the one place in this system a literal hex is expected, since the point is a specific brand gradient rather than a token pair.',
      },
    },
  },
  argTypes: {
    children: {
      control: 'text',
      description:
        'The text the gradient is clipped to. Keep it short — this is an accent, not a paragraph.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    speed: {
      control: 'select',
      options: [0.5, 1, 1.5, 2, 3],
      description:
        'Multiplies the gradient tile size (`--bg-size: speed * 300%`). The animation duration is fixed at 8s, so a larger tile covers more ground per cycle and reads as a slower, calmer sweep.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '1' }, category: 'Motion' },
    },
    colorFrom: {
      control: 'color',
      description:
        'First and third gradient stop (`from → to → from`, so the loop has no seam), fed to `--color-from`.',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: '#ffaa40' },
        category: 'Appearance',
      },
    },
    colorTo: {
      control: 'color',
      description: 'Middle gradient stop, fed to `--color-to`.',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: '#9c40ff' },
        category: 'Appearance',
      },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the `<span>` — the seam for font size and weight, since the component ships no typography of its own.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AnimatedGradientText>;

export const Default: Story = {
  args: {
    children: 'Introducing the Interlace design system',
    speed: 1,
    colorFrom: '#ffaa40',
    colorTo: '#9c40ff',
  },
  render: (args) => (
    <div className="rounded-lg border border-border bg-background p-6">
      <p className="mb-2 text-sm text-muted-foreground">Eyebrow</p>
      <AnimatedGradientText {...args} className="text-xl font-semibold" />
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const FastSweep: Story = {
  name: 'Fast sweep (speed=0.5)',
  args: { ...Default.args, speed: 0.5, children: 'Fast sweep' },
  render: Default.render,
};

export const SlowSweep: Story = {
  name: 'Slow, calmer sweep (speed=3)',
  args: { ...Default.args, speed: 3, children: 'Slow, calmer sweep' },
  render: Default.render,
};

export const BrandGradient: Story = {
  name: 'Interlace brand gradient',
  args: {
    ...Default.args,
    colorFrom: '#f4794a',
    colorTo: '#a84c17',
    children: 'Now shipping v2.0',
  },
  render: Default.render,
};
