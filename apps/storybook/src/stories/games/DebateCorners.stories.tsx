import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DebateCorners } from '@interlace/ui/games/debate-corners';
import { withRtl } from '@/decorators';

// An invented statement and counts, so the demo makes no claim about anyone.
const CORNERS = [
  { id: 'a', label: 'Agree strongly' },
  { id: 'b', label: 'Agree a little' },
  { id: 'c', label: 'Disagree a little' },
  { id: 'd', label: 'Disagree strongly' },
];
const COUNTS = { a: 7, b: 12, c: 5, d: 2 };

const meta = {
  title: 'Games/DebateCorners',
  component: DebateCorners,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Pick a corner, then defend it. A statement with two to four positions, one in each corner of the room: each person picks where they stand, can move until the host locks the corners, and the host calls one corner at a time to defend its position. After picking, the spread shows, with yours marked.\n\n' +
          '**Not colour alone.** Every corner has a letter, a word and a count; the corner being defended carries the word `Defending`.\n\n' +
          '**On a room.** `useRoomCorners` gives these props from a live room (`games/use-workshop-activities`), and `cornersActivity` is the rule the host runs.\n\n' +
          '**Privacy.** `minResponses` keeps the spread hidden until enough have picked.',
      },
    },
  },
  args: {
    statement: 'Mornings are the best time to get work done.',
    corners: CORNERS,
    counts: COUNTS,
    onPick: fn(),
  },
  render: (args) => (
    <div className="max-w-prose">
      <DebateCorners {...args} />
    </div>
  ),
} satisfies Meta<typeof DebateCorners>;

export default meta;
type Story = StoryObj<typeof meta>;

/** After picking, with the host calling one corner to defend. */
export const Default: Story = {
  args: { defaultValue: 'b', speaking: 'c' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/You are in Agree a little\. 12 of 26 are there with you\./)).toBeTruthy();
    await expect(canvas.getByText('Defending')).toBeTruthy();
  },
};

/** Before picking: no spread, so nobody is nudged by the room. */
export const Choosing: Story = {};

/** Picking and moving by keyboard. */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole('radio')[0] as HTMLElement);
    await expect(args.onPick).toHaveBeenLastCalledWith('a');
    await userEvent.keyboard('{ArrowDown}');
    await expect(args.onPick).toHaveBeenLastCalledWith('b');
  },
};

/** The host locked the corners. */
export const Locked: Story = { args: { defaultValue: 'a', locked: true } };

/** Too few have picked yet. */
export const Private: Story = { args: { counts: { a: 1, b: 1 }, defaultValue: 'a', minResponses: 10 } };

/** Two corners. */
export const TwoCorners: Story = {
  args: { corners: CORNERS.slice(0, 2), counts: { a: 9, b: 8 }, defaultValue: 'a' },
};

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl], args: { defaultValue: 'b', speaking: 'a' } };
