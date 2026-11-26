/**
 * DotVote: spreading a few dots across a brainstorm's ideas, and how the
 * room's dots rank them.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { cleanBallot, dotsLeft, tallyDots } = await import('../src/games/dot-vote-model.js');
const { DotVote, MIN_VIEWPORT } = await import('../src/games/dot-vote.js');

afterEach(() => {
  cleanup();
  reduced.value = false;
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

const IDS = ['a', 'b', 'c'];
const IDEAS = [
  { id: 'a', text: 'Longer breaks' },
  { id: 'b', text: 'A shared playlist' },
  { id: 'c', text: 'Snacks from each team' },
];

describe('dot-vote-model', () => {
  it('makes a ballot valid: known ideas, whole counts, a cap per idea and in all', () => {
    expect(cleanBallot({ a: 2.7, b: -1, zzz: 3, c: Number.NaN }, IDS)).toEqual({ a: 2 });
    expect(cleanBallot({ a: 3, b: 3 }, IDS, { dots: 4, maxPerIdea: 2 })).toEqual({ a: 2, b: 2 });
    // Past the limit, the ideas listed last lose their dots.
    expect(cleanBallot({ a: 1, b: 1, c: 2 }, IDS)).toEqual({ a: 1, b: 1, c: 1 });
    expect(cleanBallot({ a: 1 }, IDS, { dots: 0 })).toEqual({});
    // Rules that make no sense fall back to the defaults.
    expect(cleanBallot({ a: 5 }, IDS, { dots: -2, maxPerIdea: Number.NaN })).toEqual({ a: 3 });
  });

  it('counts dots left', () => {
    expect(dotsLeft({})).toBe(3);
    expect(dotsLeft({ a: 2, b: Number.NaN })).toBe(1);
    expect(dotsLeft({ a: 9 }, { dots: 5 })).toBe(0);
  });

  it('ranks ideas by dots, ties in the ideas’ order, and counts people', () => {
    const t = tallyDots({ ann: { b: 2, c: 1 }, bo: { a: 1, c: 2 }, cy: {}, dee: { zzz: 3 } }, IDS);
    expect(t.rows).toEqual([
      { id: 'c', dots: 3, people: 2, rank: 1 },
      { id: 'b', dots: 2, people: 1, rank: 2 },
      { id: 'a', dots: 1, people: 1, rank: 3 },
    ]);
    expect(t.total).toBe(6);
    expect(t.voters).toBe(2);
    const tie = tallyDots({ ann: { a: 1, b: 1 } }, IDS);
    expect(tie.rows.map((r) => [r.id, r.rank])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 0],
    ]);
    expect(tallyDots({}, IDS)).toMatchObject({ total: 0, voters: 0 });
    // A ballot lost on the way counts as none.
    expect(tallyDots({ ann: null as unknown as Record<string, number> }, IDS).voters).toBe(0);
  });

  it('gives the same tally whatever order ballots arrive in', () => {
    const one = tallyDots({ zed: { a: 3 }, ann: { b: 2, c: 1 } }, IDS);
    const two = tallyDots({ ann: { b: 2, c: 1 }, zed: { a: 3 } }, IDS);
    expect(one).toEqual(two);
  });
});

describe('DotVote', () => {
  it('spreads dots, stops at the limits, and sends a valid ballot once', () => {
    const onSend = vi.fn();
    const { container } = render(
      <DotVote question="Which ideas should we try?" ideas={IDEAS} dots={3} maxPerIdea={2} onSend={onSend} />,
    );
    const root = container.querySelector('[data-slot="dot-vote"]') as HTMLElement;
    expect(root.dataset.state).toBe('voting');
    expect(root.dataset.minViewport).toBe(String(MIN_VIEWPORT));
    const send = screen.getByRole('button', { name: 'Send my dots' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    expect(screen.getByText('3 dots left')).toBeTruthy();
    const addA = screen.getByRole('button', { name: 'Add a dot to Longer breaks' }) as HTMLButtonElement;
    fireEvent.click(addA);
    fireEvent.click(addA);
    expect(addA.disabled).toBe(true);
    expect(screen.getByText('1 dot left')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a dot to A shared playlist' }));
    expect(screen.getByText('0 dots left')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Add a dot to Snacks from each team' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Take a dot from A shared playlist' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a dot to Snacks from each team' }));
    fireEvent.click(send);
    expect(onSend).toHaveBeenCalledWith({ a: 2, c: 1 });
    expect(root.dataset.state).toBe('sent');
    expect(screen.queryByRole('button', { name: 'Send my dots' })).toBeNull();
  });

  it('ranks the room with the viewer’s dots and focuses the result', () => {
    const animate = vi.fn();
    (HTMLElement.prototype as { animate?: unknown }).animate = animate;
    const { container } = render(
      <DotVote question="Q" ideas={IDEAS} ballots={{ ann: { b: 3 }, bo: { b: 1, c: 2 } }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a dot to Longer breaks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send my dots' }));
    const result = container.querySelector('[data-slot="dot-vote-result"]') as HTMLElement;
    expect(result.textContent).toBe('Sent. 3 people have voted so far.');
    expect(document.activeElement).toBe(result);
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-slot="dot-vote-row"]'));
    expect(rows.map((r) => r.dataset.flipId)).toEqual(['b', 'c', 'a']);
    expect(rows[2]?.dataset.mine).toBe('');
    expect(rows[2]?.textContent).toContain('Yours: 1');
    expect(rows[0]?.textContent).toContain('4 dots');
    const bars = animate.mock.calls.filter(([k]) => JSON.stringify(k).includes('scaleX(0)'));
    expect(bars).toHaveLength(3);
  });

  it('restores a sent ballot without moving focus or animating, and counts it once', () => {
    reduced.value = true;
    const animate = vi.fn();
    (HTMLElement.prototype as { animate?: unknown }).animate = animate;
    const { container } = render(
      <DotVote
        question="Q"
        ideas={IDEAS}
        value={{ a: 1 }}
        ballots={{ me: { a: 1 }, ann: { a: 1 } }}
        ballotsIncludeOwn
        labels={{ result: (v) => `${v} voted` }}
      />,
    );
    expect(container.querySelector('[data-slot="dot-vote-result"]')?.textContent).toBe('2 voted');
    expect(document.activeElement).toBe(document.body);
    expect(container.querySelector('[data-slot="dot-vote-row"]')?.textContent).toContain('2 dots');
    expect(animate).not.toHaveBeenCalled();
  });

  it('says one person in the singular, and skips bar motion when reduced', () => {
    reduced.value = true;
    const animate = vi.fn();
    (HTMLElement.prototype as { animate?: unknown }).animate = animate;
    const { container } = render(<DotVote question="Q" ideas={IDEAS} defaultValue={null} dots={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a dot to Longer breaks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send my dots' }));
    expect(container.querySelector('[data-slot="dot-vote-result"]')?.textContent).toBe(
      'Sent. 1 person has voted so far.',
    );
    expect(container.querySelector('[data-slot="dot-vote-row"]')?.textContent).toContain('1 dot');
    expect(animate).not.toHaveBeenCalled();
  });
});
