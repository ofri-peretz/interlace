import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { RoomClock } from '@interlace/ui/games/room-clock';
import { withRtl } from '@/decorators';

// A fixed clock keeps the picture the same every run.
const NOW = 1_700_000_000_000;
const now = () => NOW;

const meta = {
  title: 'Games/RoomClock',
  component: RoomClock,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A countdown to a host timestamp, in minutes and seconds, for timers that run for minutes (a breakout, a round of pair talk). Pass `useRoom`’s `now` and a phone with the wrong clock agrees with every other screen.\n\n' +
          '**Quiet for screen readers.** The number is not read each second. The clock speaks a minute left, ten seconds left and time up, and only when it sees the crossing: a clock that opens already past a mark says nothing.\n\n' +
          '**Never colour alone.** At zero the number is replaced by the words "Time’s up".',
      },
    },
  },
  args: { endsAt: NOW + (7 * 60 + 42) * 1000, now },
} satisfies Meta<typeof RoomClock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Seven minutes forty-two seconds left. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const clock = within(canvasElement).getByRole('timer', { name: 'Time left' });
    await expect(clock.textContent).toContain('7:42');
  },
};

/** Under ten seconds the clock turns to the warning tone. */
export const Low: Story = { args: { endsAt: NOW + 8_000 } };

/** Time is up, in words. */
export const Done: Story = {
  args: { endsAt: NOW - 1_000 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('timer').textContent).toContain('Time’s up'.replace('’', "'"));
  },
};

/** No timer was set. */
export const Idle: Story = { args: { endsAt: null } };

/** Large, for a big screen. */
export const Stage: Story = { args: { size: 'stage' } };

export const RightToLeft: Story = { decorators: [withRtl] };
