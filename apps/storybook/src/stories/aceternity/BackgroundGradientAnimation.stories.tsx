import type { Meta, StoryObj } from '@storybook/react-vite';
import { BackgroundGradientAnimation } from '@interlace/ui/aceternity/background-gradient-animation';

/**
 * BackgroundGradientAnimation stories
 *
 * The root renders `h-full w-full` with no intrinsic size, so every story
 * sets an explicit height through `className` (it merges last and wins over
 * the built-in `h-full`) instead of adding an outer wrapper. `children`
 * already renders inside the component's own `relative z-10` content layer,
 * so it stacks correctly above the blob layer without extra markup. The
 * blobs are a saturated `hard-light`-blended wash, so every story keeps its
 * text on an opaque `bg-background` card rather than directly on the effect.
 */

const meta: Meta<typeof BackgroundGradientAnimation> = {
  title: 'Aceternity/BackgroundGradientAnimation',
  component: BackgroundGradientAnimation,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The "lava lamp" aurora effect: five blobs drift and orbit under an SVG goo filter, blended with `mix-blend-mode`. Every color resolves through a CSS variable with a brand-token fallback, so the default look is on-brand and stays green against `no-raw-color-literal`. The pointer-follow blob eases toward the cursor via a single rAF loop and is skipped under prefers-reduced-motion; the looping blob drift is CSS keyframes, killed by the same global reduced-motion reset.',
      },
    },
  },
  argTypes: {
    gradientBackgroundStart: {
      control: 'text',
      description: 'CSS color for the start of the backdrop linear-gradient. Pass a token reference to stay on-brand.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'var(--interlace-accent)' }, category: 'Colors' },
    },
    gradientBackgroundEnd: {
      control: 'text',
      description: 'CSS color for the end of the backdrop linear-gradient.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'var(--interlace-primary-active)' }, category: 'Colors' },
    },
    firstColor: {
      control: 'text',
      description: 'Color of the first, largest, vertically-drifting blob.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'var(--interlace-primary)' }, category: 'Colors' },
    },
    secondColor: {
      control: 'text',
      description: 'Color of the second, counter-rotating blob.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'var(--interlace-primary-hover)' }, category: 'Colors' },
    },
    size: {
      control: 'text',
      description: 'Diameter of each blob, as a CSS length relative to the container. Larger values read softer and more diffuse.',
      table: { type: { summary: 'string' }, defaultValue: { summary: '80%' }, category: 'Appearance' },
    },
    blendMode: {
      control: 'select',
      options: ['normal', 'multiply', 'screen', 'overlay', 'hard-light', 'soft-light', 'lighten', 'darken'],
      description: '`mix-blend-mode` applied between the blobs. `hard-light` is the vivid default; `normal` calms the surface for denser content on top.',
      table: { type: { summary: 'GradientBlendMode' }, defaultValue: { summary: 'hard-light' }, category: 'Appearance' },
    },
    interactive: {
      control: 'boolean',
      description: 'Render a blob that eases toward the pointer on move. Disabled automatically under prefers-reduced-motion.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Motion' },
    },
    children: {
      control: false,
      description: 'Content z-stacked above the decorative blob layer, which is itself `aria-hidden`.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    contentClassName: {
      control: 'text',
      description: 'Merged onto the foreground content wrapper — use it to position or pad children.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
    className: {
      control: 'text',
      description: 'Merged onto the root. This is where to set an explicit height — the root has no intrinsic size on its own.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof BackgroundGradientAnimation>;

const CARD = 'rounded-md border border-border bg-background px-4 py-2 text-foreground shadow-sm';
const BOX = 'h-[280px] w-full overflow-hidden rounded-lg border border-border';
const CENTER = 'flex h-full items-center justify-center p-6';

export const Default: Story = {
  args: {
    className: BOX,
    contentClassName: CENTER,
    children: (
      <div className={CARD}>
        <p className="text-body">Colors drift like light through water.</p>
      </div>
    ),
  },
};

export const CalmSurface: Story = {
  name: 'blendMode "normal", interactive off',
  args: {
    ...Default.args,
    blendMode: 'normal',
    interactive: false,
  },
};

export const CustomPalette: Story = {
  name: 'firstColor / secondColor / thirdColor override',
  args: {
    ...Default.args,
    firstColor: 'var(--chart-1)',
    secondColor: 'var(--chart-3)',
    thirdColor: 'var(--chart-5)',
    blendMode: 'soft-light',
  },
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
