import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '@interlace/ui/button';
import { AnswerPad } from '@interlace/ui/games/answer-pad';
import { JoinCode } from '@interlace/ui/games/join-code';
import { Podium } from '@interlace/ui/games/podium';
import { LiveRoom, useRoom } from '@interlace/ui/games/live-room';
import {
  applyRoomEvent,
  createMemoryRoomHub,
  createRoom,
  roomStandings,
  type RoomHostEvent,
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
  component: LiveRoom.Lobby,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A game night on one big screen and everyone’s phones. `useRoom` keeps every client on the same room: the host applies events with the pure rules in `games/room-model` (no joining a locked room, one answer a round, only the host starts) and sends the state to all, with `seq` so an old message never wins.\n\n' +
          '**Any network.** A `RoomTransport` is two functions, `send` and `subscribe`. The kit ships an in-memory hub (tests, demos, this page) and a BroadcastChannel transport (tabs on one device); a WebSocket or hosted realtime service is a small adapter in the app. No vendor is built in.\n\n' +
          '**The pieces.** `LiveRoom.Lobby` (players pop in and are announced; the host can remove one), `LiveRoom.HostControls` (start, reveal, next, podium, lock, end; moves on by itself when the countdown or the clock runs out, or everyone has answered), `LiveRoom.Countdown` (3, 2, 1, Go to a host timestamp), with `JoinCode` and `Podium`.\n\n' +
          '**Time.** Deadlines are host timestamps; pass `now` corrected for clock drift and every phone agrees to the second.',
      },
    },
  },
  args: { players: lobby(8).players, selfId: undefined },
} satisfies Meta<typeof LiveRoom.Lobby>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The host's screen while people join. */
export const Default: Story = {
  render: (args) => {
    const room = lobby(8);
    return (
      <LiveRoom.Lobby
        {...args}
        join={<JoinCode code={room.code} href={HREF} where="example.com/play" />}
        onRemove={() => {}}
        actions={<LiveRoom.HostControls room={room} send={() => {}} minPlayers={2} />}
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
      <LiveRoom.Lobby {...args} />
    </div>
  ),
};

/** The countdown everyone sees, to a host timestamp. */
function CountdownDemo() {
  const [at, setAt] = React.useState<number | null>(null);
  return (
    <div className="flex flex-col items-center gap-6">
      <LiveRoom.Countdown startsAt={at} size="stage" />
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
    body = <LiveRoom.Lobby players={room.players} selfId={id} aria-label={`${name}'s lobby`} />;
  else if (room.phase === 'countdown') body = <LiveRoom.Countdown startsAt={room.startsAt} />;
  else if (room.phase === 'question' || room.phase === 'reveal') {
    // The round reaches the phone in room.prompt; its answer only in room.solution, at the reveal.
    const options = Array.isArray(room.prompt) ? (room.prompt as string[]) : OPTIONS;
    const mine = room.answers[id]?.value;
    body = (
      <AnswerPad
        choices={options.map((o) => ({ id: o, label: o }))}
        value={typeof mine === 'string' ? mine : null}
        correct={room.phase === 'reveal' && typeof room.solution === 'string' ? room.solution : null}
        points={room.phase === 'reveal' ? (room.lastPoints[id] ?? 0) : null}
        display="keys"
        labels={{ group: `${name}: pick an answer` }}
        onPick={(o) => send({ type: 'answer', playerId: id, value: o, at: Date.now() })}
      />
    );
  } else body = <Podium entries={roomStandings(room)} currentId={id} showRest={false} />;
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
  // The host's round travels with its events: the options with `question`, the answer with `reveal`.
  const sendRound = React.useCallback(
    (event: RoomHostEvent) =>
      send(
        event.type === 'question'
          ? { ...event, prompt: OPTIONS }
          : event.type === 'reveal'
            ? { ...event, solution: RIGHT }
            : event,
      ),
    [send],
  );
  if (!room) return null;
  const controls = (
    <LiveRoom.HostControls
      room={room}
      send={sendRound}
      roundSeconds={15}
      countdownSeconds={1}
      score={(r) =>
        Object.fromEntries(Object.entries(r.answers).map(([pid, a]) => [pid, a.value === RIGHT ? 1000 : 0]))
      }
    />
  );
  return (
    <section aria-label="Host screen" className="border-border flex flex-col gap-4 rounded-2xl border p-5">
      {room.phase === 'lobby' ? (
        <LiveRoom.Lobby
          players={room.players}
          aria-label="Host lobby"
          join={<JoinCode code={room.code} href={HREF} where="example.com/play" />}
          onRemove={(playerId) => send({ type: 'remove', playerId })}
          actions={controls}
        />
      ) : (
        <>
          {room.phase === 'countdown' ? <LiveRoom.Countdown startsAt={room.startsAt} size="stage" /> : null}
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

/**
 * The journey: every phase of the flow, in order, on the host and both phones.
 * Lobby, countdown, two rounds of question and reveal, the podium, then the end.
 */
export const Journey: Story = {
  render: () => <GameNightDemo />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const wait = { timeout: 4000 };
    const answer = async (name: string) => {
      const pick = within(await canvas.findByRole('group', { name: `${name}: pick an answer` }, wait));
      await userEvent.click(pick.getByRole('button', { name: `${RIGHT}: ${RIGHT}` }));
    };
    await step('lobby: both phones join', async () => {
      await userEvent.click(await canvas.findByRole('button', { name: 'Join as Avery' }));
      await userEvent.click(await canvas.findByRole('button', { name: 'Join as Blake' }));
      const host = within(await canvas.findByRole('region', { name: 'Host lobby' }));
      await expect(await host.findByRole('heading', { name: '2 players' }, wait)).toBeTruthy();
    });
    await step('countdown, then round 1', async () => {
      await userEvent.click(await canvas.findByRole('button', { name: 'Start' }));
      await expect(await canvas.findAllByRole('timer')).not.toHaveLength(0);
      await answer('Avery');
      await answer('Blake');
    });
    await step('reveal, then round 2', async () => {
      await userEvent.click(await canvas.findByRole('button', { name: 'Next round' }, wait));
      await answer('Avery');
      await answer('Blake');
    });
    await step('podium', async () => {
      await userEvent.click(await canvas.findByRole('button', { name: 'Show the podium' }, wait));
      await expect(await canvas.findByRole('button', { name: 'Play again' }, wait)).toBeTruthy();
    });
    await step('closed', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'End the game' }));
      await expect(await canvas.findByText('The game has ended.')).toBeTruthy();
    });
  },
};

export const RightToLeft: Story = {
  decorators: [withRtl],
  render: Default.render,
};
