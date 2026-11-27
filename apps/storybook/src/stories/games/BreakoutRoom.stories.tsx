import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { BreakoutCard, BreakoutHost } from '@interlace/ui/games/breakout-room';
import { useRoom } from '@interlace/ui/games/live-room';
import {
  applyRoomEvent,
  createMemoryRoomHub,
  createRoom,
  type RoomState,
  type RoomTransport,
} from '@interlace/ui/games/room-model';
import { seededRandom } from '@interlace/ui/games/group-model';
import { breakoutsEvent, broadcast, openBreakouts, recallBreakouts } from '@interlace/ui/games/breakout-model';
import { withRtl } from '@/decorators';

// Invented players. A fixed clock and a seeded split keep the picture the same every run.
const NAMES = ['Avery', 'Blake', 'Casey', 'Drew', 'Emery', 'Finley', 'Gray', 'Harper', 'Indigo', 'Jules', 'Kai', 'Lane'];
const HOST = 'host';
const NOW = 1_700_000_000_000;
const now = () => NOW + 150_000;

function playersRoom(count: number, from = 0): RoomState {
  let room = createRoom({ code: 'K7Q4MZ', hostId: HOST });
  NAMES.slice(from, from + count).forEach((name, i) => {
    room = applyRoomEvent(room, { type: 'join', playerId: `p${from + i}`, name }, `p${from + i}`);
  });
  return room;
}

function openRoom(message?: string): RoomState {
  const room = playersRoom(12);
  let state = openBreakouts(room.players, {
    groups: 3,
    seconds: 600,
    names: ['Lake', 'River', 'Harbour'],
    now: NOW,
    random: seededRandom(6),
  })!;
  if (message) state = broadcast(state, message, NOW + 60_000);
  return applyRoomEvent(room, breakoutsEvent(state), HOST);
}

const meta = {
  title: 'Games/BreakoutRoom',
  component: BreakoutHost,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Breakouts for a live room. The host splits the room into groups with a timer, sends one message to every group and calls everyone back; each phone shows its group, who is in it, the time left and the latest message. The state rides in the room (`RoomState.shared`), so a phone that joins late or reconnects shows its group at once.\n\n' +
          '**A message is spoken once.** Each message has a count; a phone shows (and so speaks) one only when it is newer than any it has seen, so the same state twice, or an old one arriving late, is silent.\n\n' +
          '**Recall.** Everyone sees "Back in the main room" at once; the groups stay for reading until the host sends them out again or closes them.\n\n' +
          '**Fair and late-proof.** Groups differ by at most one person; someone who joins after the split goes to the smallest group.',
      },
    },
  },
  args: { room: openRoom('Wrap up in two minutes and pick one thing to share.'), send: () => {}, now },
  render: (args) => (
    <div className="max-w-content">
      <BreakoutHost {...args} />
    </div>
  ),
} satisfies Meta<typeof BreakoutHost>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The host's screen, eight minutes ten seconds into three groups of four. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('timer', { name: 'Time left' }).textContent).toContain('7:30');
    await expect(canvas.getByRole('button', { name: 'Bring everyone back' })).toBeTruthy();
    await expect(canvas.getAllByRole('combobox')).toHaveLength(12);
  },
};

/** Before any groups: how many, how long, then open. */
export const Setup: Story = { args: { room: playersRoom(10) } };

/** Everyone called back. */
export const Recalled: Story = {
  args: {
    room: (() => {
      const room = openRoom();
      return applyRoomEvent(room, breakoutsEvent(recallBreakouts(openBreakouts(room.players, { groups: 3, now: NOW, random: seededRandom(6) })!, NOW + 1)), HOST);
    })(),
  },
};

/** A player's phone, with the host's message. */
export const Card: Story = {
  render: () => (
    <div className="max-w-96">
      <BreakoutCard room={openRoom('Wrap up in two minutes and pick one thing to share.')} selfId="p1" now={now} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Wrap up in two minutes and pick one thing to share.')).toBeTruthy();
  },
};

/** Time is up on a phone. */
export const CardTimeUp: Story = {
  render: () => (
    <div className="max-w-96">
      <BreakoutCard room={openRoom()} selfId="p1" now={() => NOW + 700_000} />
    </div>
  ),
};

/** The call back, on a phone. */
export const CardRecalled: Story = {
  render: () => {
    const room = openRoom();
    const state = recallBreakouts(openBreakouts(room.players, { groups: 3, now: NOW, random: seededRandom(6) })!, NOW + 1);
    return (
      <div className="max-w-96">
        <BreakoutCard room={applyRoomEvent(room, breakoutsEvent(state), HOST)} selfId="p1" />
      </div>
    );
  },
};

// --- A host and a phone on one hub ---------------------------------------------------------------

function Host({ transport }: { transport: RoomTransport }) {
  const [initial] = React.useState(() => playersRoom(3, 1));
  const { room, send, now: clock } = useRoom({ transport, selfId: HOST, host: initial });
  if (!room) return null;
  return (
    <section aria-label="Host screen">
      <BreakoutHost room={room} send={send} now={clock} random={seededRandom(2)} defaultGroups={2} />
    </section>
  );
}

function Phone({ transport }: { transport: RoomTransport }) {
  const { room, send, now: clock } = useRoom({ transport, selfId: 'p0', code: 'K7Q4MZ' });
  if (!room) return <p className="text-muted-foreground">Connecting…</p>;
  const joined = room.players.some((p) => p.id === 'p0');
  return (
    <section aria-label="Avery's phone">
      {joined ? (
        <BreakoutCard room={room} selfId="p0" now={clock} />
      ) : (
        <button type="button" className="bg-primary text-primary-foreground rounded-lg px-4 py-2" onClick={() => send({ type: 'join', playerId: 'p0', name: 'Avery' })}>
          Join as Avery
        </button>
      )}
    </section>
  );
}

function Demo() {
  const [hub] = React.useState(() => createMemoryRoomHub());
  const [host] = React.useState(() => hub.connect());
  const [phone] = React.useState(() => hub.connect());
  return (
    <div className="grid gap-6">
      <Host transport={host} />
      <Phone transport={phone} />
    </div>
  );
}

/** Open groups, send a message, and recall: the phone follows each step. */
export const Journey: Story = {
  render: () => <Demo />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const wait = { timeout: 4000 };
    const host = () => within(canvas.getByRole('region', { name: 'Host screen' }));
    const phone = () => within(canvas.getByRole('region', { name: "Avery's phone" }));
    await step('the phone joins', async () => {
      await userEvent.click(await canvas.findByRole('button', { name: 'Join as Avery' }, wait));
    });
    await step('the host opens groups', async () => {
      await userEvent.click(await host().findByRole('button', { name: 'Open breakouts' }, wait));
      await expect(await phone().findByRole('heading', { name: /^You are in Group \d$/ }, wait)).toBeTruthy();
    });
    await step('a message reaches the phone', async () => {
      await userEvent.type(host().getByLabelText('Message to every group'), 'Two minutes left');
      await userEvent.click(host().getByRole('button', { name: 'Send to all groups' }));
      await expect(await phone().findByText('Two minutes left', undefined, wait)).toBeTruthy();
    });
    await step('the host calls everyone back', async () => {
      await userEvent.click(host().getByRole('button', { name: 'Bring everyone back' }));
      await expect(await phone().findByText('Back in the main room', undefined, wait)).toBeTruthy();
    });
  },
};

export const RightToLeft: Story = { decorators: [withRtl] };
