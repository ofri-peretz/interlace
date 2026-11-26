import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { GoalRing } from '@interlace/ui/games/goal-ring';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Games/GoalRing',
  component: GoalRing,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'How far today is toward a daily goal: a ring that fills as points come in, the count in its middle, a check once it is met. ' +
          'A `meter`, so assistive tech reads "15 of 20 XP". The fill draws in and moves on change (CSS, `motion-safe:` only), so it renders on the server.',
      },
    },
  },
  args: { value: 15, goal: 20 },
} satisfies Meta<typeof GoalRing>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Part of the way there. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const meter = within(canvasElement).getByRole('meter', { name: 'Daily goal' });
    await expect(meter).toHaveAttribute('aria-valuetext', '15 of 20 XP');
  },
};

/** The goal is met: a check in place of the count. */
export const Met: Story = { args: { value: 20 } };

/** Three sizes, side by side. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-6">
      <GoalRing {...args} size="sm" />
      <GoalRing {...args} />
      <GoalRing {...args} size="lg" />
    </div>
  ),
};

/** Right to left: the ring fills the other way. */
export const RightToLeft: Story = { decorators: [withRtl], args: { value: 8 } };
