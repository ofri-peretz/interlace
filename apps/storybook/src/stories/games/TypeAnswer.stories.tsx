import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TypeAnswer } from '@interlace/ui/games/type-answer';
import { scoreTyped } from '@interlace/ui/games/typed-answer-model';
import { withRtl } from '@/decorators';

// A neutral placeholder question, so the demo makes no claim about anyone.
const ACCEPTED = ['Pacific', 'Pacific Ocean'];
const ROOM = [
  'Pacific',
  'pacific',
  'Atlantic',
  'Pacfic',
  'Pacific Ocean',
  'Indian',
  'atlantic',
  'Pacific',
  'Arctic',
  'Pacific',
  'Atlantic',
  'pacific ocean',
  'Southern',
  'Pacific',
];

const meta = {
  title: 'Games/TypeAnswer',
  component: TypeAnswer,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A quiz round where people type the answer. Case, accents, punctuation and a slip of a letter in a longer word are forgiven (and the right spelling is shown); a different number never is. The reveal shows what the room typed, folded together.\n\n' +
          '**The model.** `games/typed-answer-model` folds, matches and scores answers with the same clock rules as `QuizQuestion`, and groups the room’s answers.\n\n' +
          '**Motion.** The field lifts when right and shakes when wrong (250ms); the bars grow. Under reduced motion it is all in its end state.',
      },
    },
  },
  args: {
    question: 'Which is the largest ocean?',
    accepted: ACCEPTED,
    room: ROOM,
    roomIncludesAnswer: true,
    meta: 'Question 3 of 8',
    explanation: 'A placeholder explanation, with its source, goes here.',
    defaultResult: scoreTyped({ text: 'Pacfic' }, ACCEPTED),
    locale: 'en-US',
    onAnswer: fn(),
  },
  render: (args) => (
    <div className="max-w-128">
      <TypeAnswer {...args} />
    </div>
  ),
} satisfies Meta<typeof TypeAnswer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Revealed: close enough, with the spelling shown, and what the room typed. */
export const Default: Story = {};

/** Asking, with a clock. */
export const Asking: Story = { args: { defaultResult: null, timeLimit: 30 } };

/** Type and send with Enter. */
export const Typing: Story = {
  args: { defaultResult: null },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: 'Which is the largest ocean?' }), 'atlantic{Enter}');
    await expect(args.onAnswer).toHaveBeenCalledTimes(1);
    await expect(canvas.getByText('Not this time. The answer is Pacific.')).toBeTruthy();
  },
};

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
