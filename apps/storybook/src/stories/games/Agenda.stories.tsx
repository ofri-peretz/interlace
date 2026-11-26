import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Agenda, AgendaNow } from '@interlace/ui/games/agenda';
import { applyAgendaEvent, createAgenda, type AgendaItem, type AgendaState } from '@interlace/ui/games/agenda-model';
import { withRtl } from '@/decorators';

// A neutral running order, so the demo makes no claim about any session.
const ITEMS: AgendaItem[] = [
  { id: 'welcome', title: 'Welcome and join code', minutes: 5, notes: 'Show the join code.\nWait for most phones.' },
  { id: 'warm-up', title: 'Warm up: one word', minutes: 8, notes: 'Open the word cloud. Read three words aloud.' },
  { id: 'quiz', title: 'Quiz round', minutes: 15 },
  { id: 'questions', title: 'Questions from the room', minutes: 12 },
  { id: 'close', title: 'One thing to take away', minutes: 5 },
];

const MIN = 60_000;
// A fixed moment, so the clock and the end time read the same in every screenshot.
const T0 = Date.UTC(2026, 0, 15, 14, 0);

function at(events: Parameters<typeof applyAgendaEvent>[2][]): AgendaState {
  return events.reduce((s, e) => applyAgendaEvent(ITEMS, s, e), createAgenda());
}

/** Ten minutes in: the welcome ran a minute over, the warm up is on. */
const MID = at([
  { type: 'start', at: T0 },
  { type: 'next', from: 0, at: T0 + 6 * MIN },
]);
const NOW = T0 + 10 * MIN + 40_000;

const meta = {
  title: 'Games/Agenda',
  component: Agenda,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The running order of a session. `Agenda` is the presenter’s console: what is on, a clock that counts down and then counts over, the presenter’s notes, how far the session has drifted from the plan and when it will end at this pace. `AgendaNow` is the room’s view of the same state.\n\n' +
          '**The model.** `games/agenda-model` keeps the state as timestamps (`applyAgendaEvent`, `agendaStatus`), so a refreshed tab or a late screen reads the right clock at once. `next` and `back` name the item they move from, so an event delivered twice moves once.\n\n' +
          '**Keyboard.** Every control is a button. `shortcuts` adds a presentation remote: Page Down or Right moves on, Page Up or Left goes back, `p` pauses.\n\n' +
          '**Motion.** The bar empties in one linear animation to the item’s end; a new item’s title rises in. Under reduced motion nothing moves.',
      },
    },
  },
  args: { items: ITEMS, state: MID, frozenAt: NOW, onEvent: fn(), locale: 'en-US' },
  render: (args) => (
    <div className="max-w-144">
      <Agenda {...args} />
    </div>
  ),
} satisfies Meta<typeof Agenda>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mid-session: notes, drift, the end time and the running order. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('timer').textContent).toContain('3:20');
    await expect(canvas.getByText(/1 min behind plan/)).toBeTruthy();
  },
};

/** Next names the item it moves from, so a doubled event moves once. */
export const Controls: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Next/ }));
    await expect(args.onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'next', from: 1 }));
  },
};

/** Live: a working console with its own state and a running clock. */
export const Live: Story = {
  args: { frozenAt: undefined, shortcuts: true },
  render: function Render(args) {
    const [state, setState] = React.useState(createAgenda());
    return (
      <div className="grid max-w-144 gap-10">
        <Agenda {...args} state={state} onEvent={(e) => setState((s) => applyAgendaEvent(ITEMS, s, e))} />
        <div className="rounded-lg border p-6">
          <AgendaNow items={ITEMS} state={state} />
        </div>
      </div>
    );
  },
};

/** Running over: the clock counts up in the warning tone, and says so. */
export const Over: Story = {
  args: { state: at([{ type: 'start', at: T0 }]), frozenAt: T0 + 6 * MIN + 30_000 },
};

/** Before the start. */
export const Before: Story = { args: { state: createAgenda() } };

/** The room’s screen for the same moment. */
export const RoomScreen: Story = {
  render: (args) => <AgendaNow items={args.items} state={args.state} frozenAt={args.frozenAt} size="stage" />,
};

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
