/**
 * CodeEditor locks — the zero-sync layout contract (bars at fixed
 * line-height offsets against an auto-growing, non-wrapping textarea),
 * both ownership modes, and the bars-are-position-only rule.
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CodeEditor,
  LINE_HEIGHT_PX,
  PAD_Y_PX,
} from '../src/primitives/code-editor.js';

afterEach(cleanup);

const input = (container: HTMLElement): HTMLTextAreaElement =>
  container.querySelector('[data-slot="code-editor-input"]') as HTMLTextAreaElement;

describe('ownership', () => {
  it('uncontrolled: defaultValue renders and typing reports through onValueChange', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <CodeEditor
        data-testid="ed"
        label="Sample"
        defaultValue={'a\nb'}
        onValueChange={onValueChange}
      />,
    );
    expect(input(container).value).toBe('a\nb');
    fireEvent.change(input(container), { target: { value: 'a\nb\nc' } });
    expect(input(container).value).toBe('a\nb\nc');
    expect(onValueChange).toHaveBeenCalledWith('a\nb\nc');
  });

  it('controlled: the value prop owns the text; typing only reports', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <CodeEditor data-testid="ed" label="Sample" value="held" onValueChange={onValueChange} />,
    );
    fireEvent.change(input(container), { target: { value: 'typed' } });
    expect(onValueChange).toHaveBeenCalledWith('typed');
    expect(input(container).value).toBe('held');
  });
});

describe('the zero-sync layout contract', () => {
  it('a bar for line N sits at PAD_Y + (N-1) · LINE_HEIGHT, one line tall', () => {
    const { container } = render(
      <CodeEditor
        data-testid="ed"
        label="Sample"
        defaultValue={'l1\nl2\nl3\nl4'}
        diagnostics={[{ line: 3, severity: 'error' }]}
      />,
    );
    const bar = container.querySelector<HTMLElement>('[data-line="3"]');
    expect(bar?.style.top).toBe(`${PAD_Y_PX + 2 * LINE_HEIGHT_PX}px`);
    expect(bar?.style.height).toBe(`${LINE_HEIGHT_PX}px`);
  });

  it('the constants and the classes are ONE contract — leading-6 is 24, py-4 is 16', () => {
    // Change either side only with the other; this is the pairing that
    // makes scroll-sync unnecessary.
    expect(LINE_HEIGHT_PX).toBe(24);
    expect(PAD_Y_PX).toBe(16);
    const { container } = render(
      <CodeEditor data-testid="ed" label="Sample" defaultValue="x" />,
    );
    expect(input(container).className).toContain('leading-6');
    expect(input(container).className).toContain('py-4');
    // No soft wrap and no vertical scrolling — line N must BE row N.
    expect(input(container).getAttribute('wrap')).toBe('off');
    expect(input(container).className).toContain('overflow-y-hidden');
  });

  it('the textarea grows with the code instead of scrolling', () => {
    const { container } = render(
      <CodeEditor data-testid="ed" label="Sample" defaultValue={'1\n2\n3\n4\n5\n6\n7'} />,
    );
    expect(input(container).rows).toBe(7);
  });

  it('minRows keeps an empty editor readable as a place to type', () => {
    const { container } = render(
      <CodeEditor data-testid="ed" label="Sample" defaultValue="" minRows={6} />,
    );
    expect(input(container).rows).toBe(6);
  });
});

describe('bars are position, never information', () => {
  it('the highlight layer is hidden from the tree', () => {
    const { container } = render(
      <CodeEditor
        data-testid="ed"
        label="Sample"
        defaultValue={'a\nb'}
        diagnostics={[{ line: 1, severity: 'warn' }]}
      />,
    );
    expect(
      container
        .querySelector('[data-slot="code-editor-highlights"]')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('severities differ by border, not hue alone', () => {
    const { container } = render(
      <CodeEditor
        data-testid="ed"
        label="Sample"
        defaultValue={'a\nb'}
        diagnostics={[
          { line: 1, severity: 'error' },
          { line: 2, severity: 'warn' },
        ]}
      />,
    );
    expect(container.querySelector('[data-line="1"]')?.className).toContain('border-destructive');
    expect(container.querySelector('[data-line="2"]')?.className).toContain('border-chart-4');
  });

  it('out-of-range lines are simply not drawn', () => {
    const { container } = render(
      <CodeEditor
        data-testid="ed"
        label="Sample"
        defaultValue={'only\ntwo'}
        diagnostics={[
          { line: 0, severity: 'error' },
          { line: 9, severity: 'error' },
        ]}
      />,
    );
    expect(container.querySelectorAll('[data-line]')).toHaveLength(0);
  });
});

describe('surface contract', () => {
  it('is named, findable, extendable, and hands back the textarea ref', () => {
    const ref = { current: null as HTMLTextAreaElement | null };
    const { container } = render(
      <CodeEditor
        ref={ref}
        data-testid="ed"
        label="Paste your code"
        defaultValue="x"
        className="mt-8"
      />,
    );
    expect(input(container).getAttribute('aria-label')).toBe('Paste your code');
    expect(input(container).getAttribute('spellcheck')).toBe('false');
    expect(
      container.querySelector('[data-slot="code-editor"]')?.getAttribute('data-testid'),
    ).toBe('ed');
    expect(container.querySelector('[data-slot="code-editor"]')?.className).toContain('mt-8');
    expect(ref.current?.tagName.toLowerCase()).toBe('textarea');
  });
});
