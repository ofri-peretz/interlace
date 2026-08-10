'use client';

import { useTheme } from '@interlace/ui/use-theme';
import { DEFAULT_THEME, type ThemeName } from '@interlace/ui/theme-tokens';

/**
 * A LIVE render of the component, embedded from the deployed Storybook.
 *
 * Deliberately an iframe rather than importing the component here: the story
 * being shown is the exact one the `storybook (a11y)` CI gate renders and runs
 * axe against, so the preview can never show something that hasn't been
 * verified — and the registry site ships zero component JS to do it.
 *
 * `args` overrides let one story serve several demos: the skeleton preview is
 * the same story with `loading:!true`, so every component with a `loading`
 * prop gets a skeleton demo, not just the 11 with a dedicated Loading story.
 *
 * ─── Why this is a client component: BOTH theme axes ──────────────
 *
 * The frame is a separate document on a separate origin. Nothing about the
 * page's palette crosses into it — not the `.dark` class, not `data-theme`,
 * not a CSS variable — so a preview that does not deliberately carry the
 * reader's choice across renders in the DS default no matter what the page
 * around it looks like. Before Phase 8.4 that was half-handled: the frame
 * followed `prefers-color-scheme` (the OS), which was right often enough to
 * hide the problem, and knew nothing about the theme axis at all.
 *
 * Both axes now come from `useTheme()` — the same hook the switcher in the
 * nav writes to — and cross into the frame by URL, one axis per mechanism
 * because Storybook gives them different ones:
 *
 *   theme   `?globals=interlaceTheme:<name>`
 *           `interlaceTheme` is declared in `globalTypes`
 *           (apps/storybook/.storybook/preview.ts), and Storybook only
 *           honours URL globals it has a declaration for — which is why
 *           this works and the line below does not.
 *
 *   scheme  swap to the component's `--dark` story
 *           `?globals=theme:dark` does NOT work against the deployed
 *           Storybook (verified): `theme` is addon-themes' global and is
 *           not declared in `globalTypes`, so Storybook drops it and the
 *           story renders light. The `--dark` twin carries the same state
 *           as a story-level `globals` + `.dark` decorator, and is itself
 *           a11y-gated. Components without a twin keep the light render —
 *           visible, and better than a silent no-op.
 *
 * Changing either axis changes `src`, so the frame reloads and repaints.
 * That is the intended cost: a cross-origin frame cannot be re-themed in
 * place, and a stale preview is the failure this exists to prevent.
 */

/**
 * Where the previews come from.
 *
 * Overridable because the theme axis only resolves against a Storybook build
 * that declares `interlaceTheme` — i.e. one built from this branch. Pointing
 * a local registry at a local Storybook (`NEXT_PUBLIC_STORYBOOK_URL=
 * http://localhost:6006 npm run dev`) is the only way to SEE the theme axis
 * work before the Storybook deploy catches up, and "verify it in a browser"
 * is not optional for a claim about colour.
 */
const STORYBOOK_URL =
  // `||`, not `??`. `.env.example` ships the key with an EMPTY value, and an
  // empty string is not nullish — `??` would take it, every preview URL would
  // become same-origin `/iframe.html?…`, and every frame on the site would
  // render a 404 for anyone who copied the example file verbatim.
  process.env.NEXT_PUBLIC_STORYBOOK_URL || 'https://storybook.interlace.tools';

export function storyUrl(
  storyId: string,
  args?: string,
  theme: ThemeName = DEFAULT_THEME,
): string {
  const query = new URLSearchParams({ id: storyId, viewMode: 'story' });
  if (args) query.set('args', args);
  // Always sent, including the default: the URL then states which brand it
  // is showing instead of implying it, and a frame that is re-pointed at the
  // default theme has to actually navigate rather than keep a stale render.
  query.set('globals', `interlaceTheme:${theme}`);
  return `${STORYBOOK_URL}/iframe.html?${query.toString()}`;
}

type Props = {
  storyId: string;
  /** Dark-theme twin. Falls back to `storyId` when the component has none. */
  darkStoryId?: string | null;
  label: string;
  args?: string;
  /** Preview frame height in px. Stories are centred, so this is generous. */
  height?: number;
};

export function StoryPreview({
  storyId,
  darkStoryId,
  label,
  args,
  height = 320,
}: Props) {
  const { theme, scheme, mounted } = useTheme();

  const shown = scheme === 'dark' && darkStoryId ? darkStoryId : storyId;

  return (
    <figure className="border-border bg-card/40 overflow-hidden rounded-lg border">
      {mounted ? (
        /*
         * The title IS set — from the per-preview `label` prop, unique per
         * frame ("live render", "loading state", one per example story). The
         * rule only recognises a string literal, so it can't see through the
         * JSX expression container.
         */
        // eslint-disable-next-line react-a11y/iframe-has-title
        <iframe
          // Keyed on the resolved pair so a theme or scheme change REPLACES
          // the frame rather than mutating `src` on the existing one. Same
          // pixels either way in every browser we tested, but it removes the
          // question of whether a cross-origin frame honours a src rewrite.
          key={`${shown}-${theme}`}
          src={storyUrl(shown, args, theme)}
          title={label}
          loading="lazy"
          className="bg-background block w-full"
          style={{ height }}
        />
      ) : (
        <div
          className="bg-card/60 animate-pulse"
          style={{ height }}
          aria-hidden
        />
      )}
      <figcaption className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs">
        <span>{label}</span>
        <a
          href={`${STORYBOOK_URL}/?path=/story/${shown}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground font-mono transition-colors"
        >
          {shown} ↗
        </a>
      </figcaption>
    </figure>
  );
}
