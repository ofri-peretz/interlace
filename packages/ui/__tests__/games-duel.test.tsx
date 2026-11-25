/**
 * Duel by link: the challenge in the link, the comparison a server can
 * repeat, and the three screens.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  compareDuel,
  decodeDuel,
  DUEL_LIMITS,
  duelHref,
  encodeDuel,
  type DuelChallenge,
} from '../src/games/duel-model.js';
import { DuelCard, DuelCompare, DuelInvite } from '../src/games/duel.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const CHALLENGE: DuelChallenge = {
  v: 1,
  game: 'closer',
  seed: '2026-11-24',
  from: { name: 'Avery', rounds: [300, 120, 0] },
  at: 1_700_000_000_000,
};

const b64 = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('duel-model: the link', () => {
  it('round-trips a challenge, UTF-8 names and a signature included', () => {
    expect(decodeDuel(encodeDuel(CHALLENGE))).toEqual(CHALLENGE);
    const intl = { ...CHALLENGE, from: { name: 'Zoë 🎯 נועה', rounds: [1] }, sig: 'abc' };
    const token = encodeDuel(intl);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeDuel(token)).toEqual(intl);
  });

  it('round-trips every padding length', () => {
    for (const name of ['A', 'AB', 'ABC', 'ABCD']) {
      const c = { ...CHALLENGE, from: { name, rounds: [] } };
      expect(decodeDuel(encodeDuel(c))).toEqual(c);
    }
  });

  it('matches standard base64url', () => {
    const c = { v: 1, game: 'g', seed: 's', from: { name: 'n', rounds: [1] } } as const;
    expect(encodeDuel(c)).toBe(b64(JSON.stringify(c)));
  });

  it('cleans to the limits and drops unknown fields', () => {
    const long = {
      ...CHALLENGE,
      game: ' x'.padEnd(100, 'g'),
      seed: 's'.repeat(200),
      from: { name: 'N'.repeat(60), rounds: [1] },
      sig: 'z'.repeat(500),
      extra: true,
    };
    const back = decodeDuel(b64(JSON.stringify(long)))!;
    expect(back.game).toHaveLength(DUEL_LIMITS.game);
    expect(back.seed).toHaveLength(DUEL_LIMITS.seed);
    expect(back.from.name).toHaveLength(DUEL_LIMITS.name);
    expect(back.sig).toHaveLength(DUEL_LIMITS.sig);
    expect(back).not.toHaveProperty('extra');
    expect(decodeDuel(b64(JSON.stringify({ ...CHALLENGE, at: 'soon', sig: '' })))).not.toHaveProperty('at');
  });

  it('returns null for anything malformed', () => {
    const bad = [
      null,
      undefined,
      '',
      '!!!',
      'abcde', // a length no base64 has
      'x'.repeat(DUEL_LIMITS.token + 4),
      b64('not json'),
      b64('null'),
      b64('"text"'),
      b64(JSON.stringify({ ...CHALLENGE, v: 2 })),
      b64(JSON.stringify({ ...CHALLENGE, game: 3 })),
      b64(JSON.stringify({ ...CHALLENGE, seed: null })),
      b64(JSON.stringify({ ...CHALLENGE, from: null })),
      b64(JSON.stringify({ ...CHALLENGE, from: 'Avery' })),
      b64(JSON.stringify({ ...CHALLENGE, from: { name: 5, rounds: [] } })),
      b64(JSON.stringify({ ...CHALLENGE, from: { name: 'A', rounds: 'many' } })),
      b64(JSON.stringify({ ...CHALLENGE, from: { name: 'A', rounds: ['1'] } })),
      b64(JSON.stringify({ ...CHALLENGE, from: { name: 'A', rounds: Array(51).fill(1) } })),
      b64(JSON.stringify({ ...CHALLENGE, from: { name: '   ', rounds: [] } })),
      b64(JSON.stringify({ ...CHALLENGE, game: '  ' })),
      '_w', // a lone 0xff byte: not UTF-8
    ];
    for (const token of bad) expect(decodeDuel(token)).toBeNull();
    expect(() => encodeDuel({ ...CHALLENGE, game: '' })).toThrow(TypeError);
  });

  it('puts the token in a link, keeping its query and hash', () => {
    expect(duelHref('https://example.com/play', 'T')).toBe('https://example.com/play?duel=T');
    expect(duelHref('https://example.com/play?day=3#top', 'T', 'c h')).toBe(
      'https://example.com/play?day=3&c%20h=T#top',
    );
    // A token from another encoder can carry +, / and =; the link must keep them.
    const href = duelHref('https://example.com/play', 'a+b/c=');
    expect(href).toBe('https://example.com/play?duel=a%2Bb%2Fc%3D');
    expect(new URL(href).searchParams.get('duel')).toBe('a+b/c=');
  });
});

describe('duel-model: compare', () => {
  it('takes rounds and the total by the higher score', () => {
    const r = compareDuel({ rounds: [300, 120, 50] }, { rounds: [200, 120, 100] });
    expect(r.rounds.map((x) => x.winner)).toEqual(['a', 'tie', 'b']);
    expect(r).toMatchObject({ totals: { a: 470, b: 420 }, won: { a: 1, b: 1 }, winner: 'a', margin: 50 });
  });

  it('can prefer fewer, and gives a missing round to the side that played it', () => {
    const r = compareDuel({ rounds: [10] }, { rounds: [12, 5] }, { order: 'asc' });
    expect(r.rounds).toEqual([
      { round: 1, a: 10, b: 12, winner: 'a' },
      { round: 2, a: null, b: 5, winner: 'b' },
    ]);
    expect(r.winner).toBe('a');
    expect(compareDuel({ rounds: [1, 2] }, { rounds: [3] }).rounds[1]!.winner).toBe('a');
    expect(compareDuel({ rounds: [] }, { rounds: [] })).toMatchObject({ winner: 'tie', margin: 0, rounds: [] });
  });
});

describe('DuelInvite', () => {
  it('copies the message and link, and says so', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const onShare = vi.fn();
    const { container } = render(
      <DuelInvite href="https://example.com/?duel=T" message="Beat 420?" onShare={onShare} />,
    );
    expect(screen.queryByRole('button', { name: 'Send a challenge' })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })));
    expect(writeText).toHaveBeenCalledWith('Beat 420? https://example.com/?duel=T');
    act(() => vi.advanceTimersByTime(50));
    expect(container.querySelector('[data-slot="duel-invite-status"]')?.textContent).toBe('Link copied.');
    expect(onShare).toHaveBeenCalledWith('copy');
  });

  it('shows the link to copy by hand when the clipboard fails', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    render(<DuelInvite href="https://example.com/?duel=T" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })));
    const field = screen.getByRole('textbox', { name: 'Challenge link' }) as HTMLInputElement;
    expect(field.value).toBe('https://example.com/?duel=T');
    fireEvent.focus(field);
  });

  it('uses the share sheet where there is one, falling back to copy on errors', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    const onShare = vi.fn();
    render(<DuelInvite href="https://example.com/?duel=T" onShare={onShare} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send a challenge' })));
    expect(share).toHaveBeenCalledWith({ url: 'https://example.com/?duel=T' });
    expect(onShare).toHaveBeenCalledWith('share');

    share.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AbortError' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send a challenge' })));
    expect(writeText).not.toHaveBeenCalled();
    share.mockRejectedValueOnce(new Error('denied'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send a challenge' })));
    expect(writeText).toHaveBeenCalledWith('https://example.com/?duel=T');
    cleanup();
    render(<DuelInvite href="h" message="m" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send a challenge' })));
    expect(share).toHaveBeenLastCalledWith({ text: 'm', url: 'h' });
  });
});

describe('DuelCard', () => {
  it('names the challenger and the score to beat', () => {
    const onAccept = vi.fn();
    render(
      <DuelCard
        name="Avery"
        score={4200}
        onAccept={onAccept}
        description="Three numbers, two minutes."
        locale="en-US"
      />,
    );
    expect(screen.getByRole('region', { name: 'Avery challenged you' })).toBeTruthy();
    expect(screen.getByText('4,200 points to beat.')).toBeTruthy();
    expect(screen.getByText('Three numbers, two minutes.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Play the same game' }));
    expect(onAccept).toHaveBeenCalled();
  });

  it('can leave out the button', () => {
    render(<DuelCard name="A" score={1} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('DuelCompare', () => {
  const a = { name: 'Avery', rounds: [300, 120, 50] };
  const b = { name: 'Blake', rounds: [200, 120, 100] };

  it('says who won, by how much, and who took each round', () => {
    const { container } = render(<DuelCompare a={a} b={b} animate={false} locale="en-US" />);
    expect(screen.getByText('Avery won by 50 points.')).toBeTruthy();
    expect(container.querySelector('[data-slot="duel-compare"]')?.getAttribute('data-winner')).toBe('a');
    expect(container.querySelector('[data-side="a"]')?.textContent).toBe('AveryWon4701 round won');
    expect(container.querySelector('[data-side="b"]')?.textContent).toBe('Blake4201 round won');
    const table = screen.getByRole('table', { name: 'Round by round' });
    const rows = table.querySelectorAll('tbody tr');
    expect(rows[0]?.textContent).toBe('300won the roundRound 1200');
    expect(rows[1]?.getAttribute('data-winner')).toBe('tie');
  });

  it('speaks to the viewer, handles ties, missing rounds and its own words', () => {
    render(<DuelCompare a={a} b={{ ...b, rounds: [300, 120, 50] }} you="b" animate={false} />);
    expect(screen.getByText('A tie, at 470 points each.')).toBeTruthy();
    cleanup();
    render(
      <DuelCompare
        a={{ name: 'Avery', rounds: [1] }}
        b={{ name: 'Blake', rounds: [2, 2] }}
        you="b"
        animate={false}
        labels={{ missing: '—', roundsWon: (n) => `${n}W` }}
      />,
    );
    expect(screen.getByText('You won by 3 points.')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('2W')).toBeTruthy();
    cleanup();
    const { container } = render(<DuelCompare a={{ name: 'A', rounds: [] }} b={{ name: 'B', rounds: [] }} />);
    expect(container.querySelector('table')).toBeNull();
  });

  it('grows the bars from the middle and celebrates the viewer’s win', () => {
    vi.useFakeTimers();
    const seen: { slot: string | null; delay: number }[] = [];
    const cancel = vi.fn();
    HTMLElement.prototype.animate = function (this: HTMLElement, _k: Keyframe[], o?: KeyframeAnimationOptions) {
      seen.push({ slot: this.getAttribute('data-slot'), delay: Number(o?.delay ?? 0) });
      return { cancel } as unknown as Animation;
    } as HTMLElement['animate'];
    const { unmount } = render(<DuelCompare a={a} b={b} you="a" />);
    const bars = seen.filter((s) => s.slot === 'duel-compare-bar');
    expect(bars.map((s) => s.delay)).toEqual([0, 0, 40, 40, 80, 80]);
    act(() => vi.advanceTimersByTime(520));
    expect(seen.some((s) => s.slot === 'celebrate-ring')).toBe(true);
    unmount();
    expect(cancel).toHaveBeenCalled();
    // @ts-expect-error cleanup of the stub
    delete HTMLElement.prototype.animate;
  });
});
