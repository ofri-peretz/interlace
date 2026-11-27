import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TextWall } from '@interlace/ui/games/text-wall';
import { QuestionAsk } from '@interlace/ui/games/question-board';
import { withRtl } from '@/decorators';

// Neutral posts, so the demo makes no claim about anyone.
const POSTS = [
  { id: 'p1', text: 'What do you eat for breakfast on a school day?', at: 1 },
  { id: 'p2', text: 'Which music is everyone listening to right now?', at: 2 },
  { id: 'p3', text: 'How do you get to school?', at: 3 },
  { id: 'p4', text: 'What do you do on the weekend with your friends?', at: 4 },
  { id: 'p5', text: 'Is there a game everyone plays at break time?', at: 5 },
  { id: 'p6', text: 'What is the first thing you would show a visitor?', at: 6 },
  { id: 'p7', text: 'Do you learn more than one language at school?', at: 7 },
];

const meta = {
  title: 'Games/TextWall',
  component: TextWall,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The room’s short answers on a shared screen. Newest first, row by row, in a grid that follows the wall’s own width; the presenter can lift one into the spotlight. The count is text, not a live region, so a screen reader user reads at their pace.\n\n' +
          '**Phones.** Send with `QuestionAsk`, relabelled. Posts go through the Q&A board’s checks and moderation queue (`question-board-model`, `QuestionQueue`), so nothing unreviewed reaches the screen.\n\n' +
          '**Motion.** Posts on the wall at load stay still; later ones rise in at the top (200ms) while the rest glide along, and the spotlight scales in (250ms). Under reduced motion they simply appear.',
      },
    },
  },
  args: { posts: POSTS, spotlight: 'p4', locale: 'en-US' },
} satisfies Meta<typeof TextWall>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A wall with one post in the spotlight. */
export const Default: Story = {};

/** A shared screen: add a post to watch it rise in, or spotlight the newest. */
export const Live: Story = {
  args: { size: 'stage', spotlight: null },
  render: function Render(args) {
    const [posts, setPosts] = React.useState(POSTS);
    const [spot, setSpot] = React.useState<string | null>(null);
    return (
      <div className="grid gap-4">
        <div className="flex gap-4 text-sm">
          <button
            type="button"
            className="underline"
            onClick={() =>
              setPosts((p) => [
                ...p,
                { id: `n${p.length}`, text: `A new answer, number ${p.length + 1}`, at: p.length + 1 },
              ])
            }
          >
            Someone posts
          </button>
          <button type="button" className="underline" onClick={() => setSpot(posts.at(-1)?.id ?? null)}>
            Spotlight the newest
          </button>
        </div>
        <TextWall {...args} posts={posts} spotlight={spot} />
      </div>
    );
  },
};

/** The phone: `QuestionAsk`, relabelled for an answer. */
export const Phone: Story = {
  args: { posts: [] },
  render: function Render() {
    const onAsk = React.useMemo(() => fn(), []);
    return (
      <div className="max-w-96">
        <QuestionAsk
          onAsk={onAsk}
          maxLength={120}
          labels={{ field: 'Your answer', send: 'Post', sentReview: 'Sent. It shows once a moderator checks it.' }}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your answer' }), 'What do you do after school?');
    await userEvent.click(canvas.getByRole('button', { name: 'Post' }));
    await expect(canvas.getByText('Sent. It shows once a moderator checks it.')).toBeTruthy();
  },
};

/** Nothing posted yet. */
export const Empty: Story = { args: { posts: [] } };

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
