/**
 * #243's Q&A board, reactions, raised hands and spectrum, on a live room: a phone and a host with the
 * hooks that wire them (`useRoomBoard`, `useRoomReactions`, `useRoomHand`, `useRoomSpectrum`). By
 * keyboard alone, said to a screen reader once, quiet under reduced motion, and right through a
 * lost, repeated or late message.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({ useReducedMotion: () => reduced.value }));

const { QuestionAsk, QuestionBoard, QuestionQueue } = await import('../src/games/question-board.js');
const { HandQueue, RaiseHand, ReactionBar, ReactionStream } = await import('../src/games/reactions.js');
const { Spectrum } = await import('../src/games/spectrum.js');
const { useRoom } = await import('../src/games/live-room.js');
const { useRoomBoard, useRoomHand, useRoomReactions, useRoomSpectrum } = await import('../src/games/use-live-activities.js');
const {
  BOARD_KEY,
  HANDS_KEY,
  REACTIONS_KEY,
  SPECTRUM_KEY,
  boardActivity,
  handsActivity,
  reactionsActivity,
  spectrumActivity,
} = await import('../src/games/live-activities-model.js');
const { createMemoryRoomHub, createRoom, restoreRoom, serializeRoom } = await import('../src/games/room-model.js');
const { flakyReceiver, lossySender } = await import('./flaky-transport.js');
import type { RoomMessage, RoomState, RoomTransport } from '../src/games/room-model.js';

afterEach(() => {
  cleanup();
  reduced.value = false;
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

const HOST = 'host';
const CODE = 'K7Q4MZ';
const KINDS = ['love', 'agree', 'funny', 'new', 'confused'];
const settings = {
  activities: {
    [BOARD_KEY]: boardActivity(),
    [REACTIONS_KEY]: reactionsActivity({ kinds: KINDS }),
    [HANDS_KEY]: handsActivity,
    [SPECTRUM_KEY]: spectrumActivity(),
  },
};

type Api = ReturnType<typeof useRoom>;

/** A phone: every activity a player sees, wired to the room. */
function Phone({ transport, id, onApi }: { transport: RoomTransport; id: string; onApi?: (a: Api) => void }) {
  const clock = React.useRef(1_000_000);
  const api = useRoom({ transport, selfId: id, code: CODE, settings, now: () => (clock.current += 1500) });
  onApi?.(api);
  const board = useRoomBoard(api, id);
  const reactions = useRoomReactions(api, id);
  const hand = useRoomHand(api, id);
  const spectrum = useRoomSpectrum(api, id);
  return (
    <main aria-label={`phone ${id}`}>
      <ReactionBar onReact={reactions.onReact} />
      <ReactionStream reactions={reactions.reactions} />
      <RaiseHand raised={hand.raised} place={hand.place} speaking={hand.speaking} onChange={hand.onChange} />
      <QuestionAsk moderated={board.board?.moderated ?? true} onAsk={board.onAsk} />
      <QuestionBoard questions={board.live} onVote={board.onVote} />
      <Spectrum
        statement="Meetings should be shorter"
        poles={['Disagree', 'Agree']}
        values={spectrum.values}
        valuesIncludeOwn
        value={spectrum.value}
        onPlace={spectrum.onPlace}
      />
    </main>
  );
}

/** The host's console: it opens each activity, moderates and calls on people. */
function Host({ transport, state, onApi }: { transport: RoomTransport; state?: RoomState; onApi?: (a: Api) => void }) {
  const clock = React.useRef(1_000_000);
  const api = useRoom({ transport, selfId: HOST, host: state ?? createRoom({ code: CODE, hostId: HOST }), settings, now: () => (clock.current += 1500) });
  onApi?.(api);
  const board = useRoomBoard(api, HOST);
  const hand = useRoomHand(api, HOST);
  return (
    <section aria-label="host">
      <QuestionQueue review={board.review} live={board.live} done={board.done} onEvent={board.onEvent} />
      <HandQueue hands={hand.hands?.hands ?? []} speaking={hand.hands?.speaking} onCall={hand.onCall} onLower={hand.onLower} onDone={hand.onDone} />
    </section>
  );
}

const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => {});
};

async function start(options: { flaky?: boolean; lossy?: boolean } = {}) {
  const hub = createMemoryRoomHub<RoomMessage>();
  const flaky = options.flaky ? flakyReceiver(hub.connect()) : null;
  const lossy = options.lossy ? lossySender(hub.connect()) : null;
  const apis: Record<string, Api> = {};
  const view = render(
    <>
      <Host transport={hub.connect()} onApi={(a) => (apis.host = a)} />
      <Phone transport={flaky?.transport ?? lossy?.transport ?? hub.connect()} id="ann" onApi={(a) => (apis.ann = a)} />
      <Phone transport={hub.connect()} id="bo" onApi={(a) => (apis.bo = a)} />
    </>,
  );
  await flush();
  for (const id of ['ann', 'bo']) await act(async () => apis[id]!.send({ type: 'join', playerId: id, name: id === 'ann' ? 'Ann' : 'Bo' }));
  await flush();
  const { submitEvent } = await import('../src/games/live-activities-model.js');
  const begin = (key: string, action: unknown) => act(async () => apis.host!.send(submitEvent(key, HOST, `begin-${key}`, action)));
  return { hub, flaky, lossy, apis, view, begin, phone: (id: string) => within(screen.getByRole('main', { name: `phone ${id}` })), host: within(screen.getByRole('region', { name: 'host' })) };
}

describe('the Q&A board on a room', () => {
  it('is asked, approved and voted on by keyboard alone, and said once', async () => {
    const user = userEvent.setup();
    const t = await start();
    await t.begin(BOARD_KEY, { type: 'begin', moderated: true });
    const ann = t.phone('ann');
    await user.type(ann.getByRole('textbox'), 'Why is the sky blue?');
    await user.tab(); // the keyboard goes on to Ask, as a person's does
    await user.keyboard('{Enter}');
    await flush();
    expect(ann.getByText('Sent. A moderator will check it before it shows.')).toBeTruthy();
    expect(t.phone('bo').queryByText('Why is the sky blue?')).toBeNull(); // not before the host approves it
    await user.click(t.host.getByRole('button', { name: /approve/i }));
    await flush();
    const bo = t.phone('bo');
    expect(bo.getByText('Why is the sky blue?')).toBeTruthy();
    const vote = bo.getByRole('button', { name: /vote|0/i });
    vote.focus();
    await user.keyboard(' ');
    await flush();
    expect(t.phone('bo').getByRole('button', { name: /1/ }).getAttribute('aria-pressed')).toBe('true');
    await user.keyboard('{Enter}'); // pressing again takes the vote back
    await flush();
    expect(t.phone('bo').getByRole('button', { name: /0|vote/i }).getAttribute('aria-pressed')).toBe('false');
  });

  it('shows one question, once, when the first send is lost and the phone sends it again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const t = await start({ lossy: true });
    await t.begin(BOARD_KEY, { type: 'begin', moderated: false });
    t.lossy!.drop(1);
    await user.type(t.phone('ann').getByRole('textbox'), 'Lost on the way?');
    await user.tab();
    await user.keyboard('{Enter}');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(t.phone('bo').queryByText('Lost on the way?')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    await flush();
    expect(t.phone('bo').getAllByText('Lost on the way?')).toHaveLength(1);
    expect(t.phone('ann').getAllByText('Lost on the way?')).toHaveLength(1);
  });

  it('puts a refreshed host back where it was', async () => {
    const user = userEvent.setup();
    const t = await start();
    await t.begin(BOARD_KEY, { type: 'begin', moderated: false });
    await user.type(t.phone('ann').getByRole('textbox'), 'Still here?');
    await user.tab();
    await user.keyboard('{Enter}');
    await flush();
    const saved = restoreRoom(serializeRoom(t.apis.host!.room!), { hostId: HOST })!;
    expect(saved).not.toBeNull();
    t.view.unmount();
    // The host's page is reloaded with what it saved: the board is there before anyone has joined again.
    const hub = createMemoryRoomHub<RoomMessage>();
    const apis: Record<string, Api> = {};
    render(
      <>
        <Host transport={hub.connect()} state={saved} onApi={(a) => (apis.host = a)} />
        <Phone transport={hub.connect()} id="bo" onApi={(a) => (apis.bo = a)} />
      </>,
    );
    await flush();
    expect(within(screen.getByRole('region', { name: 'host' })).getAllByText('Still here?').length).toBeGreaterThan(0);
    await act(async () => apis.bo!.send({ type: 'join', playerId: 'bo', name: 'Bo' }));
    await flush();
    expect(within(screen.getByRole('main', { name: 'phone bo' })).getAllByText('Still here?')).toHaveLength(1);
  });
});

describe('reactions on a room', () => {
  it('are tapped by keyboard, tallied for everyone, and float only on a screen that can animate', async () => {
    const animate = vi.fn(() => ({ finished: new Promise(() => undefined), cancel: () => undefined }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const user = userEvent.setup();
    const t = await start();
    await t.begin(REACTIONS_KEY, { type: 'start' });
    const ann = t.phone('ann');
    ann.getByRole('button', { name: 'Love it' }).focus();
    await user.keyboard('{Enter}');
    await flush();
    const bo = t.phone('bo');
    expect(bo.getAllByText('1').length).toBeGreaterThan(0); // the tally, for the other phone too
    expect(document.querySelectorAll('[data-slot="reaction-float"]').length).toBeGreaterThan(0);
  });

  it('only count under reduced motion', async () => {
    reduced.value = true;
    const user = userEvent.setup();
    const t = await start();
    await t.begin(REACTIONS_KEY, { type: 'start' });
    await user.click(t.phone('ann').getByRole('button', { name: 'Agree' }));
    await flush();
    expect(document.querySelectorAll('[data-slot="reaction-float"]')).toHaveLength(0);
    expect(t.phone('bo').getAllByText('1').length).toBeGreaterThan(0);
  });

  it('are not sent again when one is lost: a late reaction is no reaction', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const t = await start({ lossy: true });
    await t.begin(REACTIONS_KEY, { type: 'start' });
    t.lossy!.drop(1);
    await user.click(t.phone('ann').getByRole('button', { name: 'Funny' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    await flush();
    expect(t.phone('bo').queryAllByText('1')).toHaveLength(0);
  });
});

describe('raised hands on a room', () => {
  it('go up by keyboard, say the place in line once, and say the turn when the host calls', async () => {
    const user = userEvent.setup();
    const t = await start();
    await t.begin(HANDS_KEY, { type: 'start' });
    const ann = t.phone('ann');
    const bo = t.phone('bo');
    await user.click(bo.getByRole('button', { name: 'Raise your hand' }));
    await flush();
    ann.getByRole('button', { name: 'Raise your hand' }).focus();
    await user.keyboard(' ');
    await flush();
    const annMessage = () => ann.getByText(/in line|next|turn/i);
    expect(annMessage().textContent).toBe('You are number 2 in line.');
    expect(annMessage().getAttribute('aria-live')).toBe('polite');
    expect(ann.getByRole('button', { name: 'Lower your hand' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(t.host.getByRole('button', { name: /call next/i }));
    await flush();
    expect(t.phone('bo').getByText('It is your turn to speak.')).toBeTruthy();
    expect(annMessage().textContent).toBe('You are next.');
    await user.click(t.host.getByRole('button', { name: /done|finish/i }));
    await flush();
    expect(t.phone('bo').queryByText('It is your turn to speak.')).toBeNull();
  });

  it('keep their place when the same raise arrives three times and out of order', async () => {
    const user = userEvent.setup();
    const t = await start({ flaky: true });
    await t.begin(HANDS_KEY, { type: 'start' });
    t.flaky!.hold();
    await user.click(t.phone('bo').getByRole('button', { name: 'Raise your hand' }));
    await flush();
    await user.click(t.phone('ann').getByRole('button', { name: 'Raise your hand' }));
    await flush();
    act(() => t.flaky!.release({ order: 'reverse', repeat: 3 }));
    await flush();
    expect(t.phone('ann').getByText('You are number 2 in line.')).toBeTruthy();
  });
});

describe('the spectrum on a room', () => {
  it('takes a dot placed by keyboard, and every phone shows the room in words', async () => {
    const user = userEvent.setup();
    const t = await start();
    await t.begin(SPECTRUM_KEY, { type: 'start' });
    const ann = t.phone('ann');
    const thumb = ann.getByRole('slider');
    thumb.focus();
    fireEvent.keyDown(thumb, { key: 'End' });
    await user.click(ann.getByRole('button', { name: 'Place my dot' }));
    await flush();
    expect(document.activeElement?.getAttribute('data-slot')).toBe('spectrum-result');
    expect(t.apis.host!.room!.shared).toHaveProperty(SPECTRUM_KEY);
    expect(t.phone('bo').getByRole('slider')).toBeTruthy(); // the other phone has not placed one yet
    const placed = (t.apis.host!.room!.shared as Record<string, { placed: Record<string, number> }>)[SPECTRUM_KEY]!.placed;
    expect(placed).toEqual({ ann: 100 });
  });
});
