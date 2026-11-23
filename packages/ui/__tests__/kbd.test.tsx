/**
 * Kbd: a key, and a chord of keys.
 *
 * Locks the native element (a `<kbd>`, so the key is read as its text),
 * the data-slots, that a group nests keys inside one `<kbd>`, that sizes
 * are a fixed enum, and that it stays a server component.
 */
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { Kbd, KbdGroup, MIN_VIEWPORT } from '../src/primitives/kbd.js';

afterEach(cleanup);

describe('Kbd', () => {
  it('is a server component', () => {
    const src = readFileSync(resolve(__dirname, '../src/primitives/kbd.tsx'), 'utf8');
    expect(src).not.toMatch(/^['"]use client['"]/m);
    expect(renderToStaticMarkup(<Kbd>K</Kbd>)).toContain('data-slot="kbd"');
  });

  it('renders a native kbd with its text and min viewport', () => {
    const { getByText } = render(<Kbd>Esc</Kbd>);
    const key = getByText('Esc');
    expect(key.tagName).toBe('KBD');
    expect(key.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
  });

  it('defaults to sm and accepts md', () => {
    const { getByText } = render(
      <>
        <Kbd>A</Kbd>
        <Kbd size="md">B</Kbd>
      </>,
    );
    expect(getByText('A').className).toContain('h-5');
    expect(getByText('B').className).toContain('h-6');
  });

  it('merges className and passes props through', () => {
    const { getByText } = render(
      <Kbd className="ms-auto" aria-label="Command">
        ⌘
      </Kbd>,
    );
    const key = getByText('⌘');
    expect(key.className).toContain('ms-auto');
    expect(key.getAttribute('aria-label')).toBe('Command');
  });

  it('nests keys inside one kbd for a chord', () => {
    const { container } = render(
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <span>+</span>
        <Kbd>K</Kbd>
      </KbdGroup>,
    );
    const group = container.querySelector('[data-slot="kbd-group"]')!;
    expect(group.tagName).toBe('KBD');
    expect(group.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(group.querySelectorAll('[data-slot="kbd"]')).toHaveLength(2);
    expect(group.textContent).toBe('Ctrl+K');
  });
});
