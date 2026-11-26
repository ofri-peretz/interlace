import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { QuestionAsk, QuestionBoard, QuestionQueue } from '@interlace/ui/games/question-board';
import {
  applyBoardEvent,
  createBoard,
  rankQuestions,
  type BoardEvent,
  type BoardState,
} from '@interlace/ui/games/question-board-model';
import { withRtl } from '@/decorators';

// Invented questions about a neutral topic, so the demo makes no claim about anyone.
function seed(): BoardState {
  const events: BoardEvent[] = [
    { type: 'ask', id: 'q1', by: 'p1', at: 1, text: 'How long does it take to learn to bake bread at home?' },
    { type: 'ask', id: 'q2', by: 'p2', at: 2, text: 'Which flour works best for a first loaf?' },
    { type: 'ask', id: 'q3', by: 'me', at: 3, text: 'Can the dough rise overnight in the fridge?' },
    { type: 'ask', id: 'q4', by: 'p4', at: 4, text: 'What is the most common mistake beginners make?' },
    { type: 'ask', id: 'q5', by: 'p5', at: 5, text: 'Is a stand mixer worth it?' },
  ];
  let s = createBoard({ moderated: false });
  for (const e of events) {
    const r = applyBoardEvent(s, e);
    if (r.ok) s = r.state;
  }
  for (const [id, by] of [
    ['q4', 'p1'],
    ['q4', 'p2'],
    ['q4', 'p5'],
    ['q2', 'p1'],
    ['q2', 'p4'],
    ['q1', 'p2'],
    ['q4', 'me'],
  ] as const) {
    const r = applyBoardEvent(s, { type: 'vote', id, by });
    if (r.ok) s = r.state;
  }
  const pinned = applyBoardEvent(s, { type: 'pin', id: 'q2' });
  return pinned.ok ? pinned.state : s;
}

const meta = {
  title: 'Games/QuestionBoard',
  component: QuestionBoard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Questions from the room, ranked by the room. People ask with `QuestionAsk`, vote up with `QuestionBoard`, and a moderator approves, pins, answers or hides with `QuestionQueue` before anything typed reaches a shared screen.\n\n' +
          '**State.** `games/question-board-model` holds the board: `applyBoardEvent` moves a question through review, live, answered and dismissed, takes one vote per person (never on their own), and refuses unsafe text with `text-safety-model`. `rankQuestions` puts the pinned question first, then votes, then the oldest.\n\n' +
          '**Motion.** Questions glide to their new rank when votes change (FlipGroup); a new count rises into place. Under reduced motion they simply move.',
      },
    },
  },
  args: { questions: rankQuestions(seed(), { viewer: 'me' }), onVote: fn(), locale: 'en-US' },
  argTypes: {
    size: { control: 'inline-radio', options: ['default', 'stage'], table: { category: 'Look' } },
    locale: { control: 'text', table: { category: 'Content' } },
  },
  render: (args) => (
    <div className="max-w-prose">
      <QuestionBoard {...args} />
    </div>
  ),
} satisfies Meta<typeof QuestionBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What a phone sees: the pinned question first, the viewer's own marked, votes as toggles. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Answering now')).toBeTruthy();
    await expect(canvas.getByRole('button', { name: 'Remove your vote, 4 votes' })).toBeTruthy();
  },
};

/** Nobody has asked yet. */
export const Empty: Story = { args: { questions: [] } };

function RoomDemo() {
  const [board, setBoard] = React.useState<BoardState>(() => {
    const s = seed();
    const pinned = applyBoardEvent(s, { type: 'moderate', on: true });
    return pinned.ok ? pinned.state : s;
  });
  const [n, setN] = React.useState(0);
  const send = (e: BoardEvent) =>
    setBoard((s) => {
      const r = applyBoardEvent(s, e, { blocklist: ['badword'] });
      return r.ok ? r.state : s;
    });
  return (
    <div className="grid max-w-wide gap-10 @container">
      <div className="grid gap-10 @3xl:grid-cols-2">
        <div className="grid content-start gap-6">
          <QuestionAsk
            moderated={board.moderated}
            blocklist={['badword']}
            onAsk={(text) => {
              send({ type: 'ask', id: `new${n}`, by: 'me', at: 10 + n, text });
              setN((x) => x + 1);
            }}
          />
          <QuestionBoard
            questions={rankQuestions(board, { viewer: 'me' })}
            onVote={(id, on) => send({ type: on ? 'vote' : 'unvote', id, by: 'me' })}
            locale="en-US"
          />
        </div>
        <QuestionQueue
          review={rankQuestions(board, { status: 'review' })}
          live={rankQuestions(board)}
          done={[...rankQuestions(board, { status: 'answered' }), ...rankQuestions(board, { status: 'dismissed' })]}
          onEvent={send}
          locale="en-US"
        />
      </div>
    </div>
  );
}

/** A whole room on one page: ask on the left (it waits for review), moderate on the right, vote and watch it climb. */
export const Room: Story = {
  render: () => <RoomDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Your question'), 'Does the oven need a stone?');
    await userEvent.click(canvas.getByRole('button', { name: 'Ask' }));
    await expect(canvas.getByText('Sent. A moderator will check it before it shows.')).toBeTruthy();
    await userEvent.click(canvas.getByRole('button', { name: 'Approve' }));
    await expect(canvas.getAllByText('Does the oven need a stone?').length).toBeGreaterThan(1);
    // Let the new question finish arriving before the contrast check reads it.
    await Promise.all(canvasElement.getAnimations({ subtree: true }).map((a) => a.finished));
  },
};

/** On a shared screen: read-only, larger type. */
export const Stage: Story = { args: { size: 'stage', questions: rankQuestions(seed()), onVote: undefined } };

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
