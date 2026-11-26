import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Milestones } from '@interlace/ui/games/milestones';
import { DEFAULT_STREAK_MILESTONES } from '@interlace/ui/games/progress-model';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Games/Milestones',
  component: Milestones,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The marks along a path a player is on: the ones reached (filled, with an award), the next (a ring in the accent), and a few ahead (dashed). ' +
          'Only a window around the next mark is drawn, so it shows where the player is going rather than a wall of locked trophies.',
      },
    },
  },
  args: {
    value: 9,
    steps: DEFAULT_STREAK_MILESTONES,
    labels: { step: (n: number, f: string) => (n === 1 ? '1 day' : `${f} days`) },
  },
  render: (args) => (
    <div className="max-w-prose">
      <Milestones {...args} />
    </div>
  ),
} satisfies Meta<typeof Milestones>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two reached, the next, and what follows. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('5 more to 14 days')).toBeTruthy();
  },
};

/** Just starting out. */
export const FirstDay: Story = { args: { value: 1 } };

/** Every mark reached. */
export const AllReached: Story = { args: { value: 400 } };

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
