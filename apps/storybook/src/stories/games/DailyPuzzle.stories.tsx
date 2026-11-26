import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { DailyPuzzle, DailyPuzzleCountdown } from '@interlace/ui/games/daily-puzzle';
import { CloserGame } from '@interlace/ui/games/closer-game';
import type { CloserResult } from '@interlace/ui/games/closer-model';
import { ShareCard } from '@interlace/ui/games/share-card';
import { Streak } from '@interlace/ui/games/streak';
import { Button } from '@interlace/ui/button';
import { withRtl } from '@/decorators';

// Three invented rounds: sample content only.
const ROUNDS = [
  { question: 'A sample jar holds marbles. How many?', answer: 640, range: { min: 0, max: 2000, step: 10 } },
  { question: 'A sample shelf holds books. How many?', answer: 87, range: { min: 0, max: 300 } },
  { question: 'In a sample survey, what share said yes?', answer: 0.62, range: { min: 0, max: 1, step: 0.01 }, format: { style: 'percent' } as const },
];
const PLAYED = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-22', '2026-11-23'];

function Game() {
  const [results, setResults] = React.useState<CloserResult[]>([]);
  const [round, setRound] = React.useState(0);
  const answered = results.length > round;
  const done = results.length === ROUNDS.length && round === ROUNDS.length - 1 && answered;
  const [finished, setFinished] = React.useState(false);
  const q = ROUNDS[round]!;
  return (
    <DailyPuzzle
      title="Sample game"
      number={42}
      day="2026-11-24"
      rounds={ROUNDS.length}
      round={round + 1}
      done={finished}
      locale="en-US"
      aside={<Streak variant="compact" played={finished ? [...PLAYED, '2026-11-24'] : PLAYED} today="2026-11-24" rest={{ weekdays: [6] }} />}
    >
      {finished ? (
        <div className="grid gap-4">
          <ShareCard
            title="Sample game"
            number={42}
            results={results.map((r) => r.band)}
            score={results.reduce((s, r) => s + r.points, 0)}
            maxScore={ROUNDS.length * 100}
            streak={6}
          />
          <DailyPuzzleCountdown timeZone="UTC" />
        </div>
      ) : (
        <div className="grid gap-4">
          <CloserGame
            key={round}
            {...q}
            locale="en-US"
            onGuess={(r) => setResults((rs) => [...rs, r])}
          />
          {answered ? (
            <div>
              <Button onClick={() => (done ? setFinished(true) : setRound((r) => r + 1))}>
                {done ? 'See your result' : 'Next round'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </DailyPuzzle>
  );
}

const meta = {
  title: 'Games/DailyPuzzle',
  component: DailyPuzzle,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The frame around a daily game: its name, today’s number and date, progress through the rounds, and once the player finishes, a countdown to the next puzzle. The game itself is the children, so any round fits.\n\n' +
          '**Progress in words.** "Round 2 of 3" is a polite live region, so moving on is announced; the marks beside it are decoration.\n\n' +
          '**Countdown.** `DailyPuzzleCountdown` says "Next puzzle at midnight" in the server HTML, then the time left in the player’s zone, and calls `onNextDay` when the day turns.\n\n' +
          '**Motion.** Each round’s body rises in once (150ms); nothing under reduced motion.',
      },
    },
  },
  args: { title: 'Sample game', number: 42, day: '2026-11-24', rounds: 3, round: 2, locale: 'en-US' },
  render: (args) => (
    <div className="max-w-prose">
      <DailyPuzzle {...args}>
        <p className="text-muted-foreground border-border rounded-lg border border-dashed p-6 text-sm">The round goes here.</p>
      </DailyPuzzle>
    </div>
  ),
} satisfies Meta<typeof DailyPuzzle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The shell alone, mid-puzzle. */
export const Default: Story = {};

/** Finished: every mark filled, and the countdown. */
export const Done: Story = {
  args: { done: true },
  render: (args) => (
    <div className="max-w-prose">
      <DailyPuzzle {...args}>
        <DailyPuzzleCountdown timeZone="UTC" />
      </DailyPuzzle>
    </div>
  ),
};

/** A whole game: three Closer rounds, a compact streak, then a share card and the countdown. */
export const WholeGame: Story = {
  render: () => (
    <div className="max-w-prose">
      <Game />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Round 1 of 3')).toBeTruthy();
    await userEvent.click(canvas.getByRole('button', { name: 'Lock in' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Next round' }));
    await expect(canvas.getByText('Round 2 of 3')).toBeTruthy();
  },
};

/** The puzzle as a whole page: `size="page"` titles it at the page-title step, as an h1. */
export const PageTitle: Story = {
  args: { size: 'page', headingLevel: 1 },
};

/** Right to left, with the date and number in the locale. */
export const RightToLeft: Story = {
  decorators: [withRtl],
  args: {
    title: 'لعبة تجريبية',
    locale: 'ar',
    labels: { number: (n: string) => `رقم ${n}`, progress: (r: number, of: number) => `الجولة ${r} من ${of}` },
  },
};

/** The 288px column a 320px phone leaves. */
export const Narrow: Story = {
  render: () => (
    <div className="w-72">
      <Game />
    </div>
  ),
};
