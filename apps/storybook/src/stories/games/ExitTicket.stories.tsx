import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ExitTicket } from '@interlace/ui/games/exit-ticket';
import { summarizeTicket, type TicketQuestion } from '@interlace/ui/games/exit-ticket-model';
import { withRtl } from '@/decorators';

// Invented questions and answers, so the demo makes no claim about anyone.
const QUESTIONS: TicketQuestion[] = [
  { id: 'recommend', kind: 'nps', prompt: 'How likely are you to recommend this session to a friend?' },
  { id: 'clear', kind: 'scale', prompt: 'How clear was it?', min: 1, max: 5 },
  {
    id: 'next',
    kind: 'choice',
    prompt: 'What should we do more of?',
    options: [
      { id: 'talk', label: 'Time to talk in pairs' },
      { id: 'quiz', label: 'Quizzes' },
      { id: 'stories', label: 'Stories' },
    ],
  },
];
const ROOM = [
  { recommend: 10, clear: 5, next: 'talk' },
  { recommend: 9, clear: 4, next: 'quiz' },
  { recommend: 9, clear: 5, next: 'talk' },
  { recommend: 8, clear: 4, next: 'stories' },
  { recommend: 7, clear: 3, next: 'talk' },
  { recommend: 6, clear: 4, next: 'quiz' },
  { recommend: 4, clear: 2 },
  { recommend: 10, clear: 5, next: 'talk' },
];

const meta = {
  title: 'Games/ExitTicket',
  component: ExitTicket,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Three quick questions as people leave: how likely to recommend (0 to 10, grouped into promoters, passives and detractors, with the score), a rating on a short scale, and a choice. One button sends them; they can be changed until the host closes it. After sending, the room’s numbers are plain sentences, never who said what, and only once enough people have sent theirs.\n\n' +
          '**The model.** `games/exit-ticket-model` has `npsBand`, `summarizeNps`, `summarizeTicket` and the room rule `exitTicketActivity`; `useRoomExitTicket` wires it to a live room.',
      },
    },
  },
  args: { questions: QUESTIONS, onSend: fn(), summary: summarizeTicket(QUESTIONS, ROOM), count: ROOM.length },
  render: (args) => (
    <div className="max-w-prose">
      <ExitTicket {...args} />
    </div>
  ),
} satisfies Meta<typeof ExitTicket>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Answering: three questions and one button. */
export const Default: Story = {};

/** After sending, the room's numbers. */
export const Sent: Story = {
  args: { defaultValue: { recommend: 9, clear: 4, next: 'talk' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Score 25: 4 promoters, 2 passives, 2 detractors\./)).toBeTruthy();
  },
};

/** Answered with the keyboard and one button. */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('radiogroup', { name: QUESTIONS[1]!.prompt });
    await userEvent.click(within(group).getByRole('radio', { name: '4' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    await expect(args.onSend).toHaveBeenCalledWith({ clear: 4 });
  },
};

/** Too few have sent yet. */
export const Private: Story = { args: { defaultValue: { recommend: 9 }, minResponses: 20 } };

/** The host closed it. */
export const Closed: Story = { args: { defaultValue: { recommend: 9 }, closed: true } };

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl], args: { defaultValue: { recommend: 7, clear: 3 } } };
