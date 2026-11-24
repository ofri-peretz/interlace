/**
 * Share text and card; leaderboard ranking and table.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { shareMarks, shareText } from '../src/games/share-model.js';
import { ShareCard } from '../src/games/share-card.js';
import { buildBoard, rankEntries } from '../src/games/leaderboard-model.js';
import { Leaderboard } from '../src/games/leaderboard.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('share-model', () => {
  it('builds marks and the full text without answers', () => {
    expect(shareMarks(['close', 'near', 'exact', 'oops'])).toBe('🟩🟨🎯⬜');
    expect(shareMarks(['a'], { a: 'A' }, '.')).toBe('A');
    expect(
      shareText({ title: 'Game', number: 42, results: ['close', 'far'], score: 120, maxScore: 200, streak: 6, url: 'https://example.com' }),
    ).toBe('Game No. 42\n🟩⬜ 120/200\n🔥 6\nhttps://example.com');
    expect(shareText({ title: 'Game', results: ['right'], score: 3, streak: 0 })).toBe('Game\n🟩 3');
    expect(shareText({ title: 'G', number: 1, results: [], numberLabel: (n) => `#${n}`, streak: 2, streakSymbol: '+' })).toBe(
      'G #1\n\n+ 2',
    );
  });
});

describe('ShareCard', () => {
  const base = { title: 'Game', number: 42, results: ['close', 'near', 'exact'], score: 240, maxScore: 300, streak: 6 };

  it('copies the text and says so; marks are read as words', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const onShare = vi.fn();
    const { container } = render(<ShareCard {...base} onShare={onShare} locale="en-US" />);
    expect(container.querySelector('[data-slot="share-card-marks"]')!.textContent).toContain(
      'Round 1: close. Round 2: not far. Round 3: spot on.',
    );
    expect(screen.getByText(/240 of 300 points/)).toBeTruthy();
    expect(screen.getByText(/6-day streak/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy result' })));
    expect(writeText).toHaveBeenCalledWith('Game No. 42\n🟩🟨🎯 240/300\n🔥 6');
    expect(screen.getByText('Copied.')).toBeTruthy();
    expect(onShare).toHaveBeenCalledWith('copy');
  });

  it('falls back to a selected field when the clipboard is refused', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    const onShare = vi.fn();
    const { container } = render(<ShareCard {...base} score={undefined} streak={undefined} onShare={onShare} />);
    expect(container.querySelector('[data-slot="share-card-score"]')).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy result' })));
    expect((container.querySelector('[data-slot="share-card-text"]') as HTMLTextAreaElement).value).toContain('Game No. 42');
    expect(screen.getByText('Select the text and copy it.')).toBeTruthy();
    expect(onShare).toHaveBeenCalledWith('manual');
  });

  it('opens the share sheet where there is one, and copies if it fails', async () => {
    const share = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AbortError' })).mockRejectedValueOnce(new Error('denied'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    const onShare = vi.fn();
    render(
      <ShareCard
        title="Game"
        results={['right', 'wrong']}
        score={1}
        onShare={onShare}
        bandLabels={{ wrong: 'missed' }}
        labels={{ share: 'Send', copy: 'Copy', round: (i, b) => `${i}=${b}`, score: (s) => `${s} pts`, streak: (n) => `${n}d` }}
        streak={3}
      />,
    );
    expect(screen.getByText(/1=right 2=missed/)).toBeTruthy();
    expect(screen.getByText(/1 pts/)).toBeTruthy();
    const send = screen.getByRole('button', { name: 'Send' });
    await act(async () => fireEvent.click(send));
    expect(onShare).toHaveBeenLastCalledWith('share');
    await act(async () => fireEvent.click(send));
    expect(writeText).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(send));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenLastCalledWith('copy');
  });
});

const ENTRIES = [
  { id: 'a', name: 'Avery', score: 90 },
  { id: 'b', name: 'Blake', score: 120 },
  { id: 'c', name: 'Casey', score: 90 },
  { id: 'd', name: 'Drew', score: 60 },
  { id: 'e', name: 'Emery', score: 30 },
];

describe('leaderboard-model', () => {
  it('ranks with shared ranks for ties', () => {
    const r = rankEntries(ENTRIES);
    expect(r.map((e) => `${e.rank}${e.tied ? '=' : ''}${e.name}`)).toEqual(['1Blake', '2=Avery', '2=Casey', '4Drew', '5Emery']);
    expect(rankEntries(ENTRIES, 'asc')[0]!.name).toBe('Emery');
  });

  it('breaks ties on the tiebreak, lower first', () => {
    const r = rankEntries([
      { id: 'x', name: 'X', score: 5, tiebreak: 30 },
      { id: 'y', name: 'Y', score: 5, tiebreak: 10 },
      { id: 'z', name: 'Z', score: 5 },
    ]);
    expect(r.map((e) => [e.name, e.rank])).toEqual([['Y', 1], ['X', 2], ['Z', 3]]);
  });

  it('hides small boards and keeps the viewer’s row', () => {
    expect(buildBoard(ENTRIES, { minPlayers: 6 })).toEqual({ visible: false, players: 5, top: [] });
    expect(buildBoard([], {}).visible).toBe(false);
    const b = buildBoard(ENTRIES, { limit: 2, currentId: 'e' });
    expect(b.top.map((e) => e.id)).toEqual(['b', 'a']);
    expect(b.current?.id).toBe('e');
    expect(buildBoard(ENTRIES, { limit: 2, currentId: 'b' }).current).toBeUndefined();
    expect(buildBoard(ENTRIES).top).toHaveLength(5);
  });
});

describe('Leaderboard', () => {
  it('renders a captioned table with the viewer marked in words', () => {
    const { container } = render(
      <Leaderboard entries={ENTRIES} caption="This week" limit={3} currentId="e" locale="en-US" />,
    );
    const table = screen.getByRole('table', { name: 'This week' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(['1Blake120', '=2Avery90', '=2Casey90', '5EmeryYou30']);
    expect(rows[3]!.hasAttribute('data-current')).toBe(true);
    expect(within(table).getByRole('rowheader', { name: /Emery/ })).toBeTruthy();
    expect(container.querySelector('caption')!.className).toContain('sr-only');
  });

  it('shows the caption and formats scores', () => {
    const { container } = render(
      <Leaderboard
        entries={[{ id: 'a', name: 'A', score: 1234.5 }]}
        caption="Board"
        showCaption
        currentId="a"
        format={{ maximumFractionDigits: 0 }}
        locale="en-US"
        labels={{ you: 'Me', rank: 'R', name: 'N', score: 'S' }}
      />,
    );
    expect(screen.getByText('1,235')).toBeTruthy();
    expect(screen.getByText('Me')).toBeTruthy();
    expect(container.querySelector('caption')!.className).not.toContain('sr-only');
  });

  it('holds the board back below the minimum', () => {
    const { container, rerender } = render(<Leaderboard entries={ENTRIES.slice(0, 3)} caption="Board" minPlayers={5} />);
    expect(container.querySelector('[data-slot="leaderboard"]')!.getAttribute('data-state')).toBe('hidden');
    expect(screen.getByText('The board shows once 5 people have played. 3 so far.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    rerender(<Leaderboard entries={[]} caption="Board" showCaption labels={{ hidden: (m, p) => `${p}/${m}` }} />);
    expect(screen.getByText('0/1')).toBeTruthy();
    expect(screen.getByText('Board')).toBeTruthy();
  });
});
