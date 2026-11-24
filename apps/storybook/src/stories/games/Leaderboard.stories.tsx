import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Leaderboard } from '@interlace/ui/games/leaderboard';
import { withRtl } from '@/decorators';

// Invented players.
const ENTRIES = [
  { id: 'a', name: 'Avery', score: 280 },
  { id: 'b', name: 'Blake', score: 265 },
  { id: 'c', name: 'Casey', score: 265 },
  { id: 'd', name: 'Drew', score: 240 },
  { id: 'e', name: 'Emery', score: 230 },
  { id: 'f', name: 'Finley', score: 190 },
  { id: 'g', name: 'Gray', score: 175 },
  { id: 'h', name: 'Harper Montgomery-Wellington', score: 150 },
  { id: 'i', name: 'Indigo', score: 120 },
];

const meta = {
  title: 'Games/Leaderboard',
  component: Leaderboard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A group’s board: rank, name and score, ties sharing a rank ("=2"), the viewer’s row marked with a word and kept even below the top rows.\n\n' +
          '**Privacy by size.** `minPlayers` holds the board back until enough people have played that no score stands alone.\n\n' +
          '**A real table.** Captioned, with row headers, so a screen reader moves by row and column.\n\n' +
          '**Same ranks on the server.** `rankEntries` and `buildBoard` in `games/leaderboard-model` are pure.',
      },
    },
  },
  args: { entries: ENTRIES, caption: 'This week', showCaption: true, limit: 5, currentId: 'h', minPlayers: 5, locale: 'en-US' },
  render: (args) => (
    <div className="max-w-prose">
      <Leaderboard {...args} />
    </div>
  ),
} satisfies Meta<typeof Leaderboard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Top five, a tie, and the viewer below the cut. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('table', { name: 'This week' })).toBeTruthy();
    await expect(canvas.getByText('You')).toBeTruthy();
  },
};

/** The viewer in the top rows. */
export const ViewerOnTop: Story = {
  args: { currentId: 'b' },
};

/** Fewer players than `minPlayers`: the board waits. */
export const NotEnoughPlayers: Story = {
  args: { entries: ENTRIES.slice(0, 3) },
};

/** Lowest wins: time in seconds. */
export const LowestWins: Story = {
  args: {
    order: 'asc',
    entries: ENTRIES.map((e, i) => ({ ...e, score: 40 + i * 7 })),
    format: { style: 'unit', unit: 'second' },
    caption: 'Fastest today',
  },
};

export const RightToLeft: Story = {
  decorators: [withRtl],
  args: { caption: 'هذا الأسبوع', labels: { you: 'أنت' }, locale: 'ar' },
};

/** A long name truncates before the score moves, at the 288px a phone leaves. */
export const Narrow: Story = {
  render: (args) => (
    <div className="w-72">
      <Leaderboard {...args} />
    </div>
  ),
};
