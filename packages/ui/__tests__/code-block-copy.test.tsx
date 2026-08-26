/**
 * CodeBlock copy locks — the seam fires only on a REAL clipboard write,
 * with the exact copied text, and the "Copied!" affordance never claims
 * a success that didn't happen.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CodeBlock } from '../src/primitives/code-block.js';

const copyButton = (container: HTMLElement): HTMLElement => {
  const btn = container.querySelector<HTMLElement>('[data-slot="code-block-copy"]');
  if (!btn) throw new Error('copy button missing');
  return btn;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('onCopied — the measurement seam', () => {
  it('fires with the exact text after a successful write', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const onCopied = vi.fn();

    const { container, findByText } = render(
      <CodeBlock language="ts" onCopied={onCopied} data-testid="cb">
        {'const a = 1;'}
      </CodeBlock>,
    );
    fireEvent.click(copyButton(container));

    await findByText('Copied!');
    expect(writeText).toHaveBeenCalledWith('const a = 1;');
    expect(onCopied).toHaveBeenCalledWith('const a = 1;');
  });

  it('copies node children via the rendered textContent (highlighter spans)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const onCopied = vi.fn();

    const { container, findByText } = render(
      <CodeBlock language="ts" onCopied={onCopied} data-testid="cb">
        <span>const</span> <span>b</span>
      </CodeBlock>,
    );
    fireEvent.click(copyButton(container));

    await findByText('Copied!');
    expect(onCopied).toHaveBeenCalledWith('const b');
  });
});

describe('honesty — no clipboard, no "Copied!"', () => {
  it('without a clipboard API the affordance stays quiet and the seam never fires', async () => {
    vi.stubGlobal('navigator', {});
    const onCopied = vi.fn();

    const { container, queryByText } = render(
      <CodeBlock language="ts" onCopied={onCopied} data-testid="cb">
        {'const a = 1;'}
      </CodeBlock>,
    );
    // act drains the full async queue before returning — no counting of
    // microtask ticks that a future extra `await` would silently exceed
    // (review).
    await act(async () => {
      fireEvent.click(copyButton(container));
    });

    expect(queryByText('Copied!')).toBeNull();
    expect(onCopied).not.toHaveBeenCalled();
  });

  it('a rejected write is swallowed without claiming success', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const onCopied = vi.fn();

    const { container, queryByText } = render(
      <CodeBlock language="ts" onCopied={onCopied} data-testid="cb">
        {'const a = 1;'}
      </CodeBlock>,
    );
    await act(async () => {
      fireEvent.click(copyButton(container));
    });

    expect(queryByText('Copied!')).toBeNull();
    expect(onCopied).not.toHaveBeenCalled();
  });
});
