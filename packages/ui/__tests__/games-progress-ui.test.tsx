/**
 * Progress components: what a player sees and what assistive tech reads for
 * the goal ring, the level meter, milestones, the round summary, the
 * reminder offer, and shields on the streak.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GoalRing } from '../src/games/goal-ring.js';
import { LevelMeter } from '../src/games/level-meter.js';
import { Milestones } from '../src/games/milestones.js';
import { ReminderOffer } from '../src/games/reminder-offer.js';
import { RoundSummary } from '../src/games/round-summary.js';
import { ShareCard } from '../src/games/share-card.js';
import { Streak } from '../src/games/streak.js';

afterEach(cleanup);

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement | null;

describe('GoalRing', () => {
  it('is a meter that reads the value and the goal', () => {
    render(<GoalRing value={15} goal={20} locale="en-US" />);
    const meter = screen.getByRole('meter', { name: 'Daily goal' });
    expect(meter.getAttribute('aria-valuenow')).toBe('15');
    expect(meter.getAttribute('aria-valuemax')).toBe('20');
    expect(meter.getAttribute('aria-valuetext')).toBe('15 of 20 XP');
    expect(meter.dataset.state).toBe('progress');
    expect(slot('goal-ring-fill')!.style.strokeDashoffset).toBe('25');
  });

  it('says the goal is met and caps the value', () => {
    render(<GoalRing value={30} goal={20} unit="points" labels={{ met: 'Done.' }} />);
    const meter = screen.getByRole('meter');
    expect(meter.dataset.state).toBe('met');
    expect(meter.getAttribute('aria-valuenow')).toBe('20');
    expect(meter.getAttribute('aria-valuetext')).toBe('30 of 20 points. Done.');
    expect(slot('goal-ring-label')!.querySelector('svg')).toBeTruthy();
  });

  it('treats a missing goal as met and an empty value as zero', () => {
    render(<GoalRing value={Number.NaN} goal={0} size="lg" />);
    expect(screen.getByRole('meter').dataset.state).toBe('met');
    cleanup();
    render(<GoalRing value={0} goal={10} size="sm" />);
    expect(slot('goal-ring-fill')!.getAttribute('class')).toContain('opacity-0');
  });
});

describe('LevelMeter', () => {
  it('shows the level, the bar and what is left', () => {
    render(<LevelMeter xp={130} locale="en-US" />);
    expect(screen.getByText('Level 2')).toBeTruthy();
    const bar = screen.getByRole('meter', { name: 'Progress to the next level' });
    expect(bar.getAttribute('aria-valuetext')).toBe('30 of 150 XP');
    expect(screen.getByText('120 XP to level 3')).toBeTruthy();
    expect(slot('level-meter-gained')).toBeNull();
    expect(slot('level-meter')!.hasAttribute('data-level-up')).toBe(false);
  });

  it('shows a gain and fills from where it was', () => {
    render(<LevelMeter xp={130} gained={20} />);
    expect(slot('level-meter-gained')!.textContent).toContain('+20 XP');
    expect(slot('level-meter-gained')!.textContent).toContain('20 XP earned');
    expect(slot('level-meter-fill')!.style.getPropertyValue('--from')).toBe(String(10 / 150));
  });

  it('marks a gain that finished a level and fills from empty', () => {
    render(<LevelMeter xp={110} gained={20} labels={{ level: (n) => `Niveau ${n}` }} />);
    expect(slot('level-meter')!.hasAttribute('data-level-up')).toBe(true);
    expect(screen.getByText('Niveau 2')).toBeTruthy();
    expect(slot('level-meter-fill')!.style.getPropertyValue('--from')).toBe('0');
  });
});

describe('Milestones', () => {
  it('lists reached, next and ahead, and says how far the next is', () => {
    render(
      <Milestones value={5} steps={[3, 7, 14, 30]} labels={{ step: (_n, f) => `${f} days` }} locale="en-US" />,
    );
    const items = within(screen.getByRole('list', { name: 'Milestones' })).getAllByRole('listitem');
    expect(items.map((i) => i.dataset.state)).toEqual(['reached', 'next', 'ahead', 'ahead']);
    expect(items[1]!.getAttribute('aria-current')).toBe('step');
    expect(items[0]!.textContent).toContain('3 days: reached');
    expect(screen.getByText('2 more to 7 days')).toBeTruthy();
  });

  it('says when every milestone is reached', () => {
    render(<Milestones value={40} steps={[3, 7]} />);
    expect(screen.getByText('Every milestone reached.')).toBeTruthy();
  });
});

describe('RoundSummary', () => {
  it('labels the section by its title and lays out the stats', () => {
    render(
      <RoundSummary
        title="Round done"
        description="Two of three."
        xp={15}
        goal={{ earned: 15, goal: 20 }}
        streak={{ current: 6, extended: true }}
        highlight="A 7-day streak."
        celebrate={false}
        locale="en-US"
      >
        <button type="button">Share</button>
      </RoundSummary>,
    );
    const section = screen.getByRole('region', { name: 'Round done' });
    expect(section.querySelectorAll('[data-slot="round-summary-stat"]')).toHaveLength(3);
    expect(screen.getByText('5 XP to go')).toBeTruthy();
    expect(screen.getByText('Kept today')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('A 7-day streak.');
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(slot('round-summary-stat')!.textContent).toContain('+15');
  });

  it('leaves out what it is not given and focuses the title when asked', () => {
    render(<RoundSummary title="Done" headingLevel={3} goal={{ earned: 20, goal: 20 }} focusOnMount />);
    expect(screen.getByRole('heading', { level: 3, name: 'Done' })).toBe(document.activeElement);
    expect(screen.getByText('Goal met')).toBeTruthy();
    expect(slot('round-summary-highlight')).toBeNull();
    expect(slot('round-summary-actions')).toBeNull();
    cleanup();
    render(<RoundSummary title="Nothing" />);
    expect(slot('round-summary-stats')).toBeNull();
  });

  it('renders the final numbers on the server', () => {
    const html = renderToStaticMarkup(<RoundSummary title="Done" xp={1200} locale="en-US" />);
    expect(html).toContain('1,200');
  });
});

describe('ReminderOffer', () => {
  it('makes a calendar file at the chosen time and says it was added', () => {
    const onAdd = vi.fn();
    const created: Blob[] = [];
    const url = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      created.push(b as Blob);
      return 'blob:x';
    });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers();
    render(<ReminderOffer event="Sample game" uid="sample@example.com" onAdd={onAdd} />);
    expect(screen.getByRole('region', { name: 'A nudge each day?' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '07:15' } });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add to my calendar' })));
    expect(onAdd).toHaveBeenCalledWith('07:15');
    expect(click).toHaveBeenCalled();
    expect(created[0]!.type).toBe('text/calendar;charset=utf-8');
    expect(slot('reminder-offer')!.dataset.state).toBe('added');
    expect(slot('reminder-offer-status')!.textContent).toContain('Added.');
    expect(screen.queryByRole('button', { name: 'Add to my calendar' })).toBeNull();
    act(() => vi.runAllTimers());
    expect(revoke).toHaveBeenCalledWith('blob:x');
    vi.useRealTimers();
    url.mockRestore();
    revoke.mockRestore();
    click.mockRestore();
  });

  it('falls back to a sane time and offers Not now only with onDismiss', () => {
    const onDismiss = vi.fn();
    render(<ReminderOffer event="E" uid="u" defaultTime="nope" onDismiss={onDismiss} />);
    expect((screen.getByLabelText('Time') as HTMLInputElement).value).toBe('18:30');
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('Streak shields', () => {
  it('marks a covered day and says how many shields are held', () => {
    const played = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-22', '2026-11-23', '2026-11-24'];
    const { container } = render(
      <Streak played={played} today="2026-11-24" protection={{ every: 3, max: 2 }} locale="en-US" />,
    );
    expect(container.querySelector('[data-state="shielded"]')!.textContent).toContain('covered by a shield');
    expect(slot('streak-shields')!.textContent).toBe('1 streak shield ready');
  });

  it('says how far the next shield is, and nothing without protection', () => {
    const { rerender } = render(
      <Streak played={['2026-11-24']} today="2026-11-24" protection={{ every: 3, max: 1 }} />,
    );
    expect(slot('streak-shields')!.textContent).toBe('2 more days earn a streak shield');
    rerender(<Streak played={['2026-11-23', '2026-11-24']} today="2026-11-24" protection={{ every: 3, max: 1 }} />);
    expect(slot('streak-shields')!.textContent).toBe('1 more day earns a streak shield');
    rerender(<Streak played={['2026-11-24']} today="2026-11-24" />);
    expect(slot('streak-shields')).toBeNull();
  });
});

describe('ShareCard note', () => {
  it('shows the note and leaves out empty marks', () => {
    render(<ShareCard title="Sample game" results={[]} note="7-day streak" />);
    expect(slot('share-card-note')!.textContent).toBe('7-day streak');
    expect(slot('share-card-marks')).toBeNull();
  });
});
