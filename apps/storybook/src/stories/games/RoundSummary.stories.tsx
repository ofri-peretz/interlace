import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Button } from '@interlace/ui/button';
import { RoundSummary } from '@interlace/ui/games/round-summary';
import { ShareCard } from '@interlace/ui/games/share-card';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Games/RoundSummary',
  component: RoundSummary,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The moment a round ends: XP earned (counted up), today\'s goal, the streak it kept, and any news (a milestone, a level), then the next step as children. ' +
          'It celebrates once after mount; pass `celebrate={false}` when showing a round finished earlier. Under reduced motion the numbers land at once and nothing bursts.',
      },
    },
  },
  args: {
    title: 'Round done',
    description: 'Four of five. The one you missed comes back first next time.',
    xp: 25,
    goal: { earned: 35, goal: 30 },
    streak: { current: 7, extended: true },
    highlight: 'A 7-day streak. You earned a streak shield.',
    celebrate: false,
  },
  render: (args) => (
    <div className="max-w-prose">
      <RoundSummary {...args}>
        <ShareCard title="Sample game" number={42} results={['right', 'right', 'wrong', 'right', 'right']} streak={7} />
        <Button variant="outline">Play another round</Button>
      </RoundSummary>
    </div>
  ),
} satisfies Meta<typeof RoundSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Everything: XP, goal met, the streak kept, a milestone, and the next step. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Round done' })).toBeTruthy();
    await expect(canvas.getByRole('status')).toHaveTextContent('7-day streak');
  },
};

/** The goal not met yet, nothing new. */
export const Plain: Story = {
  args: { goal: { earned: 10, goal: 30 }, streak: { current: 3 }, highlight: undefined, description: undefined },
};

/** With the count and bursts, as a player sees it when the round ends. */
export const Celebrating: Story = { args: { celebrate: true } };

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
