/**
 * CodeBlock notation locks — the Shiki notation contract (highlighted /
 * diff lines) stays styled by the DS, and copying a diff yields the
 * post-diff code: `.diff.remove` lines never reach the clipboard.
 */
import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CodeBlock } from '../src/primitives/code-block.js';

/** A hand-authored Shiki-shaped span tree — highlighter-agnostic on purpose. */
const diffTree = (
  <>
    <span className="line">{'function validate(input) {'}</span>
    {'\n'}
    <span className="line diff remove">{'  return eval(input);'}</span>
    {'\n'}
    <span className="line diff add">{'  return schema.parse(input);'}</span>
    {'\n'}
    <span className="line">{'}'}</span>
    {'\n'}
  </>
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('diff copy — post-diff state only', () => {
  it('skips .diff.remove lines and their newlines on copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const onCopied = vi.fn();

    const { container, findByText } = render(
      <CodeBlock language="ts" onCopied={onCopied} data-testid="cb">
        {diffTree}
      </CodeBlock>,
    );
    fireEvent.click(
      container.querySelector('[data-slot="code-block-copy"]') as HTMLElement,
    );

    await findByText('Copied!');
    const copied =
      'function validate(input) {\n  return schema.parse(input);\n}\n';
    expect(writeText).toHaveBeenCalledWith(copied);
    expect(onCopied).toHaveBeenCalledWith(copied);
  });

  it('consecutive removed lines all drop, newlines included', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { container, findByText } = render(
      <CodeBlock language="ts" data-testid="cb">
        <span className="line">{'keep();'}</span>
        {'\n'}
        <span className="line diff remove">{'old1();'}</span>
        {'\n'}
        <span className="line diff remove">{'old2();'}</span>
        {'\n'}
        <span className="line">{'alsoKeep();'}</span>
        {'\n'}
      </CodeBlock>,
    );
    fireEvent.click(
      container.querySelector('[data-slot="code-block-copy"]') as HTMLElement,
    );

    await findByText('Copied!');
    expect(writeText).toHaveBeenCalledWith('keep();\nalsoKeep();\n');
  });

  it('a block without diff lines copies its full textContent unchanged', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { container, findByText } = render(
      <CodeBlock language="ts" data-testid="cb">
        <span className="line">{'const a = 1;'}</span>
        {'\n'}
      </CodeBlock>,
    );
    fireEvent.click(
      container.querySelector('[data-slot="code-block-copy"]') as HTMLElement,
    );

    await findByText('Copied!');
    expect(writeText).toHaveBeenCalledWith('const a = 1;\n');
  });
});

describe('notation styling contract', () => {
  it('the pre carries the notation utilities: wash, gutter marker, select-none', () => {
    const { container } = render(
      <CodeBlock language="ts" data-testid="cb">
        {diffTree}
      </CodeBlock>,
    );
    const pre = container.querySelector('[data-slot="code-block-pre"]');
    const cls = pre?.className ?? '';
    // Highlight wash rides a semantic token, not a raw color.
    expect(cls).toContain('[&_.line.highlighted]:bg-accent');
    // A diff is never color-alone: +/- markers are part of the contract.
    expect(cls).toContain("[&_.line.diff.add]:before:content-['+']");
    expect(cls).toContain("[&_.line.diff.remove]:before:content-['-']");
    // Manual selection must also yield the post-diff state.
    expect(cls).toContain('[&_.line.diff.remove]:select-none');
    // Bleed width tracks the spacing token that sets the pre's padding.
    expect(cls).toContain('var(--spacing-md)');
  });
});
