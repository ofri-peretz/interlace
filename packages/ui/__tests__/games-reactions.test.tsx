/**
 * Reactions and raised hands: the budgets and the queue a host owns, and
 * the four parts people see.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  allowReaction,
  applyHandEvent,
  createHands,
  placeInLine,
  tallyReactions,
  type HandEvent,
  type HandState,
} from '../src/games/reactions-model.js';
import { HandQueue, MIN_VIEWPORT, RaiseHand, ReactionBar, ReactionStream } from '../src/games/reactions.js';

afterEach(cleanup);

describe('reactions-model', () => {
  it('lets each person send a few reactions per window', () => {
    let budget = {};
    const sent: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = allowReaction(budget, 'p', i * 10, { perWindow: 3, windowMs: 1000 });
      sent.push(r.ok);
      budget = r.budget;
    }
    expect(sent).toEqual([true, true, true, false]);
    expect(allowReaction(budget, 'q', 40, { perWindow: 3, windowMs: 1000 }).ok).toBe(true);
    // The window slides: old taps stop counting.
    expect(allowReaction(budget, 'p', 1005, { perWindow: 3, windowMs: 1000 }).ok).toBe(true);
    expect(allowReaction({}, 'p', 0).budget).toEqual({ p: [0] });
  });

  it('tallies by kind in the listed order and ignores unknown kinds', () => {
    expect(tallyReactions(['a', 'b'], [{ kind: 'b' }, { kind: 'x' }, { kind: 'b' }])).toEqual([
      { kind: 'a', count: 0 },
      { kind: 'b', count: 2 },
    ]);
  });

  it('keeps a first-raised, first-called line', () => {
    const run = (s: HandState, ...events: HandEvent[]) => events.reduce(applyHandEvent, s);
    let s = run(
      createHands(),
      { type: 'raise', by: 'a', name: 'Ana', at: 1 },
      { type: 'raise', by: 'b', name: 'Ben', at: 2 },
      { type: 'raise', by: 'c', name: 'Cy', at: 3 },
    );
    expect(run(s, { type: 'raise', by: 'a', name: 'Ana', at: 9 })).toBe(s);
    expect(placeInLine(s, 'b')).toBe(2);
    expect(placeInLine(s, 'z')).toBeNull();
    s = run(s, { type: 'lower', by: 'a' }, { type: 'raise', by: 'a', name: 'Ana', at: 4 });
    expect(s.hands.map((h) => h.by)).toEqual(['b', 'c', 'a']);
    expect(run(s, { type: 'lower', by: 'z' })).toBe(s);
    s = run(s, { type: 'call' });
    expect(s.speaking?.by).toBe('b');
    s = run(s, { type: 'call', by: 'a' });
    expect(s.speaking?.by).toBe('a');
    expect(s.hands.map((h) => h.by)).toEqual(['c']);
    expect(run(s, { type: 'call', by: 'z' })).toBe(s);
    s = run(s, { type: 'done' });
    expect(s.speaking).toBeNull();
    expect(run(s, { type: 'done' })).toBe(s);
    expect(run(s, { type: 'clear' })).toEqual(createHands());
    expect(run(createHands(), { type: 'call' })).toEqual(createHands());
  });
});

describe('ReactionBar', () => {
  it('sends the kind on every tap', () => {
    const onReact = vi.fn();
    const { container } = render(<ReactionBar onReact={onReact} />);
    expect(container.firstElementChild?.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    fireEvent.click(screen.getByRole('button', { name: 'Love it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lost me' }));
    expect(onReact.mock.calls.map((c) => c[0])).toEqual(['love', 'confused']);
    expect(screen.getByRole('group', { name: 'React' })).toBeTruthy();
  });
});

describe('ReactionStream', () => {
  it('floats only new reactions and keeps a readable tally', () => {
    const animate = vi.fn(() => ({ finished: new Promise(() => undefined), cancel: vi.fn() }));
    const proto = HTMLElement.prototype as unknown as { animate?: unknown };
    const real = proto.animate;
    proto.animate = animate;
    try {
      const first = [{ id: '1', kind: 'love' }];
      const { container, rerender } = render(<ReactionStream reactions={first} locale="en-US" />);
      expect(container.querySelectorAll('[data-slot="reaction-float"]')).toHaveLength(0);
      rerender(
        <ReactionStream
          reactions={[...first, { id: '2', kind: 'agree' }, { id: '3', kind: 'nope' }, { id: '4', kind: 'love' }]}
          maxFloating={1}
          locale="en-US"
        />,
      );
      const floats = container.querySelectorAll('[data-slot="reaction-float"]');
      expect(floats).toHaveLength(1);
      expect(floats[0]?.getAttribute('data-kind')).toBe('love');
      expect(screen.getByText('Love it:').parentElement?.textContent).toBe('Love it: 2');
      expect(animate).toHaveBeenCalledTimes(1);
    } finally {
      proto.animate = real;
    }
  });

  it('removes a float when its animation ends, or at once without animation', async () => {
    const { container, rerender } = render(<ReactionStream reactions={[]} showTally={false} />);
    rerender(<ReactionStream reactions={[{ id: 'a', kind: 'love' }]} showTally={false} />);
    // jsdom has no element.animate: the float leaves at once.
    expect(container.querySelectorAll('[data-slot="reaction-float"]')).toHaveLength(0);
    expect(container.querySelector('[data-slot="reaction-stream-tally"]')).toBeNull();

    let finish: () => void = () => undefined;
    const proto = HTMLElement.prototype as unknown as { animate?: unknown };
    const real = proto.animate;
    proto.animate = () => ({ finished: new Promise<void>((r) => (finish = r)), cancel: vi.fn() });
    try {
      rerender(
        <ReactionStream
          reactions={[
            { id: 'a', kind: 'love' },
            { id: 'b', kind: 'love' },
          ]}
          showTally={false}
        />,
      );
      expect(container.querySelectorAll('[data-slot="reaction-float"]')).toHaveLength(1);
      await act(async () => finish());
      expect(container.querySelectorAll('[data-slot="reaction-float"]')).toHaveLength(0);
    } finally {
      proto.animate = real;
    }
  });
});

describe('RaiseHand', () => {
  it('toggles and says the place in line, then the turn', () => {
    const onChange = vi.fn();
    const { rerender } = render(<RaiseHand raised={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Raise your hand' }));
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(<RaiseHand raised onChange={onChange} place={1} />);
    expect(screen.getByText('You are next.')).toBeTruthy();
    rerender(<RaiseHand raised onChange={onChange} place={3} />);
    expect(screen.getByText('You are number 3 in line.')).toBeTruthy();
    const lower = screen.getByRole('button', { name: 'Lower your hand' });
    expect(lower.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(lower);
    expect(onChange).toHaveBeenLastCalledWith(false);
    rerender(<RaiseHand raised={false} speaking />);
    expect(screen.getByText('It is your turn to speak.')).toBeTruthy();
  });
});

describe('HandQueue', () => {
  it('calls the next, a named person, lowers and finishes', () => {
    const onCall = vi.fn();
    const onLower = vi.fn();
    const onDone = vi.fn();
    const hands = [
      { by: 'a', name: 'Ana', at: 1 },
      { by: 'b', name: 'Ben', at: 2 },
    ];
    const { rerender } = render(
      <HandQueue
        hands={hands}
        speaking={{ by: 'c', name: 'Cy', at: 0 }}
        onCall={onCall}
        onLower={onLower}
        onDone={onDone}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Call next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Call on Ben' }));
    fireEvent.click(screen.getByRole('button', { name: "Lower Ana's hand" }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCall.mock.calls).toEqual([[], ['b']]);
    expect(onLower).toHaveBeenCalledWith('a');
    expect(onDone).toHaveBeenCalled();
    expect(screen.getByText('Cy')).toBeTruthy();
    rerender(<HandQueue hands={[]} />);
    expect(screen.getByText('No hands up.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Call next' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
