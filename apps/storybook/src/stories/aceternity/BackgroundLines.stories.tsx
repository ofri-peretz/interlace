import type { Meta, StoryObj } from '@storybook/react-vite';
import { BackgroundLines } from '@interlace/ui/aceternity/background-lines';

/**
 * BackgroundLines stories
 *
 * The component owns its own sized container (default `h-[20rem] md:h-screen`,
 * override via `className`), so no story needs an extra wrapper. `children`
 * already renders inside the component's own `relative z-10` layer, above
 * the animated SVG paths. Each story still puts its content on an opaque
 * `bg-background` card rather than directly on the multicolor line layer.
 */

const meta: Meta<typeof BackgroundLines> = {
  title: 'Aceternity/BackgroundLines',
  component: BackgroundLines,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A backdrop of twelve hand-picked SVG paths that draw themselves on a loop, each on its own stable delay so the sweep never syncs up. Rendering pauses via IntersectionObserver when the component scrolls off-screen and is skipped entirely under prefers-reduced-motion. The lines sit at 40% opacity behind `children`, which is the only slot the component exposes.',
      },
    },
  },
  argTypes: {
    children: {
      control: false,
      description: 'Content stacked above the animated line layer. Wrap it in an opaque surface — the lines behind it are not a stable contrast background.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    className: {
      control: 'text',
      description: 'Merged onto the root. This is where to set the height — the built-in default is `h-[20rem] md:h-screen`.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
    svgOptions: {
      control: 'object',
      description: 'Animation timing overrides passed to the SVG paths. `duration` is one full draw-loop in seconds.',
      table: { type: { summary: '{ duration?: number }' }, defaultValue: { summary: '{ duration: 10 }' }, category: 'Motion' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof BackgroundLines>;

const CARD = 'rounded-md border border-border bg-background px-4 py-2 text-foreground shadow-sm';
const BOX = 'h-[280px] md:h-[280px] w-full overflow-hidden rounded-lg border border-border';

export const Default: Story = {
  args: {
    className: BOX,
    children: (
      <div className="flex h-full items-center justify-center p-6">
        <div className={CARD}>
          <p className="text-body">Twelve paths, one loop, never in sync.</p>
        </div>
      </div>
    ),
  },
};

export const SlowLoop: Story = {
  name: 'svgOptions.duration = 20 (slow draw)',
  args: {
    ...Default.args,
    svgOptions: { duration: 20 },
  },
};

export const FastLoop: Story = {
  name: 'svgOptions.duration = 4 (fast draw)',
  args: {
    ...Default.args,
    svgOptions: { duration: 4 },
  },
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
