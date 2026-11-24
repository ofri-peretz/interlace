import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Poll } from '@interlace/ui/games/poll';
import { withRtl } from '@/decorators';

// Invented counts, so the demo makes no claim about anyone.
const OPTIONS = [
  { id: 'morning', label: 'In the morning' },
  { id: 'lunch', label: 'Over lunch' },
  { id: 'evening', label: 'In the evening' },
  { id: 'weekend', label: 'Only at the weekend' },
];
const COUNTS = { morning: 412, lunch: 133, evening: 571, weekend: 88 };

const meta = {
  title: 'Games/Poll',
  component: Poll,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One question, one tap. Tapping an option casts the vote, and the options turn into the results in place: bars grow to everyone’s shares, the viewer’s choice is named, and one sentence says it all for a screen reader.\n\n' +
          '**Shares that add up.** `games/tally-model` rounds with the largest remainder, so the percents always sum to 100, and adds the viewer’s vote once (`countsIncludeVote` when the server already counted it).\n\n' +
          '**Small polls stay private.** `minVotes` holds the shares back until enough people have voted.\n\n' +
          '**Restore.** `vote` / `defaultVote` open on the results for someone who already voted. `onVote` fires once.\n\n' +
          '**Motion.** The bars grow from zero on the vote (400ms) and are simply there under reduced motion or on a restored vote.',
      },
    },
  },
  args: { question: 'When do you usually read the news?', options: OPTIONS, counts: COUNTS, locale: 'en-US' },
  argTypes: {
    counts: { control: 'object', table: { category: 'Data' } },
    countsIncludeVote: { control: 'boolean', table: { category: 'Data' } },
    vote: { control: 'text', table: { category: 'State' } },
    defaultVote: { control: 'text', table: { category: 'State' } },
    minVotes: { control: 'number', table: { category: 'Privacy' } },
    locale: { control: 'text', table: { category: 'Content' } },
  },
  render: (args) => (
    <div className="max-w-md">
      <Poll {...args} />
    </div>
  ),
} satisfies Meta<typeof Poll>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tap an option to vote. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: /read the news/ })).toBeTruthy();
  },
};

/** After a vote: the bars, the viewer's choice in words, the total. */
export const Voted: Story = {
  args: { defaultVote: 'evening', footer: 'Sample poll. Closes Friday.' },
};

/** Vote, and the results replace the options. */
export const CastAVote: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Over lunch' }));
    await expect(canvas.getByText(/You chose Over lunch/)).toBeTruthy();
  },
};

/** Too few votes to show without giving voters away. */
export const HeldBack: Story = {
  args: { counts: { morning: 1 }, defaultVote: 'morning', minVotes: 10 },
};

export const RightToLeft: Story = {
  args: { defaultVote: 'morning' },
  decorators: [withRtl],
};
