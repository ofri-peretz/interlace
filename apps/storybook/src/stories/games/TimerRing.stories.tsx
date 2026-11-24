import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimerRing } from '@interlace/ui/games/timer-ring';
import { Button } from '@interlace/ui/button';

const meta = {
  title: 'Games/TimerRing',
  component: TimerRing,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A countdown as a ring that empties, with whole seconds in the middle. It counts to a `deadline` timestamp, so a reload or a room of players all see the same clock.\n\n' +
          '**Quiet for screen readers.** `role="timer"`, announced at 10 and 5 seconds left and when time is up, not every second.\n\n' +
          '**Motion.** One smooth linear sweep to the deadline; under reduced motion it steps once a second. The last `lowAt` seconds switch to the destructive tone, and the number says the same thing.',
      },
    },
  },
  args: { seconds: 20, deadline: null },
} satisfies Meta<typeof TimerRing>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Idle: a full ring before the round starts. */
export const Default: Story = {};

/** Sizes. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-4">
      <TimerRing {...args} size="sm" />
      <TimerRing {...args} />
      <TimerRing {...args} size="lg" />
    </div>
  ),
};

function Running({ seconds }: { seconds: number }) {
  const [deadline, setDeadline] = React.useState<number | null>(null);
  return (
    <div className="flex items-center gap-4">
      <TimerRing seconds={seconds} deadline={deadline} onExpire={() => undefined} />
      <Button onClick={() => setDeadline(Date.now() + seconds * 1000)}>Start</Button>
      <Button variant="outline" onClick={() => setDeadline(null)}>
        Reset
      </Button>
    </div>
  );
}

/** Start it and watch the last five seconds turn. */
export const Countdown: Story = {
  render: () => <Running seconds={12} />,
};
