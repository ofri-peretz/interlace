import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DotVote } from '@interlace/ui/games/dot-vote';
import { withRtl } from '@/decorators';

// Neutral ideas about the session itself, so the demo makes no claim about anyone.
const IDEAS = [
  { id: 'breaks', text: 'Longer breaks between parts' },
  { id: 'playlist', text: 'A shared playlist while we work' },
  { id: 'snacks', text: 'Snacks from each team' },
  { id: 'walk', text: 'A walking meeting once a week' },
];

const BALLOTS = {
  p1: { breaks: 2, walk: 1 },
  p2: { playlist: 1, walk: 2 },
  p3: { walk: 2, snacks: 1 },
  p4: { breaks: 1, playlist: 1, snacks: 1 },
  p5: { breaks: 2, walk: 1 },
};

const meta = {
  title: 'Games/DotVote',
  component: DotVote,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Brainstorm, then choose. Each person spreads a few dots across the ideas (two on one idea means "this one, really"), sends them, and the ideas rank themselves as the room’s dots arrive.\n\n' +
          '**The model.** `games/dot-vote-model` makes a ballot valid (`cleanBallot`), counts dots left (`dotsLeft`) and ranks ballots keyed by person (`tallyDots`), so a ballot sent twice counts once.',
      },
    },
  },
  args: {
    question: 'Which ideas should we try next month?',
    ideas: IDEAS,
    dots: 3,
    maxPerIdea: 2,
    locale: 'en-US',
  },
  render: (args) => (
    <div className="max-w-128">
      <DotVote {...args} />
    </div>
  ),
} satisfies Meta<typeof DotVote>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sent: the room's dots, most first, the viewer's own named. */
export const Default: Story = {
  args: { value: { breaks: 1, walk: 2 }, ballots: BALLOTS },
};

/** Voting, before anything is placed. */
export const Voting: Story = {};

/** The room keeps voting after this viewer sent: ideas glide to their new rank. */
export const Live: Story = {
  render: function Render(args) {
    const [ballots, setBallots] = React.useState<Record<string, Record<string, number>>>({
      p1: { breaks: 2, walk: 1 },
    });
    const more = Object.entries(BALLOTS).filter(([k]) => !(k in ballots));
    return (
      <div className="grid max-w-128 gap-4">
        <button
          type="button"
          className="justify-self-start text-sm underline disabled:no-underline disabled:opacity-60"
          disabled={more.length === 0}
          onClick={() => {
            const next = more[0];
            if (next) setBallots((b) => ({ ...b, [next[0]]: next[1] }));
          }}
        >
          Another person votes
        </button>
        <DotVote {...args} defaultValue={{ snacks: 1 }} ballots={ballots} />
      </div>
    );
  },
};

export const RightToLeft: Story = {
  decorators: [withRtl],
  args: { value: { breaks: 1, walk: 2 }, ballots: BALLOTS },
};
