/**
 * Reading settings: text size and contrast, end to end in the DOM.
 *
 * Same approach as `use-theme.test.tsx`: run the bootstrap string first,
 * then mount, and assert what `<html>` holds. A bootstrap that stops
 * agreeing with the hook's storage keys is correct after hydration and
 * wrong for the frame before, which only a DOM-level test sees.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONTRAST_STORAGE_KEY,
  TEXT_SIZE_STORAGE_KEY,
  TEXT_SIZES,
  THEME_SCRIPT,
} from '../src/lib/theme-script.js';
import { readStoredContrast, readStoredTextSize } from '../src/lib/use-reading-prefs.js';
import { ContrastToggle, TextSizeControl } from '../src/primitives/reading-settings.js';

const html = () => document.documentElement;

function stubMatchMedia(moreContrast: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: moreContrast && query.includes('prefers-contrast'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

function runBootstrap() {
  /* eslint-disable-next-line no-new-func, browser-security/no-eval, node-security/detect-eval-with-expression -- evaluating the constant IS the test, as in use-theme.test.tsx */
  new Function(THEME_SCRIPT)();
}

const button = (name: RegExp | string) => screen.getByRole('button', { name });

beforeEach(() => {
  localStorage.clear();
  html().removeAttribute('data-text-size');
  html().removeAttribute('data-contrast');
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('THEME_SCRIPT applies reading settings before first paint', () => {
  it('writes a stored text size and contrast choice', () => {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, 'xl');
    localStorage.setItem(CONTRAST_STORAGE_KEY, 'more');
    runBootstrap();
    expect(html().getAttribute('data-text-size')).toBe('xl');
    expect(html().getAttribute('data-contrast')).toBe('more');
  });

  it('writes nothing for no choice, and ignores values it does not know', () => {
    runBootstrap();
    expect(html().hasAttribute('data-text-size')).toBe(false);
    expect(html().hasAttribute('data-contrast')).toBe(false);

    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, '9000%');
    localStorage.setItem(CONTRAST_STORAGE_KEY, 'loud');
    runBootstrap();
    expect(html().hasAttribute('data-text-size')).toBe(false);
    expect(html().hasAttribute('data-contrast')).toBe(false);
  });

  it('keeps an explicit "normal" contrast, which opts out of the OS setting', () => {
    localStorage.setItem(CONTRAST_STORAGE_KEY, 'normal');
    runBootstrap();
    expect(html().getAttribute('data-contrast')).toBe('normal');
  });
});

describe('TextSizeControl', () => {
  it('is a named group whose middle button shows and resets the size', async () => {
    render(<TextSizeControl />);
    expect(screen.getByRole('group', { name: 'Text size' })).toBeTruthy();
    expect(button(/Reset text size, 100%/)).toBeTruthy();
  });

  it('steps up and down, persists, and writes the root attribute', async () => {
    const user = userEvent.setup();
    render(<TextSizeControl />);

    await user.click(button('Larger text'));
    expect(html().getAttribute('data-text-size')).toBe('lg');
    expect(localStorage.getItem(TEXT_SIZE_STORAGE_KEY)).toBe('lg');
    expect(button(/Reset text size, 112%/)).toBeTruthy();

    await user.click(button('Smaller text'));
    expect(html().hasAttribute('data-text-size')).toBe(false);
    // The default is stored as absence, the same rule as the theme.
    expect(localStorage.getItem(TEXT_SIZE_STORAGE_KEY)).toBeNull();
  });

  it('holds at the ends without disabling, so keyboard focus stays put', async () => {
    const user = userEvent.setup();
    render(<TextSizeControl />);

    const smaller = button('Smaller text');
    expect(smaller.getAttribute('aria-disabled')).toBe('true');
    expect(smaller.hasAttribute('disabled')).toBe(false);

    const larger = button('Larger text');
    larger.focus();
    for (let i = 0; i < TEXT_SIZES.length + 2; i += 1) await user.keyboard('{Enter}');
    expect(html().getAttribute('data-text-size')).toBe('2xl');
    expect(larger.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(larger);

    await user.click(button(/Reset text size/));
    expect(html().hasAttribute('data-text-size')).toBe(false);
  });

  it('reads a stored size on mount, and two controls stay in step', async () => {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, 'xl');
    const user = userEvent.setup();
    render(
      <>
        <TextSizeControl label="First" />
        <TextSizeControl label="Second" />
      </>,
    );
    const [first] = screen.getAllByRole('button', { name: 'Larger text' });
    await user.click(first!);
    const groups = screen.getAllByRole('group');
    for (const group of groups) expect(group.getAttribute('data-text-size-value')).toBe('2xl');
  });

  it('takes translated names', () => {
    render(
      <TextSizeControl
        label="Taille du texte"
        labels={{ smaller: 'Plus petit', reset: 'Taille normale', larger: 'Plus grand' }}
      />,
    );
    expect(screen.getByRole('group', { name: 'Taille du texte' })).toBeTruthy();
    expect(button('Plus grand')).toBeTruthy();
    expect(button(/Taille normale, 100%/)).toBeTruthy();
  });
});

describe('ContrastToggle', () => {
  it('turns More contrast on and off, storing an explicit choice', async () => {
    const user = userEvent.setup();
    render(<ContrastToggle />);
    const toggle = button('More contrast');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    await user.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(html().getAttribute('data-contrast')).toBe('more');
    expect(readStoredContrast()).toBe('more');

    await user.click(toggle);
    expect(html().getAttribute('data-contrast')).toBe('normal');
    expect(readStoredContrast()).toBe('normal');
  });

  it('shows pressed when the OS asks for more contrast and no choice is stored', async () => {
    stubMatchMedia(true);
    render(<ContrastToggle />);
    await act(async () => {});
    expect(button('More contrast').getAttribute('aria-pressed')).toBe('true');
    // Following the OS writes no attribute: the stylesheet's media query does it.
    expect(html().hasAttribute('data-contrast')).toBe(false);
  });

  it('can render as an icon button with the name kept', () => {
    render(<ContrastToggle showLabel={false} />);
    expect(button('More contrast').textContent).toBe('');
  });
});

describe('storage readers', () => {
  it('fall back to the defaults on absent or corrupt values', () => {
    expect(readStoredTextSize()).toBe('default');
    expect(readStoredContrast()).toBe('system');
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, 'huge');
    expect(readStoredTextSize()).toBe('default');
  });
});
