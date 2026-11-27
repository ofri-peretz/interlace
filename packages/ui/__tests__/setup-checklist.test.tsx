/**
 * SetupChecklist. Pins what a member sees and hears: how far they are, in
 * words and on the bar; which task is next; that done tasks say so in words;
 * that only a task finished here pops; and the finished card.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { MIN_VIEWPORT, SetupChecklist, SetupTask } from '../src/patterns/setup-checklist.js';

const Card = ({ done = [] as string[], onDismiss }: { done?: string[]; onDismiss?: () => void }) => (
  <SetupChecklist
    title="Get started"
    description="A few things to make it yours."
    completeTitle="You're all set"
    completeDescription="Everything is ready."
    onDismiss={onDismiss}
  >
    <SetupTask key="photo" title="Add a photo" done={done.includes('photo')} reward="+10 XP" />
    <SetupTask
      key="topics"
      title="Pick topics"
      description="So we can suggest what to read."
      action={<a href="#topics">Pick topics</a>}
      done={done.includes('topics')}
    />
    <SetupTask key="play" title="Play a game" action={<button type="button">Play</button>} done={done.includes('play')} />
    {null}
  </SetupChecklist>
);

const bar = () => screen.getByRole('progressbar');
const fill = () => bar().firstElementChild as HTMLElement;

describe('SetupChecklist', () => {
  it('renders every task on the server, in a named section, as an ordered list', () => {
    const html = renderToStaticMarkup(<Card done={['photo']} />);
    expect(html).not.toContain('>Play<');
    expect(html).toContain('data-slot="setup-checklist"');
    expect(html).toContain(`data-min-viewport="${MIN_VIEWPORT}"`);
    expect(html.match(/data-slot="setup-task"/g)).toHaveLength(3);
    expect(html).toContain('<ol');
    expect(html).toContain('<h2');
  });

  it('says how far the member is, in words and on the bar', () => {
    render(<Card done={['photo']} />);
    expect(screen.getByRole('region', { name: 'Get started' })).toBeTruthy();
    expect(bar().getAttribute('aria-valuenow')).toBe('1');
    expect(bar().getAttribute('aria-valuemax')).toBe('3');
    expect(bar().getAttribute('aria-valuetext')).toBe('1 of 3 done');
    expect(screen.getByText('1 of 3 done').getAttribute('aria-live')).toBe('polite');
    expect(fill().style.transform).toBe(`scaleX(${1 / 3})`);
  });

  it('puts the first task not done forward, with its description and action', () => {
    render(<Card done={['photo']} />);
    const items = screen.getAllByRole('listitem');
    expect(items[1]!.getAttribute('aria-current')).toBe('step');
    expect(items[1]!.hasAttribute('data-next')).toBe(true);
    expect(items[0]!.hasAttribute('aria-current')).toBe(false);
    expect(screen.getByText('So we can suggest what to read.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Pick topics' })).toBeTruthy();
    expect(items[0]!.textContent).toContain('+10 XP');
  });

  it('says Done in words for a done task, and hides its action', () => {
    render(<Card done={['photo', 'topics']} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]!.textContent).toContain(', Done');
    expect(items[1]!.hasAttribute('data-done')).toBe(true);
    expect(screen.queryByRole('link')).toBeNull();
    expect(items[2]!.getAttribute('aria-current')).toBe('step');
  });

  it('opens every undone task with expand="all"', () => {
    render(
      <SetupChecklist title="All" expand="all">
        <SetupTask title="One" description="First" />
        <SetupTask title="Two" description="Second" />
      </SetupChecklist>,
    );
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('pops the tick only for a task finished here', () => {
    const { rerender } = render(<Card done={['photo']} />);
    const tick = (i: number) => screen.getAllByRole('listitem')[i]!.querySelector('svg')!.getAttribute('class')!;
    expect(tick(0)).not.toContain('animate-in');
    rerender(<Card done={['photo', 'topics']} />);
    expect(tick(1)).toContain('motion-safe:animate-in');
  });

  it('says when everything is done, and offers to put the card away', () => {
    const onDismiss = vi.fn();
    render(<Card done={['photo', 'topics', 'play']} onDismiss={onDismiss} />);
    expect(screen.getByRole('heading', { name: "You're all set" })).toBeTruthy();
    expect(screen.getByText('Everything is ready.')).toBeTruthy();
    expect(document.querySelector('[data-slot="setup-checklist"]')!.hasAttribute('data-complete')).toBe(true);
    expect(screen.queryAllByRole('listitem').some((li) => li.hasAttribute('aria-current'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps the title and description when no finished words are given, and offers no Close without onDismiss', () => {
    render(
      <SetupChecklist
        title="Setup"
        description="Two steps"
        headingLevel={3}
        dismissLabel="Hide"
        progressLabel={(d, t) => `${d}/${t}`}
      >
        <SetupTask title="One" done doneLabel="Finished" />
      </SetupChecklist>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Setup' })).toBeTruthy();
    expect(screen.getByText('Two steps')).toBeTruthy();
    expect(screen.getByText('1/1')).toBeTruthy();
    expect(screen.getByRole('listitem').textContent).toContain(', Finished');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws an empty bar with no tasks, and is never complete', () => {
    render(<SetupChecklist title="Nothing yet" className="mt-2" data-testid="card" />);
    expect(fill().style.transform).toBe('scaleX(0)');
    expect(screen.getByTestId('card').hasAttribute('data-complete')).toBe(false);
    expect(screen.getByTestId('card').className).toContain('mt-2');
    expect(screen.getByRole('heading').nextElementSibling).toBeNull();
  });

  it('renders a task on its own, not put forward', () => {
    const html = renderToStaticMarkup(
      <ol>
        <SetupTask title="Alone" description="Just this" className="extra" />
      </ol>,
    );
    expect(html).not.toContain('aria-current');
    expect(html).toContain('Just this');
    expect(html).toContain('extra');
    expect(React.isValidElement(<SetupTask title="x" />)).toBe(true);
  });
});
