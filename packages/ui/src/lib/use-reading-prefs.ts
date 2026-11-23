'use client';

/**
 * @interlace/ui — useReadingPrefs.
 *
 * The two reading-comfort axes, beside the theme and scheme that `useTheme`
 * owns:
 *
 *   text size → `data-text-size="lg" | "xl" | "2xl"`  (absent = 100%)
 *   contrast  → `data-contrast="more" | "normal"`      (absent = follow the OS)
 *
 * Both are written to `<html>`. Text size has to be: it sets the ROOT font
 * size, and every rem in the system (type, spacing, control heights,
 * containers) reads the root. On any other element it would grow the text
 * and leave every box the same size, which is how text ends up clipped.
 *
 * Same shape as `useTheme`, for the same reasons: no provider (the `<html>`
 * element is the shared state), a module-level subscriber list so two
 * controls in one document agree, the `storage` event so two tabs agree,
 * and storage access that cannot throw. `THEME_SCRIPT` applies both axes
 * before first paint, so the page never reflows on hydration; only the
 * control's own state settles a frame late, which is what `mounted` is for.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  CONTRAST_STORAGE_KEY,
  isTextSize,
  TEXT_SIZE_STORAGE_KEY,
  TEXT_SIZES,
  type TextSize,
} from './theme-script.js';

/** `'system'` follows `prefers-contrast: more`; the others override it. */
export type ContrastPreference = 'more' | 'normal' | 'system';

const MORE_QUERY = '(prefers-contrast: more)';

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
    /* Private mode or blocked storage: the choice still applies to this
     * page, it just will not survive a reload. */
  }
}

/** The persisted text size. Absent or unregistered reads as `'default'`. */
export function readStoredTextSize(): TextSize {
  const stored = readStorage(TEXT_SIZE_STORAGE_KEY);
  return isTextSize(stored) ? stored : 'default';
}

/** The persisted contrast preference. Absent or corrupt reads as `'system'`. */
export function readStoredContrast(): ContrastPreference {
  const stored = readStorage(CONTRAST_STORAGE_KEY);
  return stored === 'more' || stored === 'normal' ? stored : 'system';
}

/** Project both axes onto `<html>`. The defaults are written as absence. */
export function applyReadingPrefs(
  textSize: TextSize,
  contrast: ContrastPreference,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (textSize === 'default') root.removeAttribute('data-text-size');
  else root.setAttribute('data-text-size', textSize);
  if (contrast === 'system') root.removeAttribute('data-contrast');
  else root.setAttribute('data-contrast', contrast);
}

const textSizeSubscribers = new Set<(size: TextSize) => void>();
const contrastSubscribers = new Set<(level: ContrastPreference) => void>();

export interface UseReadingPrefsResult {
  /** The active text size. */
  textSize: TextSize;
  /** Choose a text size. Persists, and resizes the page. */
  setTextSize: (size: TextSize) => void;
  /** One step smaller (`-1`) or larger (`1`), held at the ends. */
  stepTextSize: (direction: -1 | 1) => void;
  /** The registered sizes, smallest first, for rendering a picker. */
  textSizes: typeof TEXT_SIZES;
  /** What the user chose; `'system'` follows `prefers-contrast`. */
  contrastPreference: ContrastPreference;
  /** Whether more contrast is on screen right now, from either source. */
  moreContrast: boolean;
  /** Choose a contrast preference. `'system'` clears the stored override. */
  setContrast: (level: ContrastPreference) => void;
  /** `false` until the first client effect has read storage. */
  mounted: boolean;
}

export function useReadingPrefs(): UseReadingPrefsResult {
  const [textSize, setTextSizeState] = useState<TextSize>('default');
  const [contrastPreference, setContrastState] =
    useState<ContrastPreference>('system');
  const [systemMore, setSystemMore] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTextSizeState(readStoredTextSize());
    setContrastState(readStoredContrast());
    setSystemMore(Boolean(window.matchMedia?.(MORE_QUERY).matches));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia(MORE_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemMore(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    textSizeSubscribers.add(setTextSizeState);
    contrastSubscribers.add(setContrastState);
    return () => {
      textSizeSubscribers.delete(setTextSizeState);
      contrastSubscribers.delete(setContrastState);
    };
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === TEXT_SIZE_STORAGE_KEY) setTextSizeState(readStoredTextSize());
      else if (event.key === CONTRAST_STORAGE_KEY) setContrastState(readStoredContrast());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Only after storage is read: applying the defaults first would undo what
  // THEME_SCRIPT set and reflow the page for a frame.
  useEffect(() => {
    if (!mounted) return;
    applyReadingPrefs(textSize, contrastPreference);
  }, [mounted, textSize, contrastPreference]);

  const setTextSize = useCallback((next: TextSize) => {
    writeStorage(TEXT_SIZE_STORAGE_KEY, next === 'default' ? null : next);
    for (const notify of textSizeSubscribers) notify(next);
  }, []);

  const stepTextSize = useCallback(
    (direction: -1 | 1) => {
      const index = TEXT_SIZES.findIndex((size) => size.value === textSize);
      const next = TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, Math.max(0, index + direction))];
      if (next && next.value !== textSize) setTextSize(next.value);
    },
    [textSize, setTextSize],
  );

  const setContrast = useCallback((next: ContrastPreference) => {
    writeStorage(CONTRAST_STORAGE_KEY, next === 'system' ? null : next);
    for (const notify of contrastSubscribers) notify(next);
  }, []);

  const moreContrast =
    contrastPreference === 'more' || (contrastPreference === 'system' && systemMore);

  return {
    textSize,
    setTextSize,
    stepTextSize,
    textSizes: TEXT_SIZES,
    contrastPreference,
    moreContrast,
    setContrast,
    mounted,
  };
}
