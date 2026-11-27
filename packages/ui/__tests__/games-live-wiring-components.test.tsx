/**
 * #243's components, unchanged, on a live room through their hooks: what a person does on one phone
 * reaches the host and another phone, what the host does reaches every phone, and what a phone's own
 * refresh forgets comes back from the room.
 */
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DotVote } from '../src/games/dot-vote.js';
import { PictureReveal } from '../src/games/picture-reveal.js';
import { PinDrop } from '../src/games/pin-drop.js';
import { PointsSplit } from '../src/games/points-split.js';
import { Prediction } from '../src/games/prediction.js';
import { Quadrant } from '../src/games/quadrant.js';
import { RankChoices, RankResults } from '../src/games/ranking.js';
import { Rating } from '../src/games/rating.js';
import { ReflectionCard } from '../src/games/reflection-card.js';
import { RoomGoal } from '../src/games/room-goal.js';
import { NoteBoard } from '../src/games/note-board.js';
import { TextWall } from '../src/games/text-wall.js';
import { TypeAnswer } from '../src/games/type-answer.js';
import { WordCloud, WordEntry } from '../src/games/word-cloud.js';
import {
  DOTS_KEY, PIN_KEY, POINTS_KEY, PREDICTION_KEY, QUADRANT_KEY, RANKING_KEY, RATING_KEY, TYPED_KEY,
  dotsActivity, pinActivity, pointsActivity, predictionActivity, quadrantActivity, rankingActivity, ratingActivity, typedActivity,
} from '../src/games/live-collect-model.js';
import { GOAL_KEY, REVEAL_KEY, goalActivity, revealActivity } from '../src/games/live-host-model.js';
import { CLOUD_KEY, NOTES_KEY, WALL_KEY, cloudActivity, notesActivity, wallActivity } from '../src/games/live-text-model.js';
import { useRoom, type UseRoomResult } from '../src/games/live-room.js';
import { createMemoryRoomHub, createRoom, type RoomMessage, type RoomSettings } from '../src/games/room-model.js';
import {
  useRoomCloud, useRoomDots, useRoomGoal, useRoomNotes, useRoomPin, useRoomPoints, useRoomPrediction, useRoomQuadrant,
  useRoomRanking, useRoomRating, useRoomReflection, useRoomReveal, useRoomTypeAnswer, useRoomWall,
} from '../src/games/use-room-activities.js';

if (typeof window.PointerEvent === 'undefined') {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}
afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

const HOST = 'host';
const CODE = 'K7Q4MZ';
const ACCEPTED = ['Haifa'];
const settings: RoomSettings = {
  activities: {
    [RATING_KEY]: ratingActivity, [QUADRANT_KEY]: quadrantActivity, [PIN_KEY]: pinActivity, [RANKING_KEY]: rankingActivity,
    [POINTS_KEY]: pointsActivity, [DOTS_KEY]: dotsActivity, [PREDICTION_KEY]: predictionActivity, [TYPED_KEY]: typedActivity(),
    [CLOUD_KEY]: cloudActivity(), [WALL_KEY]: wallActivity(), [NOTES_KEY]: notesActivity(), [GOAL_KEY]: goalActivity, [REVEAL_KEY]: revealActivity,
  },
};
const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => {});
};

function useAll(api: UseRoomResult, id: string) {
  return {
    api,
    rating: useRoomRating(api, id), quadrant: useRoomQuadrant(api, id), pin: useRoomPin(api, id), ranking: useRoomRanking(api, id),
    points: useRoomPoints(api, id), dots: useRoomDots(api, id), prediction: useRoomPrediction(api, id),
    typed: useRoomTypeAnswer(api, id, { accepted: ACCEPTED }), cloud: useRoomCloud(api, id), wall: useRoomWall(api, id),
    reflection: useRoomReflection(api, id), notes: useRoomNotes(api, id), goal: useRoomGoal(api, id), reveal: useRoomReveal(api, id),
  };
}
type All = ReturnType<typeof useAll>;
const phones = new Map<string, All>();

function Phone({ id, hub, host, ui }: { id: string; hub: ReturnType<typeof createMemoryRoomHub<RoomMessage>>; host?: boolean; ui: (h: All) => React.ReactNode }) {
  let t = 1_000_000;
  const api = useRoom({ transport: hub.connect(), selfId: id, host: host ? createRoom({ code: CODE, hostId: HOST }) : undefined, code: host ? undefined : CODE, settings, now: () => (t += 1500) });
  const all = useAll(api, id);
  phones.set(id, all);
  return <section aria-label={`screen ${id}`}>{ui(all)}</section>;
}

async function room(ids: string[], ui: (h: All) => React.ReactNode) {
  phones.clear();
  const hub = createMemoryRoomHub<RoomMessage>();
  render(
    <>
      <Phone id={HOST} hub={hub} host ui={() => null} />
      {ids.map((id) => (
        <Phone key={id} id={id} hub={hub} ui={ui} />
      ))}
    </>,
  );
  await flush();
  for (const id of ids) await act(async () => phones.get(id)!.api.send({ type: 'join', playerId: id, name: id }));
  await flush();
  return { screen: (id: string) => within(screen.getByRole('region', { name: `screen ${id}` })), host: () => phones.get(HOST)!, of: (id: string) => phones.get(id)! };
}
const call = async (fn: () => unknown) => {
  await act(async () => void fn());
  await flush();
};

describe('rating', () => {
  it('is sent with the keyboard-reachable radios, reaches the host, and the other phone reads the room', async () => {
    const t = await room(['p1', 'p2'], (h) => (h.rating.props ? <Rating question="How familiar is this?" {...h.rating.props} /> : null));
    expect(t.screen('p1').queryByRole('radiogroup')).toBeNull(); // before the host starts
    await call(() => t.host().rating.start());
    for (const [id, n] of [['p1', '4'], ['p2', '2']] as const) {
      await act(async () => void fireEvent.click(t.screen(id).getByRole('radio', { name: n })));
      await act(async () => void fireEvent.click(t.screen(id).getByRole('button', { name: 'Send' })));
      await flush();
    }
    expect(t.host().rating.state?.entries).toEqual({ p1: 4, p2: 2 });
    expect(t.screen('p1').getByText(/2 people answered\. Yours: 4\./)).toBeTruthy();
    await call(() => t.host().rating.clear());
    expect(t.host().rating.state?.entries).toEqual({});
  });
});

describe('quadrant, pin, points, dots and ranking', () => {
  it('quadrant: a dot placed on one phone is on the host, and that phone shows it placed', async () => {
    const t = await room(['p1', 'p2'], (h) => (h.quadrant.props ? <Quadrant prompt="Where?" axes={{ x: ['Low', 'High'], y: ['Easy', 'Hard'] }} {...h.quadrant.props} /> : null));
    await call(() => t.host().quadrant.start());
    await call(() => t.of('p1').quadrant.props!.onPlace({ x: 20, y: 80 }));
    expect(t.host().quadrant.state?.entries).toEqual({ p1: { x: 20, y: 80 } });
    expect(screen.getByRole('region', { name: 'screen p1' }).querySelector('[data-slot="quadrant"]')?.getAttribute('data-state')).toBe('placed');
    expect(t.of('p1').quadrant.mine).toEqual({ x: 20, y: 80 });
  });

  it('pin: pins reach the host, the reveal closes it, and a late pin is refused', async () => {
    const t = await room(['p1', 'p2'], (h) => (h.pin.props ? <PinDrop prompt="Where is it?" src="/x.png" alt="A map" {...h.pin.props} /> : null));
    await call(() => t.host().pin.start());
    await call(() => t.of('p1').pin.props!.onPlace({ x: 30, y: 40 }));
    await call(() => t.host().pin.reveal({ x: 35, y: 45 }));
    await call(() => t.of('p2').pin.props!.onPlace({ x: 1, y: 1 }));
    expect(t.host().pin.state).toMatchObject({ entries: { p1: { x: 30, y: 40 } }, open: false, revealed: { x: 35, y: 45 } });
    expect(t.of('p2').pin.props).toMatchObject({ revealed: true, answer: { x: 35, y: 45 } });
  });

  it('points: a split that fits is kept, one that does not never leaves the phone as a valid one', async () => {
    const t = await room(['p1'], (h) =>
      h.points.props ? <PointsSplit question="Where does it go?" options={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} {...h.points.props} /> : null,
    );
    await call(() => t.host().points.start(['a', 'b']));
    await call(() => t.of('p1').points.props!.onSend({ a: 70, b: 70 }));
    expect(t.host().points.state?.entries).toEqual({});
    await call(() => t.of('p1').points.props!.onSend({ a: 70, b: 30 }));
    expect(t.host().points.state?.entries).toEqual({ p1: { a: 70, b: 30 } });
    expect(t.host().points.totals?.totals[0]).toMatchObject({ id: 'a', points: 70 });
    expect(t.screen('p1').getByText('Sent. Thank you.')).toBeTruthy();
  });

  it('dots: a ballot is held to the dots, and the room\'s ranking follows', async () => {
    const ideas = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }];
    const t = await room(['p1', 'p2'], (h) => (h.dots.props ? <DotVote question="Which?" ideas={ideas} {...h.dots.props} /> : null));
    await call(() => t.host().dots.start(['a', 'b', 'c'], { dots: 3 }));
    await call(() => t.of('p1').dots.props!.onSend({ a: 3, b: 3 }));
    await call(() => t.of('p2').dots.props!.onSend({ b: 2 }));
    expect(t.host().dots.state?.entries).toEqual({ p1: { a: 3 }, p2: { b: 2 } });
    expect(t.host().dots.tally?.rows[0]).toMatchObject({ id: 'a', dots: 3 });
    expect(t.of('p1').dots.left).toBe(0);
  });

  it('ranking: an order is sent with the component, and the room\'s combined order is drawn', async () => {
    const options = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }];
    const t = await room(['p1', 'p2'], (h) =>
      h.ranking.props ? (
        <>
          <RankChoices question="Order them" options={options} defaultOrder={['b', 'a', 'c']} {...h.ranking.props} />
          {h.ranking.results ? <RankResults items={h.ranking.results.items} options={options} /> : null}
        </>
      ) : null,
    );
    await call(() => t.host().ranking.start(['a', 'b', 'c']));
    await act(async () => void fireEvent.click(t.screen('p1').getByRole('button', { name: 'Send my order' })));
    await flush();
    expect(t.host().ranking.state?.entries).toEqual({ p1: ['b', 'a', 'c'] });
    expect(t.host().ranking.results?.items[0]).toMatchObject({ id: 'b', firsts: 1 });
    expect(t.screen('p1').getByText('Sent. Thank you.')).toBeTruthy();
  });
});

describe('prediction and typed answer', () => {
  it('prediction: one call is locked, the host\'s outcome closes it and every phone shows it', async () => {
    const options = [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }];
    const t = await room(['p1', 'p2'], (h) => (h.prediction.props ? <Prediction question="Will it?" options={options} {...h.prediction.props} /> : null));
    await call(() => t.host().prediction.start(['yes', 'no']));
    await act(async () => void fireEvent.click(t.screen('p1').getByRole('radio', { name: 'Yes' })));
    await act(async () => void fireEvent.click(t.screen('p1').getByRole('button', { name: 'Lock it in' })));
    await flush();
    await call(() => t.of('p1').prediction.props!.onLock('no')); // a second call is refused: the first stands
    expect(t.host().prediction.state?.entries).toEqual({ p1: 'yes' });
    await call(() => t.host().prediction.reveal('yes'));
    expect(t.of('p2').prediction.props).toMatchObject({ outcome: 'yes', closed: true, counts: { yes: 1, no: 0 } });
    expect(t.host().prediction.settled?.winners).toEqual(['p1']);
  });

  it('typed answer: text goes to the room once, and a refreshed phone gets its result back from it', async () => {
    const t = await room(['p1', 'p2'], (h) => (h.typed.props ? <TypeAnswer question="Name the city" accepted={ACCEPTED} {...h.typed.props} /> : null));
    await call(() => t.host().typed.start());
    const field = t.screen('p1').getByRole('textbox');
    await act(async () => void fireEvent.change(field, { target: { value: 'Haifa' } }));
    await act(async () => void fireEvent.click(t.screen('p1').getByRole('button', { name: 'Answer' })));
    await flush();
    expect(t.host().typed.state?.entries).toEqual({ p1: 'Haifa' });
    expect(t.of('p1').typed.props?.result).toMatchObject({ text: 'Haifa', match: { outcome: 'exact' } });
    expect(t.of('p2').typed.props?.room).toEqual(['Haifa']);
    await call(() => t.of('p1').typed.props!.onAnswer({ text: 'Other', match: { outcome: 'wrong' } } as never)); // a second answer is refused
    expect(t.host().typed.state?.entries).toEqual({ p1: 'Haifa' });
    await call(() => t.of('p1').typed.props!.onAnswer({ text: null, match: { outcome: 'empty' } } as never)); // nothing is sent for no answer
    expect(t.host().typed.state?.entries).toEqual({ p1: 'Haifa' });
  });
});

describe('typed text', () => {
  it('word cloud: a word is sent with the entry, shows on the cloud, and the person\'s own is marked', async () => {
    const t = await room(['p1', 'p2'], (h) =>
      h.cloud.cloud && h.cloud.entry ? (
        <>
          <WordCloud {...h.cloud.cloud} />
          <WordEntry {...h.cloud.entry} />
        </>
      ) : null,
    );
    await call(() => t.host().cloud.start({ maxWords: 2 }));
    await act(async () => void fireEvent.change(t.screen('p1').getByRole('textbox'), { target: { value: 'Sea' } }));
    await act(async () => void fireEvent.click(t.screen('p1').getByRole('button', { name: 'Send' })));
    await flush();
    expect(t.host().cloud.state?.entries).toEqual([{ by: 'p1', text: 'Sea' }]);
    expect(t.screen('p2').getAllByText('Sea').length).toBeGreaterThan(0);
    expect(t.of('p1').cloud.sent).toEqual(['Sea']);
    await call(() => t.host().cloud.open(false));
    expect(t.screen('p1').getByRole('textbox').hasAttribute('disabled')).toBe(true);
  });

  it('open wall: a post waits for the host, shows once approved, and can be put in the spotlight', async () => {
    const t = await room(['p1', 'p2'], (h) => (h.wall.props ? <TextWall {...h.wall.props} /> : null));
    await call(() => t.host().wall.start());
    await call(() => t.of('p1').wall.post('A thought worth sharing'));
    expect(t.of('p2').wall.review).toHaveLength(1);
    expect(t.screen('p2').queryByText('A thought worth sharing')).toBeNull();
    await call(() => t.host().wall.approve('w1'));
    expect(t.screen('p2').getByText('A thought worth sharing')).toBeTruthy();
    await call(() => t.host().wall.spotlight('w1'));
    expect(t.of('p2').wall.props?.spotlight).toBe('w1');
    await call(() => t.of('p1').wall.post('see http://example.com')); // refused on the host, however the phone behaved
    await call(() => t.host().wall.dismiss('w1'));
    expect(t.screen('p2').queryByText('A thought worth sharing')).toBeNull();
    await call(() => t.host().wall.open(false));
    await call(() => t.host().wall.clear());
    expect(t.host().wall.state?.posts).toEqual([]);
  });

  it('reflection: a private note goes nowhere, a shared one goes to the wall for approval', async () => {
    const t = await room(['p1'], (h) => <ReflectionCard prompt="What surprised you?" shareable onSave={h.reflection.onSave} />);
    await call(() => t.host().wall.start());
    const field = t.screen('p1').getByRole('textbox');
    await act(async () => void fireEvent.change(field, { target: { value: 'Only for me' } }));
    await act(async () => void fireEvent.click(t.screen('p1').getByRole('button', { name: 'Save' })));
    await flush();
    expect(t.host().wall.state?.posts).toEqual([]);
    await act(async () => void fireEvent.click(t.screen('p1').getByRole('checkbox')));
    await act(async () => void fireEvent.change(field, { target: { value: 'For the room' } }));
    await act(async () => void fireEvent.click(t.screen('p1').getByRole('button', { name: 'Save' })));
    await flush();
    expect(t.host().wall.state?.posts.map((p) => [p.text, p.status])).toEqual([['For the room', 'review']]);
  });

  it('note board: a note added on one phone is on the other, and any phone may move it', async () => {
    const t = await room(['p1', 'p2'], (h) => (h.notes.props ? <NoteBoard {...h.notes.props} /> : null));
    await call(() => t.host().notes.start([{ id: 'now', label: 'Now' }, { id: 'later', label: 'Later' }]));
    await call(() => t.of('p1').notes.props!.onAdd('now', 'A sticky note'));
    expect(t.screen('p2').getByText('A sticky note')).toBeTruthy();
    await call(() => t.of('p2').notes.props!.onMove({ id: 'n1', column: 'later', at: 0 }));
    expect(t.host().notes.state?.moves).toEqual([expect.objectContaining({ id: 'n1', column: 'later' })]);
    expect(t.of('p1').notes.props?.columns).toEqual([{ id: 'now', title: 'Now' }, { id: 'later', title: 'Later' }]);
    await call(() => t.host().notes.open(false));
    await call(() => t.of('p1').notes.props!.onAdd('now', 'Too late'));
    expect(t.host().notes.state?.notes).toHaveLength(1);
    await call(() => t.host().notes.clear());
    expect(t.host().notes.state?.notes).toEqual([]);
  });
});

describe('the host\'s big-screen activities', () => {
  it('picture reveal: every phone follows the host\'s step, then the reveal', async () => {
    const t = await room(['p1', 'p2'], (h) => (h.reveal.props ? <PictureReveal src="/x.png" alt="A picture" answer="The harbour" cols={4} rows={4} {...h.reveal.props} /> : null));
    await call(() => t.host().reveal.start(4, 'haifa'));
    await call(() => t.host().reveal.step(2));
    for (const id of ['p1', 'p2']) expect(t.of(id).reveal.props).toMatchObject({ step: 2, steps: 4, revealed: false });
    expect(t.screen('p1').queryByText('The harbour')).toBeNull();
    await call(() => t.host().reveal.reveal());
    expect(t.screen('p2').getByText('The harbour')).toBeTruthy();
    await call(() => t.host().reveal.cover());
    expect(t.of('p1').reveal.props).toMatchObject({ step: 0, revealed: false });
  });

  it('room goal: the meter fills from the room\'s points and shows the streak', async () => {
    const t = await room(['p1', 'p2'], (h) => (h.goal.props ? <RoomGoal {...h.goal.props} /> : null));
    await call(() => t.host().goal.start({ label: 'Room goal', target: 100, milestones: [{ at: 50, label: 'Half way' }] }));
    await call(() => t.host().api.send({ type: 'countdown', startsAt: 1 }));
    await call(() => t.host().api.send({ type: 'question', endsAt: null }));
    await call(() => t.host().api.send({ type: 'reveal', points: { p1: 30, p2: 30 } }));
    await call(() => t.host().goal.round({ right: 9, answered: 10 }));
    expect(t.of('p1').goal.props).toMatchObject({ value: 60, target: 100, streak: 1 });
    expect(t.screen('p2').getByRole('meter')).toBeTruthy();
    await call(() => t.host().goal.clear());
    expect(t.of('p1').goal.props?.streak).toBe(0);
  });
});

describe('the typed answer hook', () => {
  it('sends text once it is an answer, and nothing for no answer', () => {
    const send = vi.fn();
    const room = { shared: { [TYPED_KEY]: { meta: {}, entries: {}, open: true, revealed: null } }, players: [{ id: 'p1', name: 'p1', connected: true }] } as never;
    const { result } = renderHook(() => useRoomTypeAnswer({ room, send }, 'p1', { accepted: ACCEPTED }));
    result.current.props!.onAnswer({ text: null, match: { outcome: 'empty' } } as never);
    result.current.props!.onAnswer({ text: 'Haifa', match: { outcome: 'exact' } } as never);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({ type: 'submit', key: TYPED_KEY, playerId: 'p1', action: { type: 'send', value: 'Haifa' } });
  });
});

describe('before the host starts, and with reduced motion', () => {
  it('every hook gives null props before its activity starts, and never animates', async () => {
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const t = await room(['p1'], () => null);
    const h = t.of('p1');
    for (const props of [h.rating.props, h.quadrant.props, h.pin.props, h.ranking.props, h.points.props, h.dots.props, h.prediction.props, h.typed.props, h.cloud.cloud, h.cloud.entry, h.wall.props, h.notes.props, h.goal.props, h.reveal.props]) {
      expect(props).toBeNull();
    }
    expect(h.dots.left).toBe(0);
    expect(h.cloud.sent).toEqual([]);
    expect(animate).not.toHaveBeenCalled();
    await userEvent.setup().tab();
  });
});
