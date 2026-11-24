/**
 * @interlace/ui — the no-flash theme bootstrap.
 *
 * A theme applied after hydration is a WHITE FLASH on every page load: the
 * document paints `:root` (Interlace · light) first, React mounts, an effect
 * reads localStorage, and only then does the page repaint into the dark or
 * re-branded palette the user actually chose. On a fast connection that is
 * one frame of the wrong colours; on a slow one it is half a second of a
 * blinding white page. It is the single most visible failure mode of a theme
 * system, and no amount of correctness in the hook fixes it — by the time
 * any React code runs, the wrong paint has already happened.
 *
 * The only fix is to write the DOM attributes BEFORE first paint, which means
 * a synchronous, blocking, inline `<script>` in `<head>`. Hence a string
 * constant rather than a component: it has to be inlined by the host
 * document, and the host is the only thing that can put it there.
 *
 * ─── How consumers use it ─────────────────────────────────────────
 *
 * Next.js App Router (`app/layout.tsx`) — server component, no 'use client':
 *
 * ```tsx
 * import { THEME_SCRIPT } from '@interlace/ui/theme-script';
 *
 * <html lang="en" suppressHydrationWarning>
 *   <head>
 *     <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
 *   </head>
 * ```
 *
 * `suppressHydrationWarning` on `<html>` is required and is the same thing
 * next-themes asks for: the script deliberately mutates the element React is
 * about to hydrate, so the server markup and the client DOM differ by
 * design. It suppresses the warning for that one element's attributes only.
 *
 * Vite / plain HTML: paste the string into `<head>` as an inline script, or
 * emit it at build time. It has no imports and no dependencies.
 *
 * ─── What it deliberately does NOT do ─────────────────────────────
 *
 * No feature detection beyond what it needs, no polyfills, no error
 * reporting. It is wrapped in one `try` and fails silently, because a
 * blocking head script that throws is a worse outcome than a page in the
 * default theme: Safari in private mode throws on `localStorage` access,
 * and a broken page for those users is not a trade worth making for a
 * console message nobody reads.
 */

import { DEFAULT_THEME, THEMES } from './theme-tokens.js';

/** `localStorage` key holding the chosen theme name. */
export const THEME_STORAGE_KEY = 'interlace-theme';

/**
 * `localStorage` key holding the chosen colour scheme: `'light'`, `'dark'`,
 * or absent. ABSENT IS MEANINGFUL — it is "the user has expressed no
 * preference", which is what makes `prefers-color-scheme` authoritative.
 * Storing the string `'system'` would work too, but then a user who has
 * never touched the switcher and a user who explicitly chose "system" are
 * indistinguishable from the OS's point of view, and a future default
 * change silently overrides the second one.
 */
export const SCHEME_STORAGE_KEY = 'interlace-scheme';

/**
 * `localStorage` key holding the chosen text size: a `TEXT_SIZES` value
 * other than `'default'`, or absent. Absent is the default (100%).
 */
export const TEXT_SIZE_STORAGE_KEY = 'interlace-text-size';

/**
 * `localStorage` key holding the contrast preference: `'more'`, `'normal'`,
 * or absent. Absent means "follow `prefers-contrast`", the same rule as the
 * scheme. `'normal'` is stored because it is a real choice: it opts out of
 * the OS setting, which the stylesheet honours through
 * `data-contrast="normal"`.
 */
export const CONTRAST_STORAGE_KEY = 'interlace-contrast';

/**
 * The reading sizes, smallest first. `scale` is the root font size as a
 * fraction of the browser's own default, so a reader who already raised the
 * browser's text size keeps that and gets this on top. Every rem in the
 * system (type, spacing, control heights, containers) follows, which is
 * what WCAG 1.4.4 asks for: text that grows without the layout breaking.
 *
 * Steps stop at 150%. Combined with a browser zoom of 133% that already
 * reaches the 200% the criterion is tested at.
 */
export const TEXT_SIZES = [
  { value: 'default', scale: 1, label: '100%' },
  { value: 'lg', scale: 1.125, label: '112%' },
  { value: 'xl', scale: 1.25, label: '125%' },
  { value: '2xl', scale: 1.5, label: '150%' },
] as const;

export type TextSize = (typeof TEXT_SIZES)[number]['value'];

/** `true` for a registered text size. Storage is user-writable. */
export const isTextSize = (value: unknown): value is TextSize =>
  TEXT_SIZES.some((size) => size.value === value);

const NON_DEFAULT_TEXT_SIZES = TEXT_SIZES.filter(
  (size) => size.value !== 'default',
).map((size) => size.value);

/**
 * Names the bootstrap will accept out of `localStorage`, minus the default
 * (which is written as no attribute at all — `:root` already IS that theme).
 *
 * Validating against the registry matters: `localStorage` is user-writable
 * and survives forever, so a theme that shipped once and was later removed
 * would otherwise keep writing `data-theme="…"` for a selector no stylesheet
 * defines — a page that silently renders half-default, half-nothing.
 */
const NON_DEFAULT_THEMES = THEMES.filter((t) => t.name !== DEFAULT_THEME).map(
  (t) => t.name,
);

/**
 * The bootstrap itself — an IIFE, minified by hand because it ships as
 * literal bytes in every page's `<head>` and no bundler will ever see it.
 *
 * Derived from the registry (`THEMES`) and the storage keys above, so adding
 * a theme cannot leave the bootstrap behind.
 *
 * What it does, in order:
 *   1. read the stored theme; write `data-theme` only when it is a
 *      registered NON-default theme (the default is `:root`, so writing it
 *      would be noise);
 *   2. read the stored scheme; when absent or corrupt, fall back to
 *      `prefers-color-scheme` — the OS preference is the correct default,
 *      not `light`;
 *   3. toggle the `.dark` class (shadcn / next-themes canon — the selector
 *      every consumer and the Storybook decorator already write);
 *   4. set `style.color-scheme`, so form controls, scrollbars and the
 *      canvas the browser paints BEFORE any CSS also match. Without it the
 *      page is dark and the scrollbar is white.
 *   5. read the stored text size and contrast preference, and write
 *      `data-text-size` / `data-contrast` when one is set. A size applied
 *      after hydration would reflow the whole page under the reader's eyes,
 *      which is worse than the colour flash this script exists to stop.
 */
/**
 * JSON for embedding inside a `<script>` element.
 *
 * `JSON.stringify` alone is not enough (CodeQL js/bad-code-sanitization): a
 * value containing `</script>` closes the tag from inside a string literal,
 * and `<!--` opens an HTML comment that swallows the rest of the script.
 * Escaping `<` as `\u003c` is inert in JS and closes both. Every value here is
 * a build-time constant today — this keeps that safe if one ever becomes a
 * prop, which is precisely when nobody would think to re-check it.
 */
const jsonForScript = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c');

export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,l=window.localStorage;var t=l.getItem(${jsonForScript(
  THEME_STORAGE_KEY,
)});if(${jsonForScript(
  NON_DEFAULT_THEMES,
)}.indexOf(t)>-1){d.setAttribute('data-theme',t)}else{d.removeAttribute('data-theme')}var s=l.getItem(${jsonForScript(
  SCHEME_STORAGE_KEY,
)});if(s!=='light'&&s!=='dark'){s=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.classList.toggle('dark',s==='dark');d.style.colorScheme=s;var z=l.getItem(${jsonForScript(
  TEXT_SIZE_STORAGE_KEY,
)});if(${jsonForScript(
  NON_DEFAULT_TEXT_SIZES,
)}.indexOf(z)>-1){d.setAttribute('data-text-size',z)}var c=l.getItem(${jsonForScript(
  CONTRAST_STORAGE_KEY,
)});if(c==='more'||c==='normal'){d.setAttribute('data-contrast',c)}}catch(e){}})();`;
