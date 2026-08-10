/**
 * useTheme + THEME_SCRIPT — the runtime half of the theme contract.
 *
 * Worth real tests rather than a smoke check, for the same reason
 * `use-reduced-motion` is: every failure mode here is SILENT. A hook that
 * stops reading `localStorage` renders the default theme forever and throws
 * nothing. A bootstrap script that stops matching the hook's storage keys
 * produces a page that is correct after hydration and wrong for the frame
 * before it — which is invisible in every test that does not look at the DOM
 * before React runs. So this file drives the DOM the way a browser would:
 * run the script string first, THEN mount, and assert what `<html>` holds at
 * each step.
 *
 * jsdom has no `matchMedia` (prior art: `use-reduced-motion.test.tsx`), so it
 * is stubbed per-test with a controllable one whose `change` listeners can be
 * fired by hand.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SCHEME_STORAGE_KEY,
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
} from '../src/lib/theme-script.js';
import {
  applyTheme,
  readStoredScheme,
  readStoredTheme,
  systemScheme,
  useTheme,
} from '../src/lib/use-theme.js';
import {
  DEFAULT_THEME,
  isScheme,
  isThemeName,
  SCHEMES,
  THEMES,
  THEME_TOKENS,
} from '../src/lib/theme-tokens.js';

const html = () => document.documentElement;

/** A controllable `matchMedia`, so "the OS said dark" is a thing we can say. */
function stubMatchMedia(dark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const matchMedia = vi.fn((query: string) => ({
    matches: dark && query.includes('dark'),
    media: query,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
      listeners.add(fn);
    },
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
      listeners.delete(fn);
    },
  }));
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    matchMedia,
    emit(nextDark: boolean) {
      for (const fn of listeners) fn({ matches: nextDark } as MediaQueryListEvent);
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

/**
 * Run the bootstrap the way a `<head>` script tag would.
 *
 * `new Function` is the point, not an accident: THEME_SCRIPT ships as literal
 * bytes that a browser evaluates before React exists, so evaluating it is the
 * only way to test what it actually DOES rather than what it looks like. (A
 * real `<script>` tag is not an option — vitest's jsdom environment runs with
 * `runScripts` disabled.) The input is a module-level constant built from a
 * compile-time registry; there is no dynamic input to inject into.
 */
function runBootstrap(): void {
  /* eslint-disable-next-line no-new-func, browser-security/no-eval, node-security/detect-eval-with-expression -- see above: evaluating the constant IS the test */
  new Function(THEME_SCRIPT)();
}

function Probe() {
  const theme = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme.theme}</span>
      <span data-testid="scheme">{theme.scheme}</span>
      <span data-testid="preference">{theme.schemePreference}</span>
      <span data-testid="mounted">{String(theme.mounted)}</span>
      <button onClick={() => theme.setTheme('harbor')}>harbor</button>
      <button onClick={() => theme.setTheme('interlace')}>interlace</button>
      <button onClick={() => theme.setScheme('dark')}>dark</button>
      <button onClick={() => theme.setScheme('light')}>light</button>
      <button onClick={() => theme.setScheme('system')}>system</button>
    </div>
  );
}

const shown = (id: string) => screen.getByTestId(id).textContent;

/**
 * The probe renders the current preference as text AND a button per choice,
 * so `getByText('system')` is ambiguous by construction. Query by role.
 */
const button = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  localStorage.clear();
  html().removeAttribute('data-theme');
  html().classList.remove('dark');
  html().style.colorScheme = '';
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── the manifest ────────────────────────────────────────────────────────

describe('theme registry', () => {
  it('registers exactly one default theme, and it is the one :root already is', () => {
    const defaults = THEMES.filter((theme) => theme.default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].name).toBe(DEFAULT_THEME);
  });

  it('has unique theme names and a non-trivial token manifest', () => {
    const names = THEMES.map((theme) => theme.name);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(THEME_TOKENS).size).toBe(THEME_TOKENS.length);
    expect(THEME_TOKENS.length).toBeGreaterThan(40);
    expect(SCHEMES).toEqual(['light', 'dark']);
  });

  it('narrows unknown strings — the localStorage attack surface', () => {
    // Storage is user-writable and outlives any theme we remove.
    expect(isThemeName('harbor')).toBe(true);
    expect(isThemeName('ember')).toBe(false);
    expect(isThemeName(null)).toBe(false);
    expect(isThemeName(7)).toBe(false);
    expect(isScheme('dark')).toBe(true);
    expect(isScheme('system')).toBe(false);
    expect(isScheme(undefined)).toBe(false);
  });
});

// ── the no-flash bootstrap ──────────────────────────────────────────────

describe('THEME_SCRIPT (no-flash bootstrap)', () => {
  it('paints the stored theme + scheme onto <html> with no React involved', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'harbor');
    localStorage.setItem(SCHEME_STORAGE_KEY, 'dark');

    runBootstrap();

    expect(html().getAttribute('data-theme')).toBe('harbor');
    expect(html().classList.contains('dark')).toBe(true);
    expect(html().style.colorScheme).toBe('dark');
  });

  it('writes NO data-theme for the default theme — `:root` already is it', () => {
    html().setAttribute('data-theme', 'harbor'); // stale attribute from before
    localStorage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME);

    runBootstrap();

    expect(html().hasAttribute('data-theme')).toBe(false);
  });

  it('ignores a theme name that is no longer registered', () => {
    // The reason the script carries the registry at all: a theme that shipped
    // once and was removed would otherwise keep writing an attribute for a
    // selector no stylesheet defines.
    localStorage.setItem(THEME_STORAGE_KEY, 'ember');

    runBootstrap();

    expect(html().hasAttribute('data-theme')).toBe(false);
  });

  it('falls back to prefers-color-scheme when no scheme is stored', () => {
    stubMatchMedia(true);
    runBootstrap();
    expect(html().classList.contains('dark')).toBe(true);

    stubMatchMedia(false);
    runBootstrap();
    expect(html().classList.contains('dark')).toBe(false);
  });

  it('ignores a corrupt stored scheme rather than trusting it', () => {
    localStorage.setItem(SCHEME_STORAGE_KEY, 'DARK-MODE-PLEASE');
    stubMatchMedia(true);

    runBootstrap();

    expect(html().classList.contains('dark')).toBe(true); // from the OS, not the string
  });

  it('survives a browser with no matchMedia at all', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(() => runBootstrap()).not.toThrow();
    expect(html().classList.contains('dark')).toBe(false);
  });

  it('never throws when localStorage is unavailable (Safari private mode)', () => {
    // Safari throws on ACCESS, not on write. A blocking head script that
    // throws is a worse outcome than a page in the default theme.
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => runBootstrap()).not.toThrow();
    spy.mockRestore();
  });

  it('uses the same storage keys the hook writes', () => {
    // The one drift that would produce a flash on every load while every
    // other test stays green: the script and the hook disagreeing about where
    // the preference lives.
    expect(THEME_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_SCRIPT).toContain(JSON.stringify(SCHEME_STORAGE_KEY));
    expect(THEME_SCRIPT).toContain('classList.toggle');
    // Inline in <head> means it must not contain a script terminator.
    expect(THEME_SCRIPT).not.toContain('</script');
  });
});

// ── the primitives the hook is built from ───────────────────────────────

describe('applyTheme', () => {
  it('writes data-theme for a non-default theme and removes it for the default', () => {
    applyTheme('harbor', 'light');
    expect(html().getAttribute('data-theme')).toBe('harbor');

    applyTheme(DEFAULT_THEME, 'light');
    expect(html().hasAttribute('data-theme')).toBe(false);
  });

  it('drives the scheme through `.dark` AND style.color-scheme', () => {
    // Without `color-scheme` the page is dark and the scrollbar, form
    // controls and pre-CSS canvas the browser paints stay white.
    applyTheme(DEFAULT_THEME, 'dark');
    expect(html().classList.contains('dark')).toBe(true);
    expect(html().style.colorScheme).toBe('dark');

    applyTheme(DEFAULT_THEME, 'light');
    expect(html().classList.contains('dark')).toBe(false);
    expect(html().style.colorScheme).toBe('light');
  });

  it('is a no-op on the server instead of throwing', () => {
    vi.stubGlobal('document', undefined);
    expect(() => applyTheme('harbor', 'dark')).not.toThrow();
  });
});

describe('storage readers', () => {
  it('reads a registered theme and rejects anything else', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'harbor');
    expect(readStoredTheme()).toBe('harbor');

    localStorage.setItem(THEME_STORAGE_KEY, 'ember');
    expect(readStoredTheme()).toBeNull();

    localStorage.removeItem(THEME_STORAGE_KEY);
    expect(readStoredTheme()).toBeNull();
  });

  it('treats an absent or corrupt scheme as "no preference"', () => {
    expect(readStoredScheme()).toBe('system');

    localStorage.setItem(SCHEME_STORAGE_KEY, 'dark');
    expect(readStoredScheme()).toBe('dark');

    localStorage.setItem(SCHEME_STORAGE_KEY, 'system');
    // `'system'` is never WRITTEN (absence means system), so reading it back
    // is corrupt input — and it resolves to the same place either way.
    expect(readStoredScheme()).toBe('system');
  });

  it('degrades to defaults when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readStoredTheme()).toBeNull();
    expect(readStoredScheme()).toBe('system');
    spy.mockRestore();
  });
});

describe('systemScheme', () => {
  it('reports what the OS says', () => {
    stubMatchMedia(true);
    expect(systemScheme()).toBe('dark');
    stubMatchMedia(false);
    expect(systemScheme()).toBe('light');
  });

  it('queries prefers-color-scheme: dark specifically', () => {
    const mm = stubMatchMedia(true);
    systemScheme();
    expect(mm.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('degrades to light without matchMedia, and without a window', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(systemScheme()).toBe('light');

    vi.stubGlobal('window', undefined);
    expect(systemScheme()).toBe('light');
  });
});

// ── the hook ────────────────────────────────────────────────────────────

describe('useTheme', () => {
  it('starts at the defaults, then settles on what storage says', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'harbor');
    localStorage.setItem(SCHEME_STORAGE_KEY, 'dark');

    render(<Probe />);

    // The effect has already run by the time render() returns; `mounted` is
    // what tells a consumer the values are the user's and not the defaults.
    expect(shown('mounted')).toBe('true');
    expect(shown('theme')).toBe('harbor');
    expect(shown('preference')).toBe('dark');
    expect(shown('scheme')).toBe('dark');
    expect(html().getAttribute('data-theme')).toBe('harbor');
    expect(html().classList.contains('dark')).toBe(true);
  });

  it('respects prefers-color-scheme when the user has expressed no preference', () => {
    stubMatchMedia(true);
    render(<Probe />);

    expect(shown('preference')).toBe('system');
    expect(shown('scheme')).toBe('dark');
    expect(html().classList.contains('dark')).toBe(true);
  });

  it('persists a theme choice and repaints <html>', async () => {
    const user = userEvent.setup();
    render(<Probe />);

    await user.click(button('harbor'));

    expect(shown('theme')).toBe('harbor');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('harbor');
    expect(html().getAttribute('data-theme')).toBe('harbor');

    await user.click(button('interlace'));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('interlace');
    expect(html().hasAttribute('data-theme')).toBe(false);
  });

  it('persists an explicit scheme, and CLEARS the key for "system"', async () => {
    // The distinction that keeps "follow my OS" reachable: storing the
    // resolved value would turn one click into a permanent override.
    const user = userEvent.setup();
    render(<Probe />);

    await user.click(button('dark'));
    expect(localStorage.getItem(SCHEME_STORAGE_KEY)).toBe('dark');
    expect(html().classList.contains('dark')).toBe(true);

    await user.click(button('system'));
    expect(localStorage.getItem(SCHEME_STORAGE_KEY)).toBeNull();
    expect(shown('preference')).toBe('system');

    await user.click(button('light'));
    expect(localStorage.getItem(SCHEME_STORAGE_KEY)).toBe('light');
    expect(html().classList.contains('dark')).toBe(false);
  });

  it('follows the OS while the page is open — but only on "system"', () => {
    const mm = stubMatchMedia(false);
    render(<Probe />);

    act(() => mm.emit(true));
    expect(shown('scheme')).toBe('dark');
    expect(html().classList.contains('dark')).toBe(true);

    // And back — a one-way listener would look correct all evening and be
    // wrong every morning.
    act(() => mm.emit(false));
    expect(shown('scheme')).toBe('light');
    expect(html().classList.contains('dark')).toBe(false);

    // An explicit choice must win over the OS from then on.
    act(() => {
      button('light').click();
    });
    act(() => mm.emit(true));
    expect(shown('scheme')).toBe('light');
  });

  it('follows another tab through the storage event', () => {
    render(<Probe />);

    localStorage.setItem(THEME_STORAGE_KEY, 'harbor');
    act(() => {
      fireEvent(window, new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    });
    expect(shown('theme')).toBe('harbor');

    localStorage.setItem(SCHEME_STORAGE_KEY, 'dark');
    act(() => {
      fireEvent(window, new StorageEvent('storage', { key: SCHEME_STORAGE_KEY }));
    });
    expect(shown('scheme')).toBe('dark');

    // An unrelated key must not disturb anything.
    localStorage.setItem('unrelated', 'x');
    act(() => {
      fireEvent(window, new StorageEvent('storage', { key: 'unrelated' }));
    });
    expect(shown('theme')).toBe('harbor');
    expect(shown('scheme')).toBe('dark');
  });

  it('ignores a theme another tab wrote that is not registered', () => {
    render(<Probe />);
    localStorage.setItem(THEME_STORAGE_KEY, 'ember');
    act(() => {
      fireEvent(window, new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    });
    expect(shown('theme')).toBe(DEFAULT_THEME);
  });

  it('keeps working when localStorage refuses to be written', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const user = userEvent.setup();
    render(<Probe />);

    await user.click(button('harbor'));

    // The choice applies for this page even though it will not survive a
    // reload — strictly better than throwing out of a click handler.
    expect(shown('theme')).toBe('harbor');
    expect(html().getAttribute('data-theme')).toBe('harbor');
    spy.mockRestore();
  });

  it('keeps working when localStorage refuses to be cleared', async () => {
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const user = userEvent.setup();
    render(<Probe />);

    await user.click(button('system'));

    expect(shown('preference')).toBe('system');
    spy.mockRestore();
  });

  it('removes its media listener on unmount, so a long-lived page does not leak one per mount', () => {
    const mm = stubMatchMedia(false);
    const { unmount } = render(<Probe />);
    expect(mm.listenerCount).toBe(1);
    unmount();
    expect(mm.listenerCount).toBe(0);
  });

  it('renders without matchMedia at all', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(() => render(<Probe />)).not.toThrow();
    expect(shown('scheme')).toBe('light');
  });

  it('agrees with the bootstrap script — no repaint between them', () => {
    // The end-to-end property that makes the no-flash story true: whatever
    // the script painted before React existed must be exactly what the hook
    // decides afterwards. If these ever diverge the page changes appearance
    // on hydration, which is the flash wearing a different hat.
    localStorage.setItem(THEME_STORAGE_KEY, 'harbor');
    localStorage.setItem(SCHEME_STORAGE_KEY, 'dark');

    runBootstrap();
    const afterScript = html().outerHTML.slice(0, html().outerHTML.indexOf('>') + 1);

    render(<Probe />);
    const afterHook = html().outerHTML.slice(0, html().outerHTML.indexOf('>') + 1);

    expect(afterHook).toBe(afterScript);
  });
});
