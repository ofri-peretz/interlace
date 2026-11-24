import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { CloserGame } from '@interlace/ui/games/closer-game';
import { withRtl } from '@/decorators';

// Invented numbers, so the demo makes no claim about the world.
const JAR = {
  question: 'A sample jar holds marbles. How many?',
  answer: 640,
  range: { min: 0, max: 2000, step: 10 },
  explanation: 'This is sample content: the jar was counted by hand at 640. A real game would cite where its number comes from here.',
};

const meta = {
  title: 'Games/CloserGame',
  component: CloserGame,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Guess a number by sliding to it. The player sets a value on the slider or types it, locks it in, and the answer slides out from their guess to where it really is, with the gap shaded and said in words.\n\n' +
          '**Scoring is pure.** `games/closer-model` exports `scoreGuess`: distance as a share of the range, a band (`exact`, `close`, `near`, `far`) and points. A server can score the same guess, and a share card can draw the band without the number.\n\n' +
          '**Log scales.** `range.scale = "log"` lays the slider out in orders of magnitude, for answers like populations.\n\n' +
          '**Restore.** `guess` / `defaultGuess` hold the locked-in value, so a page that stored today’s guess renders the revealed state on reload. `onGuess` fires once.\n\n' +
          '**Motion.** On the reveal the answer’s mark travels from the guess to the answer (400ms) and the gap fills behind it. Under reduced motion both are simply in place.',
      },
    },
  },
  args: { ...JAR, locale: 'en-US' },
  argTypes: {
    answer: { control: 'number', table: { category: 'Data' } },
    range: { control: 'object', description: '`{ min, max, step?, scale?: "linear" | "log" }`', table: { category: 'Data' } },
    guess: { control: 'number', description: 'Locked-in guess, controlled. `null` for none yet.', table: { category: 'State' } },
    defaultGuess: { control: 'number', table: { category: 'State' } },
    defaultValue: { control: 'number', description: 'Where the slider starts. Defaults to the middle.', table: { category: 'State' } },
    format: { control: 'object', description: '`Intl.NumberFormat` options for every number shown.', table: { category: 'Content' } },
    locale: { control: 'text', table: { category: 'Content' } },
  },
  render: (args) => (
    <div className="max-w-prose">
      <CloserGame {...args} />
    </div>
  ),
} satisfies Meta<typeof CloserGame>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Slide or type, then lock in. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('slider')).toBeTruthy();
    await userEvent.click(canvas.getByRole('button', { name: 'Lock in' }));
    await expect(canvas.getByText(/The answer is 640/)).toBeTruthy();
  },
};

/** After the reveal: the answer's mark, the shaded gap and the explanation. */
export const Revealed: Story = {
  args: { defaultGuess: 900 },
};

/** A guess within half a step. */
export const SpotOn: Story = {
  args: { defaultGuess: 640 },
};

/** Orders of magnitude on one slider, with compact numbers. */
export const LogScale: Story = {
  args: {
    question: 'A sample city has how many residents?',
    answer: 1_240_000,
    range: { min: 1000, max: 100_000_000, scale: 'log' },
    format: { notation: 'compact', maximumFractionDigits: 1 },
    explanation: 'Sample content. Each step along the track multiplies the number, so 10 thousand and 10 million are equally easy to reach.',
    defaultGuess: 300_000,
  },
};

/** A unit through Intl: the same game in percent. */
export const Percent: Story = {
  args: {
    question: 'In a sample survey, what share said yes?',
    answer: 0.62,
    range: { min: 0, max: 1, step: 0.01 },
    format: { style: 'percent' },
    explanation: undefined,
  },
};

/** Words from `labels`, numbers from `locale`, the track mirrored. */
export const RightToLeft: Story = {
  decorators: [withRtl],
  args: {
    locale: 'ar',
    question: 'كم عدد الكرات في هذا الوعاء التجريبي؟',
    explanation: 'محتوى تجريبي.',
    defaultGuess: 900,
    labels: {
      guess: 'تخمينك',
      submit: 'ثبّت',
      type: 'أو اكتبه',
      answer: 'الإجابة',
      band: { near: 'لست بعيدًا.' },
      result: ({ guess, answer, band, points }) => `قلت ${guess}. الإجابة ${answer}. ${band} ${points} نقطة.`,
    },
  },
};

/** The 288px column a 320px phone leaves. */
export const Narrow: Story = {
  render: (args) => (
    <div className="w-72">
      <CloserGame {...args} />
    </div>
  ),
};
