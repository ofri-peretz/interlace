import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { QuizQuestion } from '@interlace/ui/games/quiz-question';
import { withRtl } from '@/decorators';

// Sample content with a checkable answer, so the demo makes no claim about the world.
const Q = {
  question: 'How many sides does a hexagon have?',
  choices: [
    { id: 'a', label: 'Five' },
    { id: 'b', label: 'Six' },
    { id: 'c', label: 'Seven' },
    { id: 'd', label: 'Eight' },
  ],
  correct: 'b',
  meta: 'Question 2 of 5',
  explanation: 'A hexagon has six sides and six corners. This is sample content; a real game would say where its answer comes from here.',
  distribution: { a: 31, b: 204, c: 12, d: 9 },
};

const meta = {
  title: 'Games/QuizQuestion',
  component: QuizQuestion,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A multiple-choice question with the pace of a live quiz: big tiles to tap, keys 1 to 9 to pick, an optional clock that rewards speed, and a reveal that marks the right answer, says how you did, and shows how everyone else answered.\n\n' +
          '**Scoring is pure.** `games/quiz-model` exports `scoreAnswer`: a right answer is worth `maxPoints`, and on a running clock part of it (`speedShare`) depends on speed. A server can score the same answer.\n\n' +
          '**The clock can always be stopped.** `timeLimit` starts a TimerRing; a visible “Stop the clock” turns it off (WCAG 2.2.1), and the answer then scores without the speed share, so stopping never pays more than racing.\n\n' +
          '**Restore.** `result` / `defaultResult` render the revealed state for a stored answer. `onAnswer` fires once.\n\n' +
          '**Motion.** Tiles press in; on the reveal the right tile lifts and a wrong pick shakes (250ms each), and the spread’s bars grow. Under reduced motion all of it is in its end state.',
      },
    },
  },
  args: { ...Q, locale: 'en-US' },
  argTypes: {
    correct: { control: 'text', table: { category: 'Data' } },
    timeLimit: { control: 'number', description: 'Seconds. Leave out for no clock.', table: { category: 'Clock' } },
    distribution: { control: 'object', table: { category: 'Data' } },
    distributionIncludesAnswer: { control: 'boolean', table: { category: 'Data' } },
    score: { control: 'object', description: '`{ maxPoints?, speedShare? }`', table: { category: 'Scoring' } },
  },
  render: (args) => (
    <div className="max-w-2xl">
      <QuizQuestion {...args} />
    </div>
  ),
} satisfies Meta<typeof QuizQuestion>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tap a tile, or press 1 to 4. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Six' }).getAttribute('aria-keyshortcuts')).toBe('2');
  },
};

/** A wrong pick: the right tile marked, the pick shaken, the spread shown. */
export const Wrong: Story = {
  args: { defaultResult: { choice: 'a', correct: 'b', outcome: 'wrong', points: 0, timed: false } },
};

/** A right answer against the clock. */
export const Right: Story = {
  args: { defaultResult: { choice: 'b', correct: 'b', outcome: 'correct', points: 840, timed: true, elapsedMs: 3200 } },
};

/** With a 20-second clock and its stop button. */
export const Timed: Story = {
  args: { timeLimit: 20 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('timer')).toBeTruthy();
    await userEvent.click(canvas.getByRole('button', { name: 'Stop the clock' }));
    await expect(canvas.getByText('Clock stopped')).toBeTruthy();
  },
};

/** Pick with the keyboard. */
export const KeyboardPick: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button', { name: 'Five' }).focus();
    await userEvent.keyboard('2');
    await expect(canvas.getByText(/Right\./)).toBeTruthy();
  },
};

export const RightToLeft: Story = {
  args: { defaultResult: { choice: 'c', correct: 'b', outcome: 'wrong', points: 0, timed: false } },
  decorators: [withRtl],
};
