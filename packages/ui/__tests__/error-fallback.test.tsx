/**
 * ErrorFallback: what a person lands on when a screen crashes. The `report` is injected, so no
 * test depends on the default log; one case checks the default is wired.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorFallback } from '../src/patterns/error-fallback.js';
import { defaultErrorLog, setReporter } from '../src/lib/error-report.js';
import type { ErrorReport } from '../src/lib/error-report-model.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const kept = (id: string): ErrorReport => ({ id, at: 1, where: 'w', message: 'm', fatal: false, count: 1 });

function setup(props: Partial<React.ComponentProps<typeof ErrorFallback>> = {}) {
  const report = vi.fn((_e: unknown, _w: string) => kept('ab12cdef'));
  const reset = vi.fn();
  const error = new Error('the secret message the person typed: hunter2');
  const ui = (p: Partial<React.ComponentProps<typeof ErrorFallback>> = {}) => (
    <ErrorFallback error={error} where="route: /play" report={report} reset={reset} {...props} {...p} />
  );
  const view = render(ui());
  return { ...view, report, reset, error, ui };
}

describe('ErrorFallback', () => {
  it('shows the title, the description and Try again', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Something went wrong here' })).toBeTruthy();
    expect(screen.getByText('Try again in a moment.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('shows Go back only when there is somewhere to go, and says so in the description', () => {
    const { rerender, ui } = setup();
    expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
    const onBack = vi.fn();
    rerender(ui({ onBack }));
    expect(screen.getByText('Try again, or go back.')).toBeTruthy();
    return userEvent.click(screen.getByRole('button', { name: 'Go back' })).then(() => {
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  it('reports once on mount, with the place the caller named', () => {
    const { report, error } = setup();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(error, 'route: /play');
  });

  it('does not report again on a re-render with the same error, and does for a new one', () => {
    const { report, rerender, ui, error } = setup();
    rerender(ui({ error }));
    rerender(ui({ className: 'changed' }));
    expect(report).toHaveBeenCalledTimes(1);
    const next = new Error('a different failure');
    rerender(ui({ error: next }));
    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenLastCalledWith(next, 'route: /play');
  });

  it('reports once under StrictMode, which runs effects twice', () => {
    const report = vi.fn(() => kept('zzzz'));
    render(
      <React.StrictMode>
        <ErrorFallback error={new Error('x')} where="w" reset={() => undefined} report={report} />
      </React.StrictMode>,
    );
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('calls reset when Try again is pressed, once per press, and does not hide itself', async () => {
    const { reset } = setup();
    const button = screen.getByRole('button', { name: 'Try again' });
    await userEvent.click(button);
    expect(reset).toHaveBeenCalledTimes(1);
    await userEvent.click(button);
    expect(reset).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('calls retry when that is what the router hands over', async () => {
    const retry = vi.fn();
    render(<ErrorFallback error={new Error('x')} where="w" retry={retry} report={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('prefers reset when both are given', async () => {
    const reset = vi.fn();
    const retry = vi.fn();
    render(<ErrorFallback error={1} where="w" reset={reset} retry={retry} report={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it('hides Try again with neither, promises nothing in its words, and warns in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'development');
    render(<ErrorFallback error={1} where="w" report={() => undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/try again/i)).toBeNull();
    expect(screen.getByText('Please come back in a moment.')).toBeTruthy();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('reset');
  });

  it('is quiet about it in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    render(<ErrorFallback error={1} where="w" report={() => undefined} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it('shows the back button alone when only onBack is given', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<ErrorFallback error={1} where="w" onBack={() => undefined} report={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Go back' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByText('Go back and try something else.')).toBeTruthy();
  });

  it('moves focus to the heading once, and does not take it back on a re-render', async () => {
    const { rerender, ui } = setup();
    const title = screen.getByRole('heading');
    expect(document.activeElement).toBe(title);
    await userEvent.tab();
    const button = screen.getByRole('button', { name: 'Try again' });
    expect(document.activeElement).toBe(button);
    rerender(ui({ className: 'again' }));
    expect(document.activeElement).toBe(button);
  });

  it('is a live alert, and puts neither the message nor the stack on the screen', () => {
    const { container } = setup();
    const region = screen.getByRole('alert');
    expect(region.tagName).toBe('SECTION');
    expect(region.getAttribute('data-slot')).toBe('error-fallback');
    expect(container.textContent).not.toContain('hunter2');
    expect(container.textContent).not.toContain('the secret message');
    expect(container.textContent).not.toMatch(/\bat \w+/);
  });

  it('shows the four-character reference once the report is known, and can hide it', () => {
    const { rerender, ui } = setup();
    expect(screen.getByText('Reference: ab12')).toBeTruthy();
    rerender(ui({ showReference: false }));
    expect(screen.queryByText(/Reference/)).toBeNull();
  });

  it('shows no reference when the report has no id (an app’s own reporter, or a dropped report)', () => {
    render(<ErrorFallback error={1} where="w" reset={() => undefined} report={() => undefined} />);
    expect(screen.queryByText(/Reference/)).toBeNull();
  });

  it('writes in the app’s words, and renders the app’s reassurance as given', () => {
    render(
      <ErrorFallback
        error={1}
        where="w"
        reset={() => undefined}
        report={() => kept('wxyz1234')}
        reassurance={<p>Your progress is saved.</p>}
        labels={{ title: 'Oops', retry: 'Reload', referenceLine: (r) => `Code ${r}` }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Oops' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(screen.getByText('Code wxyz')).toBeTruthy();
    expect(screen.getByText('Your progress is saved.')).toBeTruthy();
  });

  it('passes className and other section props through', () => {
    render(
      <ErrorFallback error={1} where="w" className="extra" id="boundary" reset={() => undefined} report={() => undefined} />,
    );
    const region = screen.getByRole('alert');
    expect(region.className).toContain('extra');
    expect(region.id).toBe('boundary');
    expect(region.getAttribute('data-min-viewport')).toBe('320');
  });

  it('reports to the default log when no report is passed', () => {
    const heard = vi.fn();
    defaultErrorLog.clear();
    setReporter(heard);
    render(<ErrorFallback error={new Error('real')} where="route: /x" reset={() => undefined} />);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard.mock.calls[0][0]).toMatchObject({ where: 'route: /x', message: 'real' });
    // and the reference on screen is that report's id
    expect(screen.getByText(/^Reference: /)).toBeTruthy();
    setReporter(null);
    defaultErrorLog.clear();
  });

  it('server markup hydrates with no mismatch (nothing reads window while rendering)', async () => {
    const element = (
      <ErrorFallback error={new Error('x')} where="w" reset={() => undefined} report={() => kept('abcd')} />
    );
    const parsed = new DOMParser().parseFromString(`<div>${renderToString(element)}</div>`, 'text/html');
    const container = document.adoptNode(parsed.body.firstElementChild as HTMLElement);
    document.body.appendChild(container);
    expect(container.textContent).not.toContain('Reference');
    const problems = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => {
      hydrateRoot(container, element);
    });
    expect(problems).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Reference: abcd');
    container.remove();
  });

  it('has no axe violations', async () => {
    const { container } = setup({ onBack: () => undefined });
    await act(async () => undefined);
    const { violations } = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(violations.map((v) => v.id)).toEqual([]);
  });
});
