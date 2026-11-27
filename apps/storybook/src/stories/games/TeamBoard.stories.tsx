import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { TeamBadge, TeamBoard, TeamScoreboard } from '@interlace/ui/games/team-board';
import { useRoom } from '@interlace/ui/games/live-room';
import {
  applyRoomEvent,
  createMemoryRoomHub,
  createRoom,
  type RoomState,
  type RoomTransport,
} from '@interlace/ui/games/room-model';
import { seededRandom } from '@interlace/ui/games/group-model';
import { autoBalance, createTeams, teamsEvent } from '@interlace/ui/games/team-model';
import { withRtl } from '@/decorators';

// Invented players. Seeded, so the split is the same every run.
const NAMES = [
  'Avery', 'Blake', 'Casey', 'Drew', 'Emery', 'Finley', 'Gray', 'Harper', 'Indigo', 'Jules', 'Kai', 'Lane',
];
const HOST = 'host';

function playersRoom(count: number, from = 0): RoomState {
  let room = createRoom({ code: 'K7Q4MZ', hostId: HOST });
  NAMES.slice(from, from + count).forEach((name, i) => {
    room = applyRoomEvent(room, { type: 'join', playerId: `p${from + i}`, name }, `p${from + i}`);
  });
  return room;
}

function teamRoom(count = 12, teams = 3): RoomState {
  const room = playersRoom(count);
  const names = ['Owls', 'Foxes', 'Herons'];
  const split = autoBalance(createTeams(teams, names), room.players, { random: seededRandom(4) });
  const scores = Object.fromEntries(room.players.map((p, i) => [p.id, [900, 700, 1200, 300, 800, 500][i % 6]! + i * 10]));
  return {
    ...applyRoomEvent(room, teamsEvent(split), HOST),
    scores,
    lastPoints: Object.fromEntries(room.players.slice(0, 6).map((p, i) => [p.id, 100 + i * 20])),
  };
}

const meta = {
  title: 'Games/TeamBoard',
  component: TeamBoard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Team mode for a live room. The host makes teams, balances them (or moves one player by hand) and everyone sees whose team they are on and how the teams score. The teams ride in the room (`RoomState.shared`), so a phone that joins late or reconnects shows its team at once, and the newest `seq` wins whatever order messages arrive in.\n\n' +
          '**Fair split.** `autoBalance` keeps sizes within one, and with scores deals the strongest players across teams (1 2 3 3 2 1). Teams rank by average, so a team of one more has no edge.\n\n' +
          '**Colour is never alone.** Each team has a `--team-N` colour token and its own letter and name.\n\n' +
          '**No drag.** Moving a player is a native select on each row: a keyboard, a switch and a screen reader all work.',
      },
    },
  },
  args: { room: teamRoom(), send: () => {} },
  render: (args) => (
    <div className="max-w-content">
      <TeamBoard {...args} />
    </div>
  ),
} satisfies Meta<typeof TeamBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The host's board: twelve players on three teams. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Name for Owls')).toBeTruthy();
    await expect(canvas.getAllByRole('combobox')).toHaveLength(12);
  },
};

/** Before any teams: how many, then make them. */
export const Setup: Story = { args: { room: playersRoom(8) } };

/** The big screen: who leads, with a bar and a letter for each team. */
export const Scoreboard: Story = {
  render: () => (
    <div className="max-w-112">
      <TeamScoreboard room={teamRoom()} locale="en-US" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole('listitem');
    await expect(rows).toHaveLength(3);
  },
};

/** A player's phone. */
export const Badge: Story = {
  render: () => (
    <div className="max-w-96">
      <TeamBadge room={teamRoom()} selfId="p1" />
    </div>
  ),
};

/** A player who has no team yet. */
export const BadgeWaiting: Story = {
  render: () => (
    <div className="max-w-96">
      <TeamBadge room={playersRoom(4)} selfId="p1" />
    </div>
  ),
};

// --- A host and a phone on one hub ---------------------------------------------------------------

function Host({ transport }: { transport: RoomTransport }) {
  const [initial] = React.useState(() => playersRoom(5, 1));
  const { room, send } = useRoom({ transport, selfId: HOST, host: initial });
  if (!room) return null;
  return (
    <section aria-label="Host screen" className="grid gap-4">
      <TeamBoard room={room} send={send} random={seededRandom(2)} />
      <TeamScoreboard room={room} />
    </section>
  );
}

function Phone({ transport }: { transport: RoomTransport }) {
  const { room, send } = useRoom({ transport, selfId: 'p0', code: 'K7Q4MZ' });
  if (!room) return <p className="text-muted-foreground">Connecting…</p>;
  const joined = room.players.some((p) => p.id === 'p0');
  return (
    <section aria-label="Avery's phone" className="grid gap-3">
      {joined ? (
        <TeamBadge room={room} selfId="p0" />
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
    <div className="grid gap-6 @container">
      <Host transport={host} />
      <Phone transport={phone} />
    </div>
  );
}

/** Make the teams on the host and the phone shows its team; move the player and it follows. */
export const Journey: Story = {
  render: () => <Demo />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const wait = { timeout: 4000 };
    await step('the phone joins', async () => {
      await userEvent.click(await canvas.findByRole('button', { name: 'Join as Avery' }, wait));
    });
    await step('the host makes teams', async () => {
      const host = within(canvas.getByRole('region', { name: 'Host screen' }));
      await userEvent.selectOptions(host.getByLabelText('Number of teams'), '3');
      await userEvent.click(host.getByRole('button', { name: 'Make teams' }));
      const phone = within(canvas.getByRole('region', { name: "Avery's phone" }));
      await expect(await phone.findByText(/^You are on Team \d$/, undefined, wait)).toBeTruthy();
    });
    await step('moving the player moves the badge', async () => {
      const host = within(canvas.getByRole('region', { name: 'Host screen' }));
      const select = host.getByLabelText('Move Avery to') as HTMLSelectElement;
      const other = select.value === 't1' ? 't2' : 't1';
      await userEvent.selectOptions(select, other);
      const name = other === 't1' ? 'Team 1' : 'Team 2';
      const phone = within(canvas.getByRole('region', { name: "Avery's phone" }));
      await expect(await phone.findByText(`You are on ${name}`, undefined, wait)).toBeTruthy();
    });
  },
};

export const RightToLeft: Story = { decorators: [withRtl] };
