import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Prediction } from '@interlace/ui/games/prediction';
import { withRtl } from '@/decorators';

// A neutral question about the game itself, so the demo makes no claim about anyone.
const OPTIONS = [
  { id: 'red', label: 'Red team' },
  { id: 'blue', label: 'Blue team' },
  { id: 'tie', label: 'A tie' },
];

const meta = {
  title: 'Games/Prediction',
  component: Prediction,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Call it before it happens. Each person locks in one outcome; the room’s calls stay hidden until the host settles it, then the viewer hears whether they called it and sees how the room called it, outcome marked.\n\n' +
          '**The model.** `games/prediction-model` settles calls keyed by person, so duplicates and late messages change nothing (`settlePredictions`), and `predictionPoints` can pay a rare right call up to twice as much (`reward: "bold"`).',
      },
    },
  },
  args: {
    question: 'Who wins the next round?',
    options: OPTIONS,
    locale: 'en-US',
  },
  render: (args) => (
    <div className="max-w-112">
      <Prediction {...args} />
    </div>
  ),
} satisfies Meta<typeof Prediction>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Settled: the viewer made a call only a few made, and it paid more. */
export const Default: Story = {
  args: { value: 'tie', outcome: 'tie', counts: { red: 14, blue: 11, tie: 4 }, countsIncludeOwn: true, reward: 'bold' },
};

/** The whole round: choose, lock in, then the host settles it. */
export const Live: Story = {
  render: function Render(args) {
    const [outcome, setOutcome] = React.useState<string | null>(null);
    return (
      <div className="grid max-w-112 gap-4">
        <Prediction {...args} counts={{ red: 9, blue: 12, tie: 3 }} outcome={outcome} />
        <div className="flex flex-wrap gap-3 text-sm">
          {OPTIONS.map((o) => (
            <button key={o.id} type="button" className="underline" onClick={() => setOutcome(o.id)}>
              Host settles: {o.label}
            </button>
          ))}
          <button type="button" className="underline" onClick={() => setOutcome(null)}>
            Reset
          </button>
        </div>
      </div>
    );
  },
};

/** Choosing, before anything is locked in. */
export const Choosing: Story = {};

/** Locked in, waiting for the result. */
export const Locked: Story = { args: { defaultValue: 'blue' } };

/** A wrong call. */
export const Missed: Story = {
  args: { value: 'red', outcome: 'blue', counts: { red: 14, blue: 11, tie: 4 }, countsIncludeOwn: true },
};

/** Calls closed before this viewer made one. */
export const Closed: Story = { args: { closed: true } };

export const RightToLeft: Story = {
  decorators: [withRtl],
  args: { value: 'blue', outcome: 'blue', counts: { red: 5, blue: 8, tie: 2 }, countsIncludeOwn: true },
};
