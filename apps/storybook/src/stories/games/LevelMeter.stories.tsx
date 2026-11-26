import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { LevelMeter } from '@interlace/ui/games/level-meter';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Games/LevelMeter',
  component: LevelMeter,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A player\'s level and how far they are into the next. With `gained`, the XP just earned shows as a chip and the bar fills from where it was ' +
          '(from empty if the gain finished a level). Levels cost 100, 150, 200… XP by default; pass `curve` to change that. The arithmetic is `levelFor` in `progress-model`.',
      },
    },
  },
  args: { xp: 130 },
  render: (args) => (
    <div className="max-w-prose">
      <LevelMeter {...args} />
    </div>
  ),
} satisfies Meta<typeof LevelMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Resting: level, bar, what is left. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Level 2')).toBeTruthy();
  },
};

/** Right after a round: the gain and the bar filling from before it. */
export const AfterAGain: Story = { args: { gained: 20 } };

/** A gain that finished a level. */
export const LevelUp: Story = { args: { xp: 110, gained: 20 } };

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl], args: { gained: 20 } };
