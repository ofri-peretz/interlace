import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { Button } from '@interlace/ui/button';
import { Standings } from '@interlace/ui/games/standings';
import { withRtl } from '@/decorators';

// Invented players and scores: Blake climbs from third to first.
const ROUND = [
  { id: 'a', name: 'Avery', score: 2400, gained: 400 },
  { id: 'b', name: 'Blake', score: 2600, gained: 980 },
  { id: 'c', name: 'Casey', score: 1700, gained: 0 },
  { id: 'd', name: 'Drew', score: 1500, gained: 300 },
  { id: 'e', name: 'Emery', score: 1900, gained: 870 },
  { id: 'f', name: 'Finley Montgomery-Wellington', score: 900, gained: 0 },
];

const meta = {
  title: 'Games/Standings',
  component: Standings,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The board between rounds of a live game: who is where now, and how they got there. Three beats the eye can follow: each player’s points from the round pop in, the totals count up from where they were, then the rows glide to their new places and a climb shows its arrow.\n\n' +
          '**Words first.** An ordered list in the final order once the glide starts; every row reads as one sentence: place, name, points this round, places gained, total. The moving digits are hidden from assistive tech.\n\n' +
          '**Calm when asked.** Under reduced motion, or with `animate={false}`, the board is simply in its new order.\n\n' +
          'Ranking is `rankEntries` from leaderboard-model, so ties share a place. Pass `gained` (already inside `score`); `roomStandings(room)` with `room.lastPoints` gives both in a live room.',
      },
    },
  },
  args: { caption: 'After round 3', entries: ROUND, locale: 'en-US' },
  render: (args) => (
    <div className="max-w-96">
      <Standings {...args} />
    </div>
  ),
} satisfies Meta<typeof Standings>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The big screen after a round: the counts, then the glide. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const board = canvas.getByRole('region', { name: 'After round 3' });
    await waitFor(() => expect(board.getAttribute('data-phase')).toBe('after'), { timeout: 3000 });
    const rows = within(board).getAllByRole('listitem');
    await expect(rows[0]?.textContent).toContain('Blake');
    await expect(rows[0]?.textContent).toContain('up 2 places');
  },
};

/** A player's phone: their row marked, and kept when it falls below the top rows. */
export const OnAPhone: Story = {
  args: { currentId: 'f', limit: 3 },
};

/** Without motion: the new order at once. */
export const Still: Story = { args: { animate: false } };

function ReplayDemo() {
  const [round, setRound] = React.useState(0);
  return (
    <div className="grid max-w-96 gap-4">
      <Standings key={round} caption="After round 3" entries={ROUND} locale="en-US" />
      <div>
        <Button type="button" variant="outline" onClick={() => setRound((r) => r + 1)}>
          Play it again
        </Button>
      </div>
    </div>
  );
}

/** Watch the three beats again. */
export const Replay: Story = { render: () => <ReplayDemo /> };

export const RightToLeft: Story = { decorators: [withRtl], args: { animate: false } };
