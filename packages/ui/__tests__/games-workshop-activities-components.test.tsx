/**
 * The workshop activities' components on a live room through their hooks: what a person does on a
 * phone reaches the host and every other phone, what the host does is spoken on every phone, and
 * none of it needs a pointer or an animation.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CheckIn } from '../src/games/check-in.js';
import { CHECK_IN_KEY, checkInActivity } from '../src/games/check-in-model.js';
import { DebateCorners } from '../src/games/debate-corners.js';
import { CORNERS_KEY, cornersActivity } from '../src/games/debate-corners-model.js';
import { ExitTicket } from '../src/games/exit-ticket.js';
import { EXIT_TICKET_KEY, exitTicketActivity } from '../src/games/exit-ticket-model.js';
import { useRoom, type UseRoomResult } from '../src/games/live-room.js';
import { createMemoryRoomHub, createRoom, type RoomMessage, type RoomSettings } from '../src/games/room-model.js';
import { useRoomCheckIn, useRoomCorners, useRoomExitTicket } from '../src/games/use-workshop-activities.js';

if (typeof window.PointerEvent === 'undefined') {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}
afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

const HOST = 'host';
const CODE = 'K7Q4MZ';
const settings: RoomSettings = { activities: { [CORNERS_KEY]: cornersActivity, [EXIT_TICKET_KEY]: exitTicketActivity, [CHECK_IN_KEY]: checkInActivity } };
const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => {});
};

type Hooks = { corners: ReturnType<typeof useRoomCorners>; ticket: ReturnType<typeof useRoomExitTicket>; checkIn: ReturnType<typeof useRoomCheckIn>; api: UseRoomResult };
const hooks = new Map<string, Hooks>();

function Phone({ id, hub, host }: { id: string; hub: ReturnType<typeof createMemoryRoomHub<RoomMessage>>; host?: boolean }) {
  let t = 1_000_000;
  const api = useRoom({
    transport: hub.connect(),
    selfId: id,
    host: host ? createRoom({ code: CODE, hostId: HOST }) : undefined,
    code: host ? undefined : CODE,
    settings,
    now: () => (t += 1500),
  });
  const corners = useRoomCorners(api, id);
  const ticket = useRoomExitTicket(api, id);
  const checkIn = useRoomCheckIn(api, id);
  hooks.set(id, { corners, ticket, checkIn, api });
  return (
    <section aria-label={`screen ${id}`}>
      {corners.props ? <DebateCorners {...corners.props} /> : null}
      {ticket.props ? <ExitTicket {...ticket.props} /> : null}
      {checkIn.props ? <CheckIn prompt="How are you arriving?" {...checkIn.props} /> : null}
    </section>
  );
}

async function room(ids: string[]) {
  hooks.clear();
  const hub = createMemoryRoomHub<RoomMessage>();
  render(
    <>
      <Phone id={HOST} hub={hub} host />
      {ids.map((id) => (
        <Phone key={id} id={id} hub={hub} />
      ))}
    </>,
  );
  await flush();
  for (const id of ids) await act(async () => hooks.get(id)!.api.send({ type: 'join', playerId: id, name: id }));
  await flush();
  return (id: string) => within(screen.getByRole('region', { name: `screen ${id}` }));
}

describe('debate corners on a room', () => {
  const CORNERS = [
    { id: 'a', label: 'Agree' },
    { id: 'b', label: 'Disagree' },
  ];

  it('a pick on one phone reaches the host and the other phone, which speaks where the host called', async () => {
    const view = await room(['p1', 'p2']);
    await act(async () => void hooks.get(HOST)!.corners.start('Mornings are best.', CORNERS));
    await flush();
    expect(view('p1').getByRole('radiogroup', { name: 'Mornings are best.' })).toBeTruthy();
    await act(async () => void fireEvent.click(view('p1').getByRole('radio', { name: 'Agree' })));
    await act(async () => void fireEvent.click(view('p2').getByRole('radio', { name: 'Agree' })));
    await flush();
    expect(hooks.get(HOST)!.corners.tally?.total).toBe(2);
    expect(view('p2').getByText('You are in Agree. 2 of 2 are there with you.')).toBeTruthy();
    await act(async () => void hooks.get(HOST)!.corners.call('b'));
    await flush();
    expect(view('p1').getByText(/Disagree is defending its position\./)).toBeTruthy();
    await act(async () => void hooks.get(HOST)!.corners.lock(true));
    await flush();
    expect(view('p1').getByText(/The corners are locked\./)).toBeTruthy();
    await act(async () => void fireEvent.click(view('p1').getByRole('radio', { name: 'Disagree' })));
    await flush();
    expect(hooks.get(HOST)!.corners.state?.picks).toEqual({ p1: 'a', p2: 'a' });
  });

  it('is moved by the arrow keys once it has focus', async () => {
    const user = userEvent.setup();
    const view = await room(['p1']);
    await act(async () => void hooks.get(HOST)!.corners.start('S', CORNERS));
    await flush();
    const first = view('p1').getAllByRole('radio')[0] as HTMLElement;
    await user.click(first); // reaches it the way Tab would: focus on the first radio of the group
    await flush();
    expect(hooks.get('p1')!.corners.mine).toBe('a');
    await user.keyboard('{ArrowDown}');
    await flush();
    expect(hooks.get('p1')!.corners.mine).toBe('b');
    expect(hooks.get(HOST)!.corners.state?.picks).toEqual({ p1: 'b' });
    expect(view('p1').getByRole('radio', { name: 'Disagree' }).getAttribute('aria-checked')).toBe('true');
  });

  it('draws nothing with animate, so reduced motion has nothing to turn off', async () => {
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const view = await room(['p1']);
    await act(async () => void hooks.get(HOST)!.corners.start('S', CORNERS));
    await flush();
    await act(async () => void fireEvent.click(view('p1').getByRole('radio', { name: 'Agree' })));
    await flush();
    expect(animate).not.toHaveBeenCalled();
  });
});

describe('exit ticket on a room', () => {
  const QUESTIONS = [
    { id: 'rec', kind: 'nps', prompt: 'Recommend?' },
    { id: 'clear', kind: 'scale', prompt: 'Clear?', min: 1, max: 5 },
  ] as const;

  it('collects tickets from several phones, scores them, and stops when the host closes it', async () => {
    const view = await room(['p1', 'p2', 'p3']);
    await act(async () => void hooks.get(HOST)!.ticket.start(QUESTIONS));
    await flush();
    const answer = async (id: string, nps: string) => {
      const group = view(id).getByRole('radiogroup', { name: 'Recommend?' });
      await act(async () => void fireEvent.click(within(group).getByRole('radio', { name: nps })));
      await act(async () => void fireEvent.click(view(id).getByRole('button', { name: 'Send' })));
      await flush();
    };
    await answer('p1', '10');
    await answer('p2', '9');
    await answer('p3', '3');
    expect(hooks.get(HOST)!.ticket.count).toBe(3);
    expect(hooks.get(HOST)!.ticket.summary[0]).toMatchObject({ kind: 'nps', promoters: 2, detractors: 1, score: 33 });
    expect(view('p1').getByText('Score 33: 2 promoters, 0 passives, 1 detractors.')).toBeTruthy();
    await act(async () => void hooks.get(HOST)!.ticket.close(true));
    await flush();
    expect(view('p1').getByText('The exit ticket is closed.')).toBeTruthy();
    expect(view('p1').queryByRole('button', { name: 'Change my answers' })).toBeNull();
  });
});

describe('check-in on a room', () => {
  it('shows the mood of the room and then how it moved when the host asks again', async () => {
    const view = await room(['p1', 'p2']);
    await act(async () => void hooks.get(HOST)!.checkIn.start());
    await flush();
    await act(async () => void fireEvent.click(view('p1').getByRole('radio', { name: 'Low' })));
    await act(async () => void fireEvent.click(view('p2').getByRole('radio', { name: 'Low' })));
    await flush();
    expect(view('p1').getByText('2 checked in. Most chose Low. You chose Low.')).toBeTruthy();
    await act(async () => void hooks.get(HOST)!.checkIn.ask('end'));
    await flush();
    expect(view('p1').queryByText(/You chose/)).toBeNull(); // a new round: nobody has answered yet
    await act(async () => void fireEvent.click(view('p1').getByRole('radio', { name: 'Great' })));
    await act(async () => void fireEvent.click(view('p2').getByRole('radio', { name: 'Good' })));
    await flush();
    expect(view('p1').getByText(/The room's mood moved \+2\.5 since before\./)).toBeTruthy();
  });
});
