import type { Meta, StoryObj } from '@storybook/react-vite';
import { Annoyed, Frown, Laugh, Meh, Smile } from 'lucide-react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CheckIn } from '@interlace/ui/games/check-in';
import { DEFAULT_MOODS } from '@interlace/ui/games/check-in-model';
import { withRtl } from '@/decorators';

// Invented picks, so the demo makes no claim about anyone.
const FACES = { great: <Laugh />, good: <Smile />, okay: <Meh />, low: <Annoyed />, rough: <Frown /> };
const picks = (spec: Record<string, number>) =>
  Object.fromEntries(Object.entries(spec).flatMap(([mood, n]) => Array.from({ length: n }, (_, i) => [`${mood}-${i}`, mood])));
const NOW = picks({ great: 4, good: 9, okay: 6, low: 2, rough: 1 });
const EARLIER = picks({ great: 1, good: 5, okay: 7, low: 6, rough: 3 });

const meta = {
  title: 'Games/CheckIn',
  component: CheckIn,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'How are you arriving? One tap on the face that fits, in the lobby while the room fills or at the start of a session. The room’s mood shows as a spread, with the most common one named, and, when the same question was asked earlier, how it moved. People can change their pick until the host closes it.\n\n' +
          '**Every face has a word.** The icons are yours (`faces`); the word is always there, so nothing depends on seeing a drawing.\n\n' +
          '**On a room.** `useRoomCheckIn` and `checkInActivity` run it in the lobby or any phase; `ask` starts a second round that keeps the first, so the shift can be shown.',
      },
    },
  },
  args: {
    prompt: 'How are you arriving today?',
    moods: DEFAULT_MOODS,
    picks: NOW,
    faces: FACES,
    onPick: fn(),
  },
  render: (args) => (
    <div className="max-w-prose">
      <CheckIn {...args} />
    </div>
  ),
} satisfies Meta<typeof CheckIn>;

export default meta;
type Story = StoryObj<typeof meta>;

/** After picking, with the round asked earlier for the shift. */
export const Default: Story = {
  args: { defaultValue: 'good', before: EARLIER },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Most chose Good\. You chose Good\./)).toBeTruthy();
  },
};

/** Before picking. */
export const Choosing: Story = {};

/** Picked and changed by keyboard. */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'Okay' }));
    await expect(args.onPick).toHaveBeenLastCalledWith('okay');
    await userEvent.keyboard('{ArrowDown}');
    await expect(args.onPick).toHaveBeenLastCalledWith('low');
  },
};

/** Too few have checked in yet. */
export const Private: Story = { args: { picks: { a: 'good' }, defaultValue: 'good', minResponses: 10 } };

/** The host closed it. */
export const Closed: Story = { args: { defaultValue: 'okay', closed: true } };

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl], args: { defaultValue: 'great', before: EARLIER } };
