import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '@interlace/ui/button';
import { JoinCode } from '@interlace/ui/games/join-code';
import { Podium } from '@interlace/ui/games/podium';
import { RoomCountdown, RoomHostControls, RoomLobby, useRoom } from '@interlace/ui/games/live-room';
import {
  applyRoomEvent,
  createMemoryRoomHub,
  createRoom,
  roomStandings,
  type RoomState,
  type RoomTransport,
} from '@interlace/ui/games/room-model';
import { withRtl } from '@/decorators';

// Invented players and a neutral sample question.
const NAMES = ['Avery', 'Blake', 'Casey', 'Drew', 'Emery', 'Finley', 'Gray', 'Harper Montgomery-Wellington'];
const HREF = 'https://example.com/play?code=K7Q4MZ';

function lobby(count: number): RoomState {
  let room = createRoom({ code: 'K7Q4MZ', hostId: 'host', rounds: 3 });
  NAMES.slice(0, count).forEach((name, i) => {
    room = applyRoomEvent(room, { type: 'join', playerId: `p${i}`, name }, `p${i}`);
  });
  return applyRoomEvent(room, { type: 'leave', playerId: 'p3' }, 'p3');
}

const meta = {
  title: 'Games/LiveRoom',
  component: RoomLobby,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A game night on one big screen and everyone’s phones. `useRoom` keeps every client on the same room: the host applies events with the pure rules in `games/room-model` (no joining a locked room, one answer a round, only the host starts) and sends the state to all, with `seq` so an old message never wins.\n\n' +
          '**Any network.** A `RoomTransport` is two functions, `send` and `subscribe`. The kit ships an in-memory hub (tests, demos, this page) and a BroadcastChannel transport (tabs on one device); a WebSocket or hosted realtime service is a small adapter in the app. No vendor is built in.\n\n' +
          '**The pieces.** `RoomLobby` (players pop in and are announced; the host can remove one), `RoomHostControls` (start, reveal, next, podium, lock, end; moves on by itself when the countdown or the clock runs out, or everyone has answered), `RoomCountdown` (3, 2, 1, Go to a host timestamp), with `JoinCode` and `Podium`.\n\n' +
          '**Time.** Deadlines are host timestamps; pass `now` corrected for clock drift and every phone agrees to the second.',
      },
    },
  },
  args: { players: lobby(8).players, selfId: undefined },
} satisfies Meta<typeof RoomLobby>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The host's screen while people join. */
export const Default: Story = {
  render: (args) => {
    const room = lobby(8);
    return (
      <RoomLobby
        {...args}
        join={<JoinCode code={room.code} href={HREF} where="example.com/play" />}
        onRemove={() => {}}
        actions={<RoomHostControls room={room} send={() => {}} minPlayers={2} />}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: '7 players' })).toBeTruthy();
    await expect(canvas.getByRole('button', { name: 'Start' })).toBeTruthy();
  },
};

/** A player's phone in the lobby. */
export const PlayerLobby: Story = {
  args: { selfId: 'p1' },
  render: (args) => (
    <div className="max-w-prose">
      <RoomLobby {...args} />
    </div>
  ),
};

/** The countdown everyone sees, to a host timestamp. */
function CountdownDemo() {
  const [at, setAt] = React.useState<number | null>(null);
  return (
    <div className="flex flex-col items-center gap-6">
      <RoomCountdown startsAt={at} size="stage" />
      <Button type="button" variant="outline" onClick={() => setAt(Date.now() + 3000)}>
        Count down again
      </Button>
    </div>
  );
}

export const Countdown: Story = { render: () => <CountdownDemo /> };

// --- A whole game on one page: the host and two phones on an in-memory hub ---------

const OPTIONS = ['A', 'B', 'C', 'D'];
const RIGHT = 'C';

function Phone({ hub, id, name }: { hub: ReturnType<typeof createMemoryRoomHub>; id: string; name: string }) {
  const [transport] = React.useState<RoomTransport>(() => hub.connect());
  const { room, send } = useRoom({ transport, selfId: id, code: 'K7Q4MZ' });
  const joined = room?.players.some((p) => p.id === id);
  let body: React.ReactNode;
  if (!room) body = <p className="text-muted-foreground">Connecting…</p>;
  else if (!joined)
    body = (
      <Button type="button" onClick={() => send({ type: 'join', playerId: id, name })}>
        Join as {name}
      </Button>
    );
  else if (room.phase === 'lobby')
    body = <RoomLobby players={room.players} selfId={id} aria-label={`${name}'s lobby`} />;
  else if (room.phase === 'countdown') body = <RoomCountdown startsAt={room.startsAt} />;
  else if (room.phase === 'question')
    body =
      id in room.answers ? (
        <p>Answer in. Waiting for the others.</p>
      ) : (
        <div role="group" aria-label={`${name}: pick an answer`} className="grid grid-cols-2 gap-2">
          {OPTIONS.map((o) => (
            <Button
              key={o}
              type="button"
              variant="outline"
              size="lg"
              onClick={() => send({ type: 'answer', playerId: id, value: o, at: Date.now() })}
            >
              {o}
            </Button>
          ))}
        </div>
      );
  else if (room.phase === 'reveal') body = <p>+{room.lastPoints[id] ?? 0} points</p>;
  else body = <Podium entries={roomStandings(room)} currentId={id} showRest={false} />;
  return (
    <section aria-label={`${name}'s phone`} className="border-border flex flex-col gap-3 rounded-2xl border p-4">
      <p className="text-muted-foreground text-sm">{name}&rsquo;s phone</p>
      {body}
    </section>
  );
}

function Host({ hub }: { hub: ReturnType<typeof createMemoryRoomHub> }) {
  const [transport] = React.useState<RoomTransport>(() => hub.connect());
  const [initial] = React.useState(() => createRoom({ code: 'K7Q4MZ', hostId: 'host', rounds: 2 }));
  const { room, send } = useRoom({ transport, selfId: 'host', host: initial });
  if (!room) return null;
  const controls = (
    <RoomHostControls
      room={room}
      send={send}
      roundSeconds={15}
      score={(r) =>
        Object.fromEntries(Object.entries(r.answers).map(([pid, a]) => [pid, a.value === RIGHT ? 1000 : 0]))
      }
    />
  );
  return (
    <section aria-label="Host screen" className="border-border flex flex-col gap-4 rounded-2xl border p-5">
      {room.phase === 'lobby' ? (
        <RoomLobby
          players={room.players}
          aria-label="Host lobby"
          join={<JoinCode code={room.code} href={HREF} where="example.com/play" />}
          onRemove={(playerId) => send({ type: 'remove', playerId })}
          actions={controls}
        />
      ) : (
        <>
          {room.phase === 'countdown' ? <RoomCountdown startsAt={room.startsAt} size="stage" /> : null}
          {room.phase === 'question' ? (
            <p className="text-2xl font-semibold">Round {room.round}: which letter is third?</p>
          ) : null}
          {room.phase === 'reveal' ? <p className="text-2xl font-semibold">It was {RIGHT}.</p> : null}
          {room.phase === 'podium' ? <Podium entries={roomStandings(room)} /> : null}
          {controls}
        </>
      )}
    </section>
  );
}

/** Join both phones, start, answer, and watch every screen follow the host. */
function GameNightDemo() {
  const [hub] = React.useState(() => createMemoryRoomHub());
  return (
    <div className="@container grid gap-4">
      <Host hub={hub} />
      <div className="grid gap-4 @xl:grid-cols-2">
        <Phone hub={hub} id="p-avery" name="Avery" />
        <Phone hub={hub} id="p-blake" name="Blake" />
      </div>
    </div>
  );
}

export const GameNight: Story = {
  render: () => <GameNightDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Join as Avery' }));
    const host = within(await canvas.findByRole('region', { name: 'Host lobby' }));
    await expect(await host.findByRole('heading', { name: '1 player' }, { timeout: 2000 })).toBeTruthy();
  },
};

export const RightToLeft: Story = {
  decorators: [withRtl],
  render: Default.render,
};
