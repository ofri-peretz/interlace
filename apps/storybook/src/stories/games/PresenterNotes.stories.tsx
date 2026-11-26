import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { PresenterNotes, useAgenda } from '@interlace/ui/games/presenter-notes';
import {
  applyAgendaEvent,
  createAgenda,
  type AgendaEvent,
  type AgendaMessage,
  type AgendaState,
} from '@interlace/ui/games/agenda-model';
import { createMemoryRoomHub, type RoomTransport } from '@interlace/ui/games/room-model';
import { withRtl } from '@/decorators';

// Invented session. A fixed clock keeps the picture the same every run.
const T0 = 1_700_000_000_000;
const MIN = 60_000;

const SECTIONS = [
  {
    id: 'welcome',
    title: 'Welcome',
    notes: 'Say hello and thank people for coming.\nName the goal of the hour: leave with one thing to try on Monday.',
    plannedSeconds: 300,
  },
  {
    id: 'demo',
    title: 'Live demo',
    notes:
      'Open the room and let people join.\nRun two rounds, then the team round.\nIf the network is slow, switch to the recorded run.\nAsk: what did you notice?',
    plannedSeconds: 600,
  },
  { id: 'pairs', title: 'Pair talk', notes: 'Show the card. Two minutes each way.', plannedSeconds: 420 },
  { id: 'qa', title: 'Questions', notes: '', plannedSeconds: 300 },
];

function at(events: [AgendaEvent, number][]): AgendaState {
  return events.reduce((s, [e, ms]) => applyAgendaEvent(s, e, T0 + ms), createAgenda(SECTIONS));
}

const running = at([[{ type: 'start' }, 0], [{ type: 'next' }, 5 * MIN]]);

const meta = {
  title: 'Games/PresenterNotes',
  component: PresenterNotes,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The presenter’s own view of a session, for a second screen or the same one: the notes for the section being presented, an agenda with the time planned and used for each section, a clock, and a gentle signal when a section runs over.\n\n' +
          '**Over time, gently.** Under 80% of the plan, near it, then over: said in words ("1:05 over") and a calm border, spoken once on each crossing. No flashing, no sound.\n\n' +
          '**Two screens.** `useAgenda` keeps one window in control and any number showing the same agenda over a `RoomTransport` (a `BroadcastChannel` for two windows on one device). A tap on the second screen is applied once even if the network repeats it, and dropped if it was made against an older screen. A reload is restored with `createAgendaStore`, and the section goes on counting through it.\n\n' +
          '**Keys.** Space starts, pauses and resumes; the arrow keys or N and P move between sections; + adds a minute. They ignore typing, and can be switched off in the panel. Every action is also a button.\n\n' +
          'The notes are plain text and never reach the audience: they travel only between the presenter’s windows.',
      },
    },
  },
  args: { agenda: running, send: () => {}, now: () => T0 + 8 * MIN },
} satisfies Meta<typeof PresenterNotes>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three minutes into the demo, on time. */
export const Default: Story = {
  render: (args) => (
    <div className="max-w-content">
      <PresenterNotes {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Live demo' })).toBeTruthy();
    await expect(canvas.getByText('On time')).toBeTruthy();
    await expect(canvas.getByRole('button', { name: 'Pause' })).toBeTruthy();
  },
};

/** Before the start: the first section's notes, ready. */
export const Idle: Story = { args: { agenda: createAgenda(SECTIONS), now: () => T0 } };

/** The last fifth of the time. */
export const NearlyOut: Story = {
  args: { agenda: running, now: () => T0 + 5 * MIN + 8.5 * MIN },
};

/** Past the plan: how far over, in words, and the same calm. */
export const OverTime: Story = {
  args: { agenda: running, now: () => T0 + 5 * MIN + 11 * MIN + 5000 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('1:05 over')).toBeTruthy();
  },
};

/** Paused: the clock stands still. */
export const Paused: Story = {
  args: { agenda: at([[{ type: 'start' }, 0], [{ type: 'pause' }, 2 * MIN]]), now: () => T0 + 9 * MIN },
};

/** At the end: the session against its plan. */
export const Done: Story = {
  args: {
    agenda: at([
      [{ type: 'start' }, 0],
      [{ type: 'next' }, 6 * MIN],
      [{ type: 'next' }, 18 * MIN],
      [{ type: 'next' }, 24 * MIN],
      [{ type: 'next' }, 29 * MIN],
    ]),
    now: () => T0 + 30 * MIN,
  },
};

/** Set large for a second screen read at a distance. */
export const Stage: Story = { args: { size: 'stage' } };

function Playable() {
  const [agenda, setAgenda] = React.useState(() => createAgenda(SECTIONS));
  return (
    <div className="max-w-content">
      <PresenterNotes agenda={agenda} send={(e) => setAgenda((a) => applyAgendaEvent(a, e, Date.now()))} />
    </div>
  );
}

/** Press Space, then N: the keys do what the buttons do. */
export const Keyboard: Story = {
  render: () => <Playable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.keyboard(' ');
    await expect(await canvas.findByRole('button', { name: 'Pause' })).toBeTruthy();
    await userEvent.keyboard('n');
    await expect(await canvas.findByRole('heading', { name: 'Live demo' })).toBeTruthy();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(await canvas.findByRole('heading', { name: 'Welcome' })).toBeTruthy();
  },
};

function Controller({ transport }: { transport: RoomTransport<AgendaMessage> }) {
  const { agenda, send, now } = useAgenda({ transport, initial: createAgenda(SECTIONS) });
  return agenda ? (
    <section aria-label="Presenter screen">
      <PresenterNotes aria-label="Presenter notes: main screen" agenda={agenda} send={send} now={now} shortcuts={false} />
    </section>
  ) : null;
}

function SecondScreen({ transport }: { transport: RoomTransport<AgendaMessage> }) {
  const { agenda, send, now } = useAgenda({ transport });
  return agenda ? (
    <section aria-label="Second screen">
      <PresenterNotes aria-label="Presenter notes: second screen" agenda={agenda} send={send} now={now} shortcuts={false} size="stage" />
    </section>
  ) : (
    <p className="text-muted-foreground">Connecting the second screen…</p>
  );
}

function TwoScreens() {
  const [hub] = React.useState(() => createMemoryRoomHub<AgendaMessage>());
  const [main] = React.useState(() => hub.connect());
  const [second] = React.useState(() => hub.connect());
  return (
    <div className="grid gap-6">
      <Controller transport={main} />
      <SecondScreen transport={second} />
    </div>
  );
}

/** Start on the second screen and the main one follows, and the other way round. */
export const SecondScreen_: Story = {
  name: 'Second screen',
  render: () => <TwoScreens />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const wait = { timeout: 4000 };
    const second = () => within(canvas.getByRole('region', { name: 'Presenter notes: second screen' }));
    const main = () => within(canvas.getByRole('region', { name: 'Presenter notes: main screen' }));
    await step('the second screen shows the same agenda', async () => {
      await waitFor(() => expect(canvas.getByRole('region', { name: 'Presenter notes: second screen' })).toBeTruthy(), wait);
      await expect(second().getByRole('heading', { name: 'Welcome' })).toBeTruthy();
    });
    await step('a tap on the second screen moves the main one', async () => {
      await userEvent.click(second().getByRole('button', { name: 'Start' }));
      await waitFor(() => expect(main().getByRole('button', { name: 'Pause' })).toBeTruthy(), wait);
      await userEvent.click(second().getByRole('button', { name: 'Next' }));
      await waitFor(() => expect(main().getByRole('heading', { name: 'Live demo' })).toBeTruthy(), wait);
    });
    await step('and the other way', async () => {
      await userEvent.click(main().getByRole('button', { name: 'Previous' }));
      await waitFor(() => expect(second().getByRole('heading', { name: 'Welcome' })).toBeTruthy(), wait);
    });
  },
};

export const RightToLeft: Story = { decorators: [withRtl], render: Default.render };
