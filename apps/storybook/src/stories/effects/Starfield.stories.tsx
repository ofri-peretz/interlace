import { Starfield } from '@interlace/ui/effects/starfield';
import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * Starfield stories. The sky sits behind content on a dark hero surface, so
 * every story frames it in a `relative` panel on the hero tokens.
 */
const meta: Meta<typeof Starfield> = {
  title: 'Effects/Starfield',
  component: Starfield,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A night sky behind a hero: still stars, a share of them breathing, an occasional shooting star and a few slow meteors, all on one canvas with one frame loop that sleeps out of view. Colours come from the `--hero-star` and `--hero-meteor` tokens. Under reduced motion the sky paints once and stops.',
      },
    },
  },
  argTypes: {
    density: { control: { type: 'number', step: 0.0001 }, table: { category: 'Sky', defaultValue: { summary: '0.0002' } } },
    twinkle: { control: { type: 'range', min: 0, max: 1, step: 0.05 }, table: { category: 'Sky', defaultValue: { summary: '0.7' } } },
    meteors: { control: { type: 'number', min: 0, max: 8 }, table: { category: 'Motion', defaultValue: { summary: '2' } } },
    shootingStars: { control: 'object', table: { category: 'Motion', defaultValue: { summary: '[3, 8]' } } },
  },
  render: (args) => (
    <div className="bg-hero-surface-deep text-hero-foreground relative grid h-[28rem] place-items-center overflow-hidden">
      <Starfield {...args} />
      <p className="relative text-2xl font-semibold">Content sits above the sky</p>
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof Starfield>;

export const Default: Story = {};
export const Calm: Story = { args: { density: 0.0001, twinkle: 0.3, meteors: 0, shootingStars: false } };
export const Busy: Story = { args: { density: 0.0004, meteors: 5, shootingStars: [1, 3] } };
