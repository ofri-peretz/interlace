import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { RecallCard } from '@interlace/ui/games/recall-card';
import { withRtl } from '@/decorators';

// Neutral sample content: a question with an answer longer than a word.
const ANSWER = (
  <div className="grid gap-2 text-sm leading-relaxed">
    <p>
      It sounds the fog signal at a fixed interval, so ships can tell this light from the next one along the coast
      by its rhythm.
    </p>
    <a href="#source" className="text-primary underline underline-offset-4">
      Coastal signals handbook, chapter 3
    </a>
  </div>
);

const meta = {
  title: 'Games/RecallCard',
  component: RecallCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A prompt the player answers in their head, then checks: think, reveal the real answer, and say honestly how it went. ' +
          'No typing and no multiple choice, so it fits answers longer than a word. For two to four choices, use `GuessReveal`.\n\n' +
          '**Flow.** Reveal opens the answer (a 250ms row grow, instant under reduced motion) and moves focus to it; the ratings appear only then. ' +
          '`onReveal` fires once, `onRate` on every change. Both steps are controlled or uncontrolled.\n\n' +
          '**Without JavaScript** a details element holds the answer.',
      },
    },
  },
  args: { prompt: 'What does a lighthouse keeper do when fog rolls in?', answer: ANSWER },
  argTypes: {
    revealed: { control: 'boolean', table: { category: 'State' } },
    rating: { control: 'text', table: { category: 'State' } },
  },
  render: (args) => (
    <div className="max-w-prose">
      <RecallCard {...args} />
    </div>
  ),
} satisfies Meta<typeof RecallCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Think of an answer, then reveal it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Show the answer' })).toBeTruthy();
  },
};

/** Revealed: the answer and the honest choice. */
export const Revealed: Story = {
  args: { defaultRevealed: true },
};

/** Rated: the pick is pressed and said in words. */
export const Rated: Story = {
  args: { defaultRevealed: true, defaultRating: 'not-yet' },
};

/** Reveal, then rate, with the keyboard path a player takes. */
export const Interaction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show the answer' }));
    await expect(canvas.getByRole('region', { name: 'The answer' })).toHaveFocus();
    await userEvent.click(canvas.getByRole('button', { name: /I had it/ }));
    await expect(canvas.getByRole('button', { name: /I had it/ })).toHaveAttribute('aria-pressed', 'true');
  },
};

/** Three ratings, the way a spaced-repetition deck asks. */
export const ThreeRatings: Story = {
  args: {
    defaultRevealed: true,
    ratings: [
      { id: 'easy', label: 'Easy' },
      { id: 'hard', label: 'Hard' },
      { id: 'again', label: 'Again' },
    ],
    labels: { rate: 'How was that one?' },
  },
};

/** Right to left. */
export const RightToLeft: Story = {
  decorators: [withRtl],
  args: { defaultRevealed: true },
};
