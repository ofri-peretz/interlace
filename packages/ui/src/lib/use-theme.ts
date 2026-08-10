'use client';

/**
 * @interlace/ui — useTheme.
 *
 * The runtime half of the two-axis theme contract. It owns the two pieces of
 * state a user can change (which THEME, which SCHEME), persists them, and
 * projects them onto `<html>` in exactly the shape `styles/index.css`
 * expects:
 *
 *   theme   → `data-theme="<name>"`   (absent = the default, which IS `:root`)
 *   scheme  → `class="dark"`          (shadcn / next-themes canon)
 *
 * ─── No dependency, but not no coordination ──────────────────────
 *
 * next-themes is ~3kB to do this, and its API surface (`forcedTheme`,
 * `enableColorScheme`, `nonce`, `themes[]`, a provider, a context) exists to
 * serve apps whose theme list is dynamic. Ours is a compile-time constant
 * with a machine-checked contract behind it, so the provider has nothing to
 * provide: the `<html>` element is the shared state, and a Context would be a
 * SECOND source of truth that can disagree with the DOM after the bootstrap
 * script runs — the exact bug class the script exists to avoid.
 *
 * What the DOM cannot do on its own is tell React that it changed. Two
 * instances of this hook in ONE document — a switcher in the nav and, say, a
 * themed preview frame in the page — each own their own `useState`, so the
 * one that did not handle the click keeps rendering the previous theme
 * forever: `storage` events fire in OTHER documents only, so nothing wakes
 * it. Found exactly that way (Phase 8.4: ds.interlace.tools repainted into
 * Harbor while every embedded preview stayed Interlace-orange), and it is
 * the sort of bug that reads as "theming doesn't work" rather than as a
 * missing subscription.
 *
 * The fix is a module-level subscriber list, not a provider: writes are
 * broadcast to every live instance in the document. It is deliberately the
 * VALUE that is broadcast rather than a "re-read storage" ping, because
 * storage can refuse the write (Safari private mode) and a re-read would
 * then roll the user's click back to the previous theme — turning a
 * degraded-but-working page into a control that visibly does nothing.
 *
 * ─── Hydration ───────────────────────────────────────────────────
 *
 * The hook starts at the defaults on both server and client, then syncs from
 * `localStorage` in an effect. That is deliberate: reading storage in a lazy
 * `useState` initialiser would produce different markup on server and client
 * and React would throw the tree away. The PAGE does not flash while this
 * happens — `THEME_SCRIPT` already painted the right colours before first
 * paint — only the switcher's own checkmark settles a frame late, which is
 * why `mounted` is returned. Render the control disabled/neutral until then
 * if the wrong tick would mislead.
 *
 * ─── Preference vs resolved scheme ───────────────────────────────
 *
 * `schemePreference` is what the user chose (`'light' | 'dark' | 'system'`).
 * `scheme` is what that resolves to right now. They are different values and
 * conflating them is why so many switchers stop following the OS after the
 * user has touched them once: storing the RESOLVED value turns "follow my
 * system" into "dark, forever, because it was dark when I clicked".
 */

import { useCallback, useEffect, useState } from 'react';

import { SCHEME_STORAGE_KEY, THEME_STORAGE_KEY } from './theme-script.js';
import {
  DEFAULT_THEME,
  isScheme,
  isThemeName,
  THEMES,
  type Scheme,
  type ThemeName,
} from './theme-tokens.js';

/** What the user chose. `'system'` means "follow `prefers-color-scheme`". */
export type SchemePreference = Scheme | 'system';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * `localStorage` access that cannot take the page down.
 *
 * Safari in private browsing throws on `localStorage` — not on write, on
 * ACCESS — and a theme hook is not worth a blank page. Same reasoning as the
 * `try` in THEME_SCRIPT.
 */
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* Storage unavailable (private mode, quota, blocked). The in-memory
     * state still applies for this page; it just will not survive a
     * reload — which is strictly better than throwing out of a click. */
  }
}

/**
 * Every live `useTheme()` in THIS document, by axis.
 *
 * Module scope, so it is per-bundle rather than per-tree — which is what
 * makes it work without a provider anywhere. Two separate sets rather than
 * one state object: the axes are independent, and broadcasting a pair would
 * make a theme change re-render every scheme-only consumer for nothing.
 */
const themeSubscribers = new Set<(theme: ThemeName) => void>();
const schemeSubscribers = new Set<(preference: SchemePreference) => void>();

/** The OS preference right now. `'light'` where the query is unsupported. */
export function systemScheme(): Scheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * The persisted theme, or `null` when the user has not chosen one.
 *
 * An unregistered value reads as `null` rather than being written through:
 * `localStorage` outlives any theme we ever remove, and `data-theme="ember"`
 * pointing at a selector no stylesheet defines renders the default theme
 * with the switcher insisting a different one is active.
 */
export function readStoredTheme(): ThemeName | null {
  const stored = readStorage(THEME_STORAGE_KEY);
  return isThemeName(stored) ? stored : null;
}

/** The persisted scheme preference. Absent or corrupt reads as `'system'`. */
export function readStoredScheme(): SchemePreference {
  const stored = readStorage(SCHEME_STORAGE_KEY);
  return isScheme(stored) ? stored : 'system';
}

/**
 * Project a (theme, scheme) pair onto `<html>`.
 *
 * The default theme is written as the ABSENCE of `data-theme`, because
 * `:root` already is that theme — writing `data-theme="interlace"` would add
 * a redundant selector that has to be kept in sync with a stylesheet rule
 * that does not exist.
 *
 * `style.colorScheme` is not decoration: it is what makes the browser paint
 * form controls, scrollbars and the pre-CSS canvas in the matching scheme.
 * Without it a dark page keeps a white scrollbar and white select popups.
 */
export function applyTheme(theme: ThemeName, scheme: Scheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', scheme === 'dark');
  root.style.colorScheme = scheme;
}

export interface UseThemeResult {
  /** The active theme name. */
  theme: ThemeName;
  /** Choose a theme. Persists, and repaints `<html>`. */
  setTheme: (theme: ThemeName) => void;
  /** The resolved colour scheme — what is on screen right now. */
  scheme: Scheme;
  /** What the user chose; `'system'` follows `prefers-color-scheme`. */
  schemePreference: SchemePreference;
  /** Choose a scheme preference. `'system'` clears the stored override. */
  setScheme: (preference: SchemePreference) => void;
  /** The theme registry, for rendering a picker. */
  themes: typeof THEMES;
  /** `false` until the first client effect has read storage. */
  mounted: boolean;
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);
  const [schemePreference, setSchemePreferenceState] =
    useState<SchemePreference>('system');
  const [resolvedSystem, setResolvedSystem] = useState<Scheme>('light');
  const [mounted, setMounted] = useState(false);

  // Sync from storage + OS on mount. Runs once; everything after this is
  // driven by user action, another tab, or the OS.
  useEffect(() => {
    setThemeState(readStoredTheme() ?? DEFAULT_THEME);
    setSchemePreferenceState(readStoredScheme());
    setResolvedSystem(systemScheme());
    setMounted(true);
  }, []);

  // Follow the OS while the page is open — a user who flips their system
  // theme at sunset expects the tab they left open to follow.
  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      setResolvedSystem(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Follow the other instances in THIS document. `setThemeState` /
  // `setSchemePreferenceState` are stable, so the subscription is registered
  // once and the set never churns.
  useEffect(() => {
    themeSubscribers.add(setThemeState);
    schemeSubscribers.add(setSchemePreferenceState);
    return () => {
      themeSubscribers.delete(setThemeState);
      schemeSubscribers.delete(setSchemePreferenceState);
    };
  }, []);

  // Follow other tabs. Without this, a user with two tabs open switches the
  // theme in one and the other keeps rendering the old one until reload,
  // while `localStorage` — the thing both of them believe — already moved.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        setThemeState(readStoredTheme() ?? DEFAULT_THEME);
      } else if (event.key === SCHEME_STORAGE_KEY) {
        setSchemePreferenceState(readStoredScheme());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const scheme: Scheme =
    schemePreference === 'system' ? resolvedSystem : schemePreference;

  // Project onto the DOM — but only once storage has been read. Applying the
  // defaults first would strip the class THEME_SCRIPT just set and flash the
  // page light for a frame, which is the exact failure the script prevents.
  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme, scheme);
  }, [mounted, theme, scheme]);

  // Both writers broadcast rather than calling their own setter: the
  // instance that handled the click is already subscribed, so one path
  // updates all of them — including this one — and there is no ordering
  // question about who sees the new value first.
  const setTheme = useCallback((next: ThemeName) => {
    writeStorage(THEME_STORAGE_KEY, next);
    for (const notify of themeSubscribers) notify(next);
  }, []);

  const setScheme = useCallback((next: SchemePreference) => {
    // `'system'` REMOVES the key rather than storing the string: absence is
    // how the bootstrap script knows to consult the OS, and it keeps one
    // representation of "no preference" instead of two.
    writeStorage(SCHEME_STORAGE_KEY, next === 'system' ? null : next);
    for (const notify of schemeSubscribers) notify(next);
  }, []);

  return {
    theme,
    setTheme,
    scheme,
    schemePreference,
    setScheme,
    themes: THEMES,
    mounted,
  };
}
