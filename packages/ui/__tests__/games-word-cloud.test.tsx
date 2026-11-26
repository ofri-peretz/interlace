/**
 * Word cloud: the text checks a phone and a server share, the cloud a room
 * builds, and the two components.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkText, foldText, isBlocked, tidyText, visibleLength, wordsOf } from '../src/games/text-safety-model.js';
import { buildCloud, centerOut, cloudOrder } from '../src/games/word-cloud-model.js';
import { MIN_VIEWPORT, WordCloud, WordEntry } from '../src/games/word-cloud.js';

afterEach(cleanup);

describe('text-safety-model', () => {
  it('tidies and counts what a reader sees', () => {
    expect(tidyText('  two   words \n')).toBe('two words');
    expect(visibleLength('café')).toBe(4);
    expect(visibleLength('👍🏽')).toBe(1);
    expect(wordsOf('  a b  c ')).toEqual(['a', 'b', 'c']);
    expect(wordsOf('   ')).toEqual([]);
  });

  it('counts code points where Intl.Segmenter is missing', () => {
    const intl = Intl as { Segmenter?: typeof Intl.Segmenter };
    const real = intl.Segmenter;
    delete intl.Segmenter;
    try {
      expect(visibleLength('café')).toBe(4);
    } finally {
      intl.Segmenter = real;
    }
  });

  it('folds case, accents, marks, swaps and spelled-out letters', () => {
    expect(foldText('CAFÉ')).toBe('cafe');
    expect(foldText('b4d')).toBe('bad');
    expect(foldText('b a d')).toBe('bad');
    expect(foldText('b.a.d!')).toBe('bad');
    expect(foldText('שָׁלוֹם')).toBe('שלום');
    // Two single letters are not a spelled-out word.
    expect(foldText('a b')).toBe('a b');
  });

  it('refuses in order and says why', () => {
    expect(checkText('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(checkText('x'.repeat(26), { maxLength: 25 })).toEqual({ ok: false, reason: 'too-long' });
    expect(checkText('one two three', { maxWords: 2 })).toEqual({ ok: false, reason: 'too-many-words' });
    expect(checkText('see https://example.com')).toEqual({ ok: false, reason: 'link' });
    expect(checkText('example.com')).toEqual({ ok: false, reason: 'link' });
    expect(checkText('mail me a@b.co')).toEqual({ ok: false, reason: 'contact' });
    expect(checkText('a@b')).toEqual({ ok: true, text: 'a@b' });
    expect(checkText('me@x..y').ok).toBe(true);
    // A long run with no address stays fast (no quadratic backtracking).
    const t0 = performance.now();
    expect(checkText('!'.repeat(50_000), { maxLength: 100_000 }).ok).toBe(true);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(checkText('call 555 123 4567')).toEqual({ ok: false, reason: 'contact' });
    expect(checkText('+1 (555) 123-4567')).toEqual({ ok: false, reason: 'contact' });
    expect(checkText('123 abc 4567').ok).toBe(true);
    // Digits split by long separator runs stay fast too.
    const t1 = performance.now();
    expect(checkText(`${'1      '.repeat(6)}!`.repeat(2_000), { maxLength: 100_000 }).ok).toBe(true);
    expect(performance.now() - t1).toBeLessThan(500);
    expect(checkText('  Good   food ')).toEqual({ ok: true, text: 'Good food' });
    expect(checkText('see example.com', { allowLinks: true })).toEqual({ ok: true, text: 'see example.com' });
    expect(checkText('a@b.co', { allowContact: true, allowLinks: true }).ok).toBe(true);
    // Numbers in a sentence are not a phone number.
    expect(checkText('about 1,000 people in 2020').ok).toBe(true);
  });

  it('blocks whole words only, through the usual dodges', () => {
    const list = ['bad', 'two words'];
    expect(isBlocked('so BAD', list)).toBe(true);
    expect(isBlocked('b4d', list)).toBe(true);
    expect(isBlocked('b a d', list)).toBe(true);
    expect(isBlocked('ba d', list)).toBe(true);
    expect(isBlocked('badminton', list)).toBe(false);
    expect(isBlocked('Two  Words here', list)).toBe(true);
    expect(isBlocked('anything', ['', '  '])).toBe(false);
    expect(checkText('b-a-d', { blocklist: list })).toEqual({ ok: false, reason: 'blocked' });
    expect(checkText('badminton', { blocklist: list }).ok).toBe(true);
  });
});

describe('word-cloud-model', () => {
  it('groups by folded form, shows the common spelling and ranks', () => {
    const cloud = buildCloud(['coffee', 'Coffee', 'Coffee', 'tea', 'Café', 'cafe', '  ', 'tea']);
    expect(cloud.total).toBe(7);
    expect(cloud.distinct).toBe(3);
    expect(cloud.words.map((w) => [w.text, w.count, w.rank])).toEqual([
      ['Coffee', 3, 0],
      ['tea', 2, 1],
      ['Café', 2, 2],
    ]);
    expect(cloud.words[0]?.share).toBeCloseTo(3 / 7);
  });

  it('sizes on a square-root scale between the kept words', () => {
    const entries = [...Array(16).fill('a'), ...Array(4).fill('b'), 'c'];
    const steps = buildCloud(entries).words.map((w) => w.step);
    expect(steps[0]).toBe(5);
    expect(steps[2]).toBe(1);
    expect(steps[1]).toBe(2);
    // One word, or all equal: the top step.
    expect(buildCloud(['x', 'y']).words.map((w) => w.step)).toEqual([5, 5]);
    expect(buildCloud(['x']).words[0]?.step).toBe(5);
    expect(buildCloud(['a', 'a', 'b'], { steps: 3 }).words.map((w) => w.step)).toEqual([3, 1]);
  });

  it('keeps the most-sent, drops stop words and marks the viewer', () => {
    const cloud = buildCloud(
      [{ text: 'the' }, { text: 'sun', by: 'me' }, { text: 'sea' }, { text: 'sea' }, { text: 'sky' }],
      { max: 2, stopwords: ['THE'], viewer: 'me' },
    );
    expect(cloud.words.map((w) => w.text)).toEqual(['sea', 'sun']);
    expect(cloud.words.map((w) => w.mine)).toEqual([false, true]);
    expect(cloud.total).toBe(4);
    expect(cloud.distinct).toBe(3);
    expect(buildCloud(['a'], { max: 0 }).words).toEqual([]);
  });

  it('places the biggest words in the middle', () => {
    expect(centerOut(5)).toEqual([2, 3, 1, 4, 0]);
    expect(centerOut(4)).toEqual([1, 2, 0, 3]);
    expect(centerOut(1)).toEqual([0]);
    expect(centerOut(0)).toEqual([]);
    for (const n of [2, 3, 7, 10]) expect([...centerOut(n)].sort((a, b) => a - b)).toEqual([...Array(n).keys()]);
  });

  it('frames the biggest words with the small ones above and below', () => {
    const places = cloudOrder(7);
    expect(places.map((p) => p.band)).toEqual(['middle', 'middle', 'middle', 'above', 'below', 'above', 'below']);
    expect(places.slice(0, 3).map((p) => p.order)).toEqual([1001, 1002, 1000]);
    expect(places.filter((p) => p.band === 'above').map((p) => p.order)).toEqual([0, 1]);
    expect(places.filter((p) => p.band === 'below').map((p) => p.order)).toEqual([2000, 2001]);
    expect(cloudOrder(30).filter((p) => p.band === 'middle')).toHaveLength(7);
    expect(cloudOrder(2, 5).map((p) => p.band)).toEqual(['middle', 'middle']);
    expect(cloudOrder(1)).toEqual([{ band: 'middle', order: 1000 }]);
    expect(cloudOrder(-1)).toEqual([]);
  });
});

describe('WordCloud', () => {
  it('reads in rank order with counts and marks the viewer', () => {
    const { container } = render(
      <WordCloud entries={[{ text: 'sea' }, { text: 'sea' }, { text: 'sun', by: 'me' }]} viewer="me" locale="en-US" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    const items = screen.getAllByRole('listitem').filter((li) => li.dataset.slot === 'word-cloud-word');
    expect(items.map((li) => li.textContent)).toEqual(['seasea, 2', 'sunsun, 1, yours']);
    expect(items[0]?.hasAttribute('data-top')).toBe(true);
    expect(items[1]?.hasAttribute('data-mine')).toBe(true);
    expect(items[0]?.style.order).toBe('1000');
    expect(screen.getByText('3 words from the room')).toBeTruthy();
  });

  it('says so while empty and takes a prebuilt cloud', () => {
    const { rerender } = render(<WordCloud entries={[]} />);
    expect(screen.getByText('Words appear here as people send them.')).toBeTruthy();
    rerender(<WordCloud words={buildCloud(['x', 'x']).words} labels={{ status: (n) => `${n} in` }} />);
    expect(screen.getByText('2 in')).toBeTruthy();
  });
});

describe('WordEntry', () => {
  it('sends checked words, refuses with a reason and stops at the limit', () => {
    const onWord = vi.fn();
    render(<WordEntry maxWords={2} blocklist={['bad']} onWord={onWord} />);
    const field = screen.getByLabelText('Your word') as HTMLInputElement;
    const send = () => fireEvent.submit(field.closest('form') as HTMLFormElement);

    fireEvent.change(field, { target: { value: 'b a d' } });
    send();
    expect(screen.getByText('That word cannot be shown here. Try another.')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(onWord).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: '  Sea ' } });
    expect(field.hasAttribute('aria-invalid')).toBe(false);
    send();
    expect(onWord).toHaveBeenLastCalledWith('Sea');
    expect(field.value).toBe('');
    expect(screen.getByText('You can send 1 more.')).toBeTruthy();

    fireEvent.change(field, { target: { value: 'sea' } });
    send();
    expect(screen.getByText('You already sent that one.')).toBeTruthy();

    fireEvent.change(field, { target: { value: 'Sun' } });
    send();
    expect(onWord).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Thanks. Your words are on the screen.')).toBeTruthy();
    expect(field.disabled).toBe(true);
    expect(screen.getByRole('list', { name: 'Your words' }).textContent).toBe('SeaSun');
    send();
    expect(onWord).toHaveBeenCalledTimes(2);
  });

  it('follows a controlled list and a closed round', () => {
    const { container } = render(<WordEntry sent={['a']} disabled />);
    expect(container.querySelector('[data-slot="word-entry"]')?.getAttribute('data-state')).toBe('closed');
    expect((screen.getByLabelText('Your word') as HTMLInputElement).disabled).toBe(true);
  });
});
