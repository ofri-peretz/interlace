import type { Meta, StoryObj } from '@storybook/react-vite';
import { BackgroundBeamsWithCollision } from '@interlace/ui/aceternity/background-beams-with-collision';

/**
 * BackgroundBeamsWithCollision stories
 *
 * The component owns its own sized container (default `h-96 md:h-[40rem]`,
 * override via `containerClassName`), so no story needs an extra wrapper.
 * Content passed as `children` renders inside the component's own
 * `relative z-10` layer, above the beams and the collision surface at the
 * bottom. Each story still puts that content on an opaque `bg-background`
 * card rather than directly on the gradient backdrop, so contrast holds up
 * under the theme-matrix axe gate.
 */

const meta: Meta<typeof BackgroundBeamsWithCollision> = {
  title: 'Aceternity/BackgroundBeamsWithCollision',
  component: BackgroundBeamsWithCollision,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A hero backdrop: thin beams fall from the top on a staggered loop and burst into a particle explosion when they hit the surface at the bottom. Motion pauses via IntersectionObserver when the component scrolls off-screen and is skipped entirely under prefers-reduced-motion. Beam and particle color come from the `--primary` / `--chart-2` tokens, so the effect re-themes with the palette rather than shipping a fixed hue.',
      },
    },
  },
  argTypes: {
    children: {
      control: false,
      description:
        'Content stacked above the beams and the floor. Wrap it in an opaque surface (e.g. a `bg-background` card) — the backdrop gradient and beams behind it are not a stable contrast surface for bare text.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    className: {
      control: 'text',
      description: 'Merged onto the content wrapper (the `relative z-10` div around children).',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
    containerClassName: {
      control: 'text',
      description:
        'Merged onto the outer container. This is where to set the height and background — the built-in default is `h-96 md:h-[40rem]` with a neutral gradient.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
    beams: {
      control: false,
      description:
        'Array of beam configs (start/end position, rotate, duration, delay, repeatDelay). Defaults to a 7-beam staggered set spread across the viewport width.',
      table: { type: { summary: 'BeamConfig[]' }, category: 'Motion' },
    },
    hideCollisionSurface: {
      control: 'boolean',
      description: 'Hide the visible floor styling at the bottom — for a full-page background with no explicit "ground".',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof BackgroundBeamsWithCollision>;

const CARD = 'rounded-md border border-border bg-background px-4 py-2 text-foreground shadow-sm';
const BOX = 'h-[280px] md:h-[280px] w-full overflow-hidden rounded-lg border border-border';

export const Default: Story = {
  args: {
    containerClassName: BOX,
    children: (
      <div className={CARD}>
        <p className="text-body">Ship it before the beams do.</p>
      </div>
    ),
  },
};

export const HiddenCollisionSurface: Story = {
  name: 'hideCollisionSurface (no visible floor)',
  args: {
    ...Default.args,
    hideCollisionSurface: true,
  },
};

export const CustomBeams: Story = {
  name: 'beams (custom 3-beam set)',
  args: {
    ...Default.args,
    beams: [
      { initialX: 40, translateX: 40, duration: 5, repeatDelay: 2 },
      { initialX: 220, translateX: 220, duration: 7, repeatDelay: 3, delay: 1, className: 'h-20' },
      { initialX: 400, translateX: 400, duration: 4, repeatDelay: 2, className: 'h-6' },
    ],
  },
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
