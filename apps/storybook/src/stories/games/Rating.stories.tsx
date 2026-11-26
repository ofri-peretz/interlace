import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Annoyed, Frown, Laugh, Meh, Smile } from 'lucide-react';
import { Rating } from '@interlace/ui/games/rating';
import { withRtl } from '@/decorators';

// Invented answers to a neutral question, so the demo is about no one.
const ROOM = [1, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 2, 3, 4, 4, 5];
const BEFORE = [1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 1, 2, 3, 2];

const meta = {
  title: 'Games/Rating',
  component: Rating,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A scale question for a room: how familiar, how likely to recommend, how are you feeling. Each person picks one step and sends it, then sees the room on the same scale: their own step marked, the room’s average, and, when the question was asked before, where the room stood then.\n\n' +
          '**The model.** `games/rating-model` counts each step, the mean and median, and for a 0 to 10 scale the recommend score (`summarizeRatings`), and how far the mean moved between two rounds (`ratingShift`).\n\n' +
          '**Privacy.** `minResponses` keeps the room hidden until enough have answered.\n\n' +
          '**Motion.** On sending, the bars grow from the baseline (250ms). Under reduced motion the chart is simply there.',
      },
    },
  },
  args: {
    question: 'How familiar are you with this topic?',
    ends: ['Not at all', 'Very'],
    values: ROOM,
    onRate: fn(),
    locale: 'en-US',
  },
  render: (args) => (
    <div className="max-w-md">
      <Rating {...args} />
    </div>
  ),
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

/** After sending, compared with the same question asked at the start. */
export const Default: Story = {
  args: { defaultValue: 4, before: BEFORE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/20 people answered/)).toBeTruthy();
  },
};

/** Choosing: arrow keys move between steps. */
export const Choosing: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: '3' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    await expect(args.onRate).toHaveBeenCalledWith(3);
  },
};

/** A mood check with faces. */
export const Mood: Story = {
  args: {
    question: 'How are you feeling right now?',
    ends: undefined,
    faces: [
      { icon: <Frown />, name: 'Low' },
      { icon: <Annoyed />, name: 'Meh' },
      { icon: <Meh />, name: 'Okay' },
      { icon: <Smile />, name: 'Good' },
      { icon: <Laugh />, name: 'Great' },
    ],
    defaultValue: 4,
  },
};

/** Zero to ten, with the recommend score. */
export const Recommend: Story = {
  args: {
    question: 'How likely are you to recommend this session to a friend?',
    min: 0,
    max: 10,
    ends: ['Not likely', 'Very likely'],
    values: [10, 9, 9, 8, 8, 7, 10, 6, 9, 5, 10, 9],
    defaultValue: 9,
  },
};

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl], args: { defaultValue: 2, before: BEFORE } };
