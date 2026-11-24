import type { Meta, StoryObj } from '@storybook/react-vite';
import { TallyBars } from '@interlace/ui/games/tally-bars';
import { tally } from '@interlace/ui/games/tally-model';

const LABELS = { a: 'Five', b: 'Six', c: 'Seven', d: 'Eight' };
const ROWS = tally(['a', 'b', 'c', 'd'], { a: 31, b: 204, c: 12, d: 9 }, { vote: 'a' }).rows;

const meta = {
  title: 'Games/TallyBars',
  component: TallyBars,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'How everyone answered: one bar per option with its whole percent, the viewer’s option named in words, and, for a quiz, the right option marked. Poll and QuizQuestion use it; feed it rows from `tally()` in `games/tally-model`, whose percents always sum to 100.\n\n' +
          '**Motion.** The fills grow together on mount (400ms); `animate={false}` or reduced motion draws them in place.',
      },
    },
  },
  args: { rows: ROWS, optionLabels: LABELS, locale: 'en-US' },
  render: (args) => (
    <div className="max-w-prose">
      <TallyBars {...args} />
    </div>
  ),
} satisfies Meta<typeof TallyBars>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A poll's results, the viewer's choice named. */
export const Default: Story = { args: { animate: false } };

/** A quiz's spread: the right answer marked, the viewer's wrong pick named. */
export const QuizSpread: Story = {
  args: { marks: { b: 'correct', a: 'wrong' } },
};
