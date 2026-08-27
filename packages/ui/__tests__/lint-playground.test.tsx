/**
 * LintPlayground locks — the injected-analyzer seam and the honesty
 * rules: findings are text first, stale results never paint, failure is
 * a statement (not an empty list), and the privacy fact is printed.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LintPlayground,
  type PlaygroundDiagnostic,
} from '../src/patterns/lint-playground.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.useFakeTimers();
});

const FINDING: PlaygroundDiagnostic = {
  line: 2,
  ruleId: 'jwt/no-algorithm-none',
  severity: 'error',
  message: '🔒 CWE-347 | unsigned tokens | CRITICAL\n   Fix: remove "none"',
};

const editorInput = (c: HTMLElement): HTMLTextAreaElement =>
  c.querySelector('[data-slot="code-editor-input"]') as HTMLTextAreaElement;

/** Flush the debounce and the promise queue. */
const settle = async (ms = 300) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

describe('the lint loop', () => {
  it('lints the initial code after the debounce and renders findings as TEXT', async () => {
    const lint = vi.fn().mockResolvedValue([FINDING]);
    const { container, getByText } = render(
      <LintPlayground data-testid="pg" label="Try it" initialCode={'a\nb'} lint={lint} />,
    );
    expect(container.querySelector('[data-slot="lint-playground"]')?.getAttribute('data-status')).toBe('linting');

    await settle();

    expect(lint).toHaveBeenCalledExactlyOnceWith('a\nb');
    expect(getByText('1 finding.')).toBeTruthy();
    expect(getByText('jwt/no-algorithm-none')).toBeTruthy();
    expect(getByText(/CWE-347/)).toBeTruthy();
    // The same fact as position: the editor bar for line 2 exists.
    expect(container.querySelector('[data-line="2"]')).not.toBeNull();
  });

  it('debounces typing — quiet time, then exactly one analysis of the newest code', async () => {
    const lint = vi.fn().mockResolvedValue([]);
    const { container } = render(
      <LintPlayground data-testid="pg" label="Try it" initialCode="a" lint={lint} />,
    );
    await settle();
    lint.mockClear();

    fireEvent.change(editorInput(container), { target: { value: 'ab' } });
    await settle(200); // inside the quiet window
    fireEvent.change(editorInput(container), { target: { value: 'abc' } });
    await settle(200); // still inside for the SECOND keystroke
    expect(lint).not.toHaveBeenCalled();
    await settle(100);
    expect(lint).toHaveBeenCalledExactlyOnceWith('abc');
  });

  it('a stale answer never paints — newer code invalidates older results', async () => {
    let resolveOld: (f: readonly PlaygroundDiagnostic[]) => void = () => {};
    const lint = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<readonly PlaygroundDiagnostic[]>((r) => (resolveOld = r)),
      )
      .mockResolvedValue([]);
    const { container, queryByText } = render(
      <LintPlayground data-testid="pg" label="Try it" initialCode="old" lint={lint} />,
    );
    await settle(); // first lint dispatched, hanging

    fireEvent.change(editorInput(container), { target: { value: 'new' } });
    await settle(); // second lint resolves [] for the new code

    // The OLD promise finally answers with a finding — for code that no
    // longer exists. It must be discarded.
    await act(async () => {
      resolveOld([FINDING]);
      await Promise.resolve();
    });
    expect(queryByText(/CWE-347/)).toBeNull();
    expect(queryByText('No findings.')).toBeTruthy();
  });

  it('a stale REJECTION is discarded too — old failures cannot smear new code', async () => {
    let rejectOld: (e: Error) => void = () => {};
    const lint = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<readonly PlaygroundDiagnostic[]>((_r, rej) => (rejectOld = rej)),
      )
      .mockResolvedValue([]);
    const { container, queryByText } = render(
      <LintPlayground data-testid="pg" label="Try it" initialCode="old" lint={lint} />,
    );
    await settle(); // first lint dispatched, hanging

    fireEvent.change(editorInput(container), { target: { value: 'new' } });
    await settle(); // second lint resolves clean

    await act(async () => {
      rejectOld(new Error('old worker crashed'));
      await Promise.resolve();
    });
    expect(queryByText(/unknown, not clean/)).toBeNull();
    expect(queryByText('No findings.')).toBeTruthy();
  });

  it('several findings pluralize, and a warn row keeps its own border identity', async () => {
    const { container, getByText } = render(
      <LintPlayground
        data-testid="pg"
        label="Try it"
        initialCode={'a\nb\nc'}
        lint={vi.fn().mockResolvedValue([
          FINDING,
          { line: 3, ruleId: 'demo/no-eval', severity: 'warn', message: 'eval is a door' },
        ])}
      />,
    );
    await settle();
    expect(getByText('2 findings.')).toBeTruthy();
    const rows = container.querySelectorAll('[data-slot="lint-playground-findings"] li');
    expect(rows[1]?.className).toContain('border-chart-4');
  });

  it('zero findings says so in words', async () => {
    const { getByText } = render(
      <LintPlayground
        data-testid="pg"
        label="Try it"
        initialCode="clean"
        lint={vi.fn().mockResolvedValue([])}
      />,
    );
    await settle();
    expect(getByText('No findings.')).toBeTruthy();
  });

  it('failure is a statement, never an empty list read as clean', async () => {
    const { container, getByText } = render(
      <LintPlayground
        data-testid="pg"
        label="Try it"
        initialCode="x"
        lint={vi.fn().mockRejectedValue(new Error('worker died'))}
      />,
    );
    await settle();
    expect(getByText(/unknown, not clean/)).toBeTruthy();
    expect(container.querySelector('[data-slot="lint-playground"]')?.getAttribute('data-status')).toBe('failed');
    // No bars from a failed analysis.
    expect(container.querySelectorAll('[data-line]')).toHaveLength(0);
  });

  it('bars only render for a READY result — never linting leftovers', async () => {
    const lint = vi.fn().mockResolvedValue([FINDING]);
    const { container } = render(
      <LintPlayground data-testid="pg" label="Try it" initialCode={'a\nb'} lint={lint} />,
    );
    await settle();
    expect(container.querySelector('[data-line="2"]')).not.toBeNull();
    fireEvent.change(editorInput(container), { target: { value: 'a\nb\nc' } });
    // Back in the linting state: the old bars are down.
    expect(container.querySelector('[data-line="2"]')).toBeNull();
  });
});

describe('surface contract', () => {
  it('status is a live region, the privacy fact is printed, ref and className land', async () => {
    const ref = { current: null as HTMLElement | null };
    const { container, getByText } = render(
      <LintPlayground
        ref={ref}
        data-testid="pg"
        label="Try it"
        initialCode="x"
        lint={vi.fn().mockResolvedValue([])}
        className="mt-10"
      />,
    );
    await settle();
    expect(
      container.querySelector('[data-slot="lint-playground-status"]')?.getAttribute('role'),
    ).toBe('status');
    expect(getByText(/nothing\s+you type leaves this page/)).toBeTruthy();
    expect(ref.current?.getAttribute('data-testid')).toBe('pg');
    expect(ref.current?.className).toContain('mt-10');
  });

  it('a parse-level finding (null ruleId) renders without inventing a rule name', async () => {
    const { container, getByText } = render(
      <LintPlayground
        data-testid="pg"
        label="Try it"
        initialCode="x"
        lint={vi
          .fn()
          .mockResolvedValue([
            { line: 1, ruleId: null, severity: 'error', message: 'Parsing error: x' },
          ])}
      />,
    );
    await settle();
    expect(getByText(/Parsing error/)).toBeTruthy();
    expect(container.querySelector('[data-slot="lint-playground-findings"]')?.textContent).not.toContain('null');
  });
});
