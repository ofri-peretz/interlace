import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { DuelCard, DuelCompare, DuelInvite } from '@interlace/ui/games/duel';
import { decodeDuel, duelHref, encodeDuel, type DuelChallenge } from '@interlace/ui/games/duel-model';
import { withRtl } from '@/decorators';

// Invented players and scores.
const AVERY = { name: 'Avery', rounds: [300, 120, 250, 80, 300] };
const BLAKE = { name: 'Blake', rounds: [220, 180, 250, 140, 190] };

const meta = {
  title: 'Games/Duel',
  component: DuelCompare,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Two players, one game, by link. The first player finishes and sends a challenge (`DuelInvite`); the second opens it and sees who they are up against (`DuelCard`); after the same game, both see every round side by side (`DuelCompare`).\n\n' +
          '**The challenge is the link.** `games/duel-model` puts the game, its seed and the first player’s rounds in a short base64url token (`encodeDuel`, `duelHref`), and `decodeDuel` reads it back as untrusted input: capped, cleaned, null when malformed. A link is a friendly claim; where it matters, keep the challenge on a server and pass its id (or a `sig`).\n\n' +
          '**Pure comparison.** `compareDuel` gives each round’s winner, the totals, rounds won, the winner and the margin, with `order: "asc"` for games where less is better.\n\n' +
          '**Words first.** The verdict, a "Won" tag and each round’s winner are text; bars grow out from the middle (transform only), a Celebrate burst marks the viewer’s win, and nothing moves under reduced motion.',
      },
    },
  },
  args: { a: AVERY, b: BLAKE, you: 'b', locale: 'en-US' },
  argTypes: {
    you: { control: 'inline-radio', options: ['a', 'b'] },
    order: { control: 'inline-radio', options: ['desc', 'asc'] },
    animate: { control: 'boolean' },
  },
  render: (args) => (
    <div className="max-w-prose">
      <DuelCompare {...args} />
    </div>
  ),
} satisfies Meta<typeof DuelCompare>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both results, round by round. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Avery won by 70 points.')).toBeTruthy();
    await expect(canvas.getByRole('table', { name: 'Round by round' })).toBeTruthy();
  },
};

/** The viewer won. */
export const YouWon: Story = { args: { you: 'a' } };

/** Level on points. */
export const Tie: Story = { args: { b: { name: 'Blake', rounds: [300, 120, 250, 80, 300] } } };

/** After the first game: send the same game to a friend. */
export const Invite: Story = {
  render: () => (
    <div className="max-w-prose">
      <DuelInvite href="https://example.com/play?duel=eyJ2IjoxfQ" message="I scored 1,050. Can you beat it?" />
    </div>
  ),
};

/** What the friend sees when the link opens. */
export const Challenged: Story = {
  render: () => (
    <div className="max-w-prose">
      <DuelCard
        name="Avery"
        score={1050}
        description="Five rounds, about two minutes."
        onAccept={() => {}}
        locale="en-US"
      />
    </div>
  ),
};

function ByLinkDemo() {
  const challenge: DuelChallenge = { v: 1, game: 'sample', seed: '2026-11-24', from: AVERY };
  const href = duelHref('https://example.com/play', encodeDuel(challenge));
  const back = decodeDuel(new URL(href).searchParams.get('duel'));
  return (
    <div className="grid max-w-prose gap-4">
      <DuelInvite href={href} />
      <p className="text-muted-foreground text-sm break-all">{href}</p>
      {back ? (
        <DuelCard name={back.from.name} score={back.from.rounds.reduce((t, r) => t + r, 0)} locale="en-US" />
      ) : null}
    </div>
  );
}

/** The whole trip: a challenge into a link and back out of it. */
export const ByLink: Story = { render: () => <ByLinkDemo /> };

export const RightToLeft: Story = { decorators: [withRtl] };
