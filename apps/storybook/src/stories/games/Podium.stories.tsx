import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Podium } from '@interlace/ui/games/podium';
import { withRtl } from '@/decorators';

// Invented players.
const ENTRIES = [
  { id: 'a', name: 'Avery', score: 4200 },
  { id: 'b', name: 'Blake', score: 5150 },
  { id: 'c', name: 'Casey', score: 3980 },
  { id: 'd', name: 'Drew', score: 3100 },
  { id: 'e', name: 'Emery', score: 2875 },
  { id: 'f', name: 'Harper Montgomery-Wellington', score: 1990 },
];

const meta = {
  title: 'Games/Podium',
  component: Podium,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The end of a game: the top three on steps, and everyone else below so no one wonders where they came. Ranking is the leaderboard’s, so ties share a place.\n\n' +
          '**Reads in order.** The list is 1st, 2nd, 3rd for a screen reader and a phone; the steps stand 2nd, 1st, 3rd through grid columns, which mirror in RTL.\n\n' +
          '**Motion.** The steps grow up from the floor, 3rd, 2nd, then 1st, 350ms apart, and the winner gets a Celebrate burst. Transform and opacity only, replayed when `play` changes, and simply there under reduced motion.',
      },
    },
  },
  args: { entries: ENTRIES, currentId: 'e', locale: 'en-US' },
  argTypes: {
    animate: { control: 'boolean' },
    showRest: { control: 'boolean' },
    locale: { control: 'text' },
  },
  render: (args) => (
    <div className="max-w-prose">
      <Podium {...args} />
    </div>
  ),
} satisfies Meta<typeof Podium>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('list', { name: 'Top three' })).toBeTruthy();
  },
};

/** The viewer on the top step. */
export const YouWon: Story = { args: { currentId: 'b', showRest: false } };

/** Two players: the podium keeps its shape. */
export const TwoPlayers: Story = {
  args: { entries: ENTRIES.slice(0, 2), currentId: 'a' },
};

export const RightToLeft: Story = { decorators: [withRtl] };
