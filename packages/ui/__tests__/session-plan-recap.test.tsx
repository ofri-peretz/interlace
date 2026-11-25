/**
 * Building a session from modules, and the per-person recap after it.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addToPlan,
  canMove,
  cleanPlan,
  fitsPlan,
  movePlan,
  removeFromPlan,
  summarizePlan,
} from '../src/patterns/session-plan-model.js';
import { MAX_RECAP_TOKEN, decodeRecap, encodeRecap, validRecap } from '../src/patterns/recap-model.js';
import { SessionComposer, MIN_VIEWPORT as COMPOSER_MIN } from '../src/patterns/session-composer.js';
import { Recap } from '../src/patterns/recap.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const MODULES = [
  { id: 'open', title: 'Welcome', minutes: 10 },
  { id: 'a', title: 'Metrics', minutes: 30, summary: 'Counters and histograms' },
  { id: 'b', title: 'Logs', minutes: 20 },
  { id: 'c', title: 'Traces', minutes: 40 },
  { id: 'close', title: 'Questions', minutes: 10 },
];
const REQ = { required: ['open', 'close'] };

describe('session-plan-model', () => {
  it('cleans a plan: known ids, no repeats, required ones put back in place', () => {
    expect(cleanPlan(MODULES, ['b', 'x', 'b', 'a'])).toEqual(['b', 'a']);
    expect(cleanPlan(MODULES, ['b'], REQ)).toEqual(['open', 'b', 'close']);
    expect(cleanPlan(MODULES, ['close', 'a'], REQ)).toEqual(['open', 'close', 'a']);
    expect(cleanPlan(MODULES, [], { required: ['nope'] })).toEqual([]);
  });

  it('sums minutes against the limit', () => {
    expect(summarizePlan(MODULES, ['a', 'b'], { maxMinutes: 60 })).toEqual({ ids: ['a', 'b'], minutes: 50, remaining: 10, over: 0 });
    expect(summarizePlan(MODULES, ['a', 'c'], { maxMinutes: 60 })).toMatchObject({ minutes: 70, remaining: 0, over: 10 });
    expect(summarizePlan(MODULES, ['a'], { maxMinutes: 0 })).toMatchObject({ remaining: null, over: 0 });
    expect(summarizePlan([{ id: 'z', minutes: Number.NaN }], ['z']).minutes).toBe(0);
  });

  it('says whether one more fits', () => {
    expect(fitsPlan(MODULES, ['a'], 'b', { maxMinutes: 50 })).toBe(true);
    expect(fitsPlan(MODULES, ['a'], 'c', { maxMinutes: 50 })).toBe(false);
    expect(fitsPlan(MODULES, ['a'], 'a')).toBe(false);
    expect(fitsPlan(MODULES, ['a'], 'nope')).toBe(false);
    expect(fitsPlan(MODULES, ['a'], 'c')).toBe(true);
  });

  it('adds after the host’s last pick, keeping a required close last', () => {
    expect(addToPlan(MODULES, ['open', 'a', 'close'], 'b', REQ)).toEqual(['open', 'a', 'b', 'close']);
    expect(addToPlan(MODULES, [], 'b', REQ)).toEqual(['open', 'b', 'close']);
    expect(addToPlan(MODULES, [], 'b', { required: ['open'] })).toEqual(['open', 'b']);
    expect(addToPlan(MODULES, ['a'], 'a')).toEqual(['a']);
    expect(addToPlan(MODULES, ['a'], 'nope')).toEqual(['a']);
    expect(addToPlan(MODULES, ['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes anything but a required module', () => {
    expect(removeFromPlan(MODULES, ['open', 'a', 'close'], 'a', REQ)).toEqual(['open', 'close']);
    expect(removeFromPlan(MODULES, ['open', 'a', 'close'], 'open', REQ)).toEqual(['open', 'a', 'close']);
    expect(removeFromPlan(MODULES, ['a', 'b'], 'a')).toEqual(['b']);
  });

  it('moves within the free modules, never past a required one', () => {
    const plan = ['open', 'a', 'b', 'c', 'close'];
    expect(movePlan(MODULES, plan, 'b', -1, REQ)).toEqual(['open', 'b', 'a', 'c', 'close']);
    expect(movePlan(MODULES, plan, 'a', -1, REQ)).toEqual(plan);
    expect(movePlan(MODULES, plan, 'c', 1, REQ)).toEqual(plan);
    expect(movePlan(MODULES, plan, 'a', 5, REQ)).toEqual(['open', 'b', 'c', 'a', 'close']);
    expect(movePlan(MODULES, plan, 'open', 1, REQ)).toEqual(plan);
    expect(movePlan(MODULES, plan, 'nope', 1, REQ)).toEqual(plan);
    expect(movePlan(MODULES, ['a', 'b'], 'b', -9)).toEqual(['b', 'a']);
    expect(canMove(MODULES, plan, 'a', -1, REQ)).toBe(false);
    expect(canMove(MODULES, plan, 'a', 1, REQ)).toBe(true);
  });
});

describe('recap-model', () => {
  const data = { session: 'signals-2026-11', at: 1_790_000_000_000, commitment: 'Add a p95 to one dashboard', interests: ['traces', 'traces', 'slo'], points: 4200 };

  it('round-trips a recap through a link-safe token', () => {
    const token = encodeRecap(data)!;
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeRecap(token)).toEqual({ ...data, interests: ['traces', 'slo'] });
    expect(decodeRecap(encodeRecap({ session: 'שלום · مرحبا' })!)).toEqual({ session: 'שלום · مرحبا' });
  });

  it('keeps only fields that pass, and refuses what cannot be a recap', () => {
    expect(validRecap({ session: 's', at: -1, commitment: '', interests: ['a', 3], points: Number.NaN })).toEqual({ session: 's' });
    expect(validRecap({ session: 's', at: 0, points: 0 })).toEqual({ session: 's', points: 0 });
    expect(validRecap({ session: '' })).toBeNull();
    expect(validRecap(null)).toBeNull();
    expect(validRecap('s')).toBeNull();
    expect(encodeRecap({ session: '' })).toBeNull();
    expect(encodeRecap({ session: 's', commitment: 'x'.repeat(280), interests: Array.from({ length: 50 }, (_, i) => `topic-${i}-${'y'.repeat(60)}`) })).toBeNull();
  });

  it('decodes junk, other versions and tampering to null', () => {
    const b64 = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeRecap(undefined)).toBeNull();
    expect(decodeRecap('')).toBeNull();
    expect(decodeRecap('not a token!')).toBeNull();
    expect(decodeRecap('x'.repeat(MAX_RECAP_TOKEN + 1))).toBeNull();
    expect(decodeRecap('A')).toBeNull();
    expect(decodeRecap(b64('{"v":2,"session":"s"}'))).toBeNull();
    expect(decodeRecap(b64('null'))).toBeNull();
    expect(decodeRecap(b64('{oops'))).toBeNull();
    expect(decodeRecap(b64('\xff\xfe'))).toBeNull();
    expect(decodeRecap(b64('{"v":1}'))).toBeNull();
  });
});

describe('SessionComposer', () => {
  it('adds, announces, and keeps the time against the limit', () => {
    const onValueChange = vi.fn();
    render(
      <SessionComposer
        modules={MODULES}
        required={['open', 'close']}
        seen={['b']}
        maxMinutes={90}
        onValueChange={onValueChange}
        footer={<button type="button">Request this session</button>}
        locale="en-US"
      />,
    );
    const root = document.querySelector('[data-slot="session-composer"]')!;
    expect(root.getAttribute('data-min-viewport')).toBe(String(COMPOSER_MIN));
    expect(screen.getByText('Seen before')).toBeTruthy();
    expect(screen.getAllByText('Always included')).toHaveLength(2);
    expect(screen.getAllByText('10 min · Always included')).toHaveLength(2);
    expect(screen.getByText('20 min of 90 min')).toBeTruthy();
    fireEvent.click(within(screen.getByText('Metrics').closest('li')!).getByRole('button', { name: 'Add' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['open', 'a', 'close']);
    expect(screen.getByText('Added Metrics. 50 min of 90 min.')).toBeTruthy();
    // Traces needs 40, 40 left: fits. Then nothing else fits.
    fireEvent.click(within(screen.getByText('Traces').closest('li')!).getByRole('button', { name: 'Add' }));
    const logs = within(screen.getByText('Logs').closest('li')!).getByRole('button', { name: 'Add' }) as HTMLButtonElement;
    expect(logs.disabled).toBe(true);
    expect(screen.getByText('Needs 20 min; 0 min left.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request this session' })).toBeTruthy();
  });

  it('moves and removes from the plan, keeping focus on the module', () => {
    render(<SessionComposer modules={MODULES} defaultValue={['a', 'b', 'c']} labels={{ minutes: (n) => `${n}m` }} />);
    expect(screen.getByText('Session length:')).toBeTruthy();
    const down = screen.getByRole('button', { name: 'Move Metrics down' });
    down.focus();
    fireEvent.click(down);
    expect(screen.getByText('Metrics moved to 2 of 3.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move Metrics down' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Metrics down' }));
    // At the end: down is disabled, so focus lands on the first live control.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move Metrics up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Metrics up' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move Metrics up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Logs' }));
    expect(screen.getByText('Removed Logs. 70m.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove Metrics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Traces' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove Metrics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Metrics' }));
    expect(document.activeElement?.textContent).toBe('Your session');
    expect(screen.getByText('Add modules to build the session.')).toBeTruthy();
    // The catalogue toggles too.
    fireEvent.click(within(screen.getByText('Logs').closest('li')!).getByRole('button', { name: 'Add' }));
    fireEvent.click(within(screen.getAllByText('Logs')[0]!.closest('li')!).getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Removed Logs. 0m.')).toBeTruthy();
  });

  it('shows a plan that runs over, controlled, with headings and labels', () => {
    render(
      <SessionComposer
        modules={MODULES}
        value={['a', 'c']}
        maxMinutes={60}
        headingAs="h3"
        labels={{ over: (t) => `over by ${t}`, catalogue: 'Pick', plan: 'Plan', total: (t, m) => `${t}/${m}` }}
      />,
    );
    expect(document.querySelector('[data-slot="session-composer"]')!.hasAttribute('data-over')).toBe(true);
    expect(screen.getByText('over by 10 min')).toBeTruthy();
    expect(screen.getByText('70 min/60 min')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Pick', 'Plan']);
  });

  it('grows an added module in, unless motion is reduced', () => {
    const animate = vi.fn();
    const proto = HTMLElement.prototype as unknown as { animate?: unknown };
    const before = proto.animate;
    proto.animate = animate;
    try {
      render(<SessionComposer modules={MODULES} />);
      fireEvent.click(within(screen.getByText('Logs').closest('li')!).getByRole('button', { name: 'Add' }));
      expect(animate).toHaveBeenCalledTimes(1);
      cleanup();
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
      render(<SessionComposer modules={MODULES} />);
      fireEvent.click(within(screen.getByText('Logs').closest('li')!).getByRole('button', { name: 'Add' }));
      expect(animate).toHaveBeenCalledTimes(1);
    } finally {
      proto.animate = before;
    }
  });
});

describe('Recap', () => {
  it('shows only the sections it has, in reading order', () => {
    render(
      <Recap
        title="Your recap"
        meta="Tuesday, November 24"
        covered={['What a metric is', 'Reading a trace']}
        stats={[{ label: 'Points', value: '4,200' }]}
        commitment="Add a p95 to one dashboard"
        interests={['Traces']}
        next={[{ label: 'The next session', href: '/next', description: 'Thursday' }, { label: 'Slides', href: '/slides' }]}
        footer="Sent to you only."
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Your recap' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'What we covered',
      'Your session',
      'Your one thing this week',
      'You asked for more on',
      'Keep going',
    ]);
    expect(screen.getByRole('link', { name: /The next session/ }).getAttribute('href')).toBe('/next');
    expect(screen.getByText('Sent to you only.')).toBeTruthy();
  });

  it('drops empty sections and nests under an h2 title', () => {
    render(<Recap title="R" titleAs="h2" covered={[]} interests={['x']} labels={{ interests: 'More on' }} />);
    expect(screen.getAllByRole('heading').map((h) => [h.tagName, h.textContent])).toEqual([
      ['H2', 'R'],
      ['H3', 'More on'],
    ]);
    expect(document.querySelector('[data-slot="recap-covered"]')).toBeNull();
  });
});
