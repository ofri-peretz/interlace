import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { AnswerPad } from '@interlace/ui/games/answer-pad';
import { withRtl } from '@/decorators';

// Invented sample content.
const CHOICES = [
  { id: 'lake', label: 'A lake' },
  { id: 'river', label: 'A river' },
  { id: 'sea', label: 'A sea' },
  { id: 'bay', label: 'A bay' },
];

function Playable(props: Partial<React.ComponentProps<typeof AnswerPad>>) {
  const [value, setValue] = React.useState<string | null>(null);
  return (
    <div className="max-w-prose">
      <AnswerPad
        prompt="Which of these is fed by a single spring?"
        choices={CHOICES}
        value={value}
        onPick={setValue}
        {...props}
      />
    </div>
  );
}

const meta = {
  title: 'Games/AnswerPad',
  component: AnswerPad,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The player’s side of a live round. The question is on the big screen; each phone shows lettered tiles. The first pick is final and goes to the host, the pad says the answer is in, and at the reveal it marks the right tile and says how the player did.\n\n' +
          '**No answer on the phone.** `correct` stays null until the host reveals the round, so a competitive room never sends it early.\n\n' +
          '**State from props.** `value`, `closed` and `correct` decide what shows, so a reload or a reconnect lands on the same screen.\n\n' +
          '**Letters tie the screens.** `choiceKey(i)` gives the big screen the same A, B, C; `display="keys"` shows only letters on phones.',
      },
    },
  },
  args: { choices: CHOICES, value: null },
  render: (args) => <Playable display={args.display} />,
} satisfies Meta<typeof AnswerPad>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open: pick a tile (or press A to D). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /A river/ }));
    await expect(canvas.getByText('Answer in. Watch the screen.')).toBeTruthy();
    await expect(canvas.getByRole('button', { name: /A river/ })).toHaveAttribute('aria-pressed', 'true');
  },
};

/** Letters only, the words on the big screen. */
export const Keys: Story = { args: { display: 'keys' } };

/** Revealed: a wrong pick, with the right tile marked. */
export const RevealedWrong: Story = {
  render: () => (
    <div className="max-w-prose">
      <AnswerPad choices={CHOICES} value="sea" correct="river" points={0} />
    </div>
  ),
};

/** Revealed: right, with points. */
export const RevealedRight: Story = {
  render: () => (
    <div className="max-w-prose">
      <AnswerPad choices={CHOICES} value="river" correct="river" points={850} locale="en-US" />
    </div>
  ),
};

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
