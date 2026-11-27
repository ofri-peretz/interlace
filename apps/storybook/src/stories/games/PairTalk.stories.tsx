import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { PairCard, PairHost } from '@interlace/ui/games/pair-talk';
import { useRoom } from '@interlace/ui/games/live-room';
import {
  applyRoomEvent,
  createMemoryRoomHub,
  createRoom,
  type RoomState,
  type RoomTransport,
} from '@interlace/ui/games/room-model';
import { seededRandom } from '@interlace/ui/games/group-model';
import { pairsEvent, startPairs } from '@interlace/ui/games/pair-model';
import { withRtl } from '@/decorators';

// Invented players and cards. A fixed clock and a seeded pairing keep the picture the same every run.
const NAMES = ['Avery', 'Blake', 'Casey', 'Drew', 'Emery', 'Finley', 'Gray', 'Harper', 'Indigo', 'Jules', 'Kai'];
const CARDS = [
  'What is the best thing you learned this month?',
  'Describe a tool you would miss if it were gone.',
  'What is a small habit that made your work easier?',
  'Tell your partner about a meeting that went well, and why.',
];
const HOST = 'host';
const NOW = 1_700_000_000_000;
const now = () => NOW + 45_000;

function playersRoom(count: number, from = 0): RoomState {
  let room = createRoom({ code: 'K7Q4MZ', hostId: HOST });
  NAMES.slice(from, from + count).forEach((name, i) => {
    room = applyRoomEvent(room, { type: 'join', playerId: `p${from + i}`, name }, `p${from + i}`);
  });
  return room;
}

function pairedRoom(count = 11): RoomState {
  const room = playersRoom(count);
  const state = startPairs(room.players, CARDS, { now: NOW, seconds: 180, random: seededRandom(2) })!;
  return applyRoomEvent(room, pairsEvent(state), HOST);
}

const meta = {
  title: 'Games/PairTalk',
  component: PairHost,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Pair talk for a live room. The host pairs everyone (one group of three when the room is odd), each pair gets a card and a timer, and "swap partners" pairs everyone again with someone new. Each phone shows its partner, the card and the time left. The state rides in the room (`RoomState.shared`), so a phone that joins late or reconnects is told who its partner is at once.\n\n' +
          '**New people each time.** A swap keeps the fewest repeat pairings it can: with enough players nobody meets the same person twice.\n\n' +
          '**Read once.** The phone’s round, partner and card sit in one status region, so a swap is read once and the clock stays quiet.',
      },
    },
  },
  args: { room: pairedRoom(), send: () => {}, prompts: CARDS, now },
  render: (args) => (
    <div className="max-w-content">
      <PairHost {...args} />
    </div>
  ),
} satisfies Meta<typeof PairHost>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The host's screen: eleven players, so five pairs and one group of three. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Round 1')).toBeTruthy();
    await expect(canvas.getByRole('button', { name: 'Swap partners' })).toBeTruthy();
    await expect(canvas.getByRole('timer', { name: 'Time left' }).textContent).toContain('2:15');
  },
};

/** Before any pairs. */
export const Setup: Story = { args: { room: playersRoom(8) } };

/** A player's phone. */
export const Card: Story = {
  render: () => (
    <div className="max-w-96">
      <PairCard room={pairedRoom()} selfId="p2" now={now} />
    </div>
  ),
};

/** A group of three. */
export const CardGroupOfThree: Story = {
  render: () => {
    const room = pairedRoom();
    const trio = JSON.parse(JSON.stringify(room.shared!.pairs)).pairs.find((p: { members: string[] }) => p.members.length === 3).members[0];
    return (
      <div className="max-w-96">
        <PairCard room={room} selfId={trio} now={now} />
      </div>
    );
  },
};

/** Time is up on a phone. */
export const CardTimeUp: Story = {
  render: () => (
    <div className="max-w-96">
      <PairCard room={pairedRoom()} selfId="p2" now={() => NOW + 200_000} />
    </div>
  ),
};

// --- A host and a phone on one hub ---------------------------------------------------------------

function Host({ transport }: { transport: RoomTransport }) {
  const [initial] = React.useState(() => playersRoom(2, 1));
  const { room, send, now: clock } = useRoom({ transport, selfId: HOST, host: initial });
  if (!room) return null;
  return (
    <section aria-label="Host screen">
      <PairHost room={room} send={send} prompts={CARDS} now={clock} random={seededRandom(2)} />
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
        <PairCard room={room} selfId="p0" now={clock} />
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

/** Start pairing and the phone shows its partner; swap and it shows the next round. */
export const Journey: Story = {
  render: () => <Demo />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const wait = { timeout: 4000 };
    const host = () => within(canvas.getByRole('region', { name: 'Host screen' }));
    const phone = () => within(canvas.getByRole('region', { name: "Avery's phone" }));
    await step('the phone joins, and two more players', async () => {
      await userEvent.click(await canvas.findByRole('button', { name: 'Join as Avery' }, wait));
    });
    await step('the host starts pairing', async () => {
      await userEvent.click(await host().findByRole('button', { name: 'Start pairing' }, wait));
      await expect(await phone().findByText('Round 1', undefined, wait)).toBeTruthy();
    });
    await step('swapping starts round 2', async () => {
      await userEvent.click(host().getByRole('button', { name: 'Swap partners' }));
      await expect(await phone().findByText('Round 2', undefined, wait)).toBeTruthy();
    });
  },
};

export const RightToLeft: Story = { decorators: [withRtl] };
