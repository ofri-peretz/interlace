import * as React from 'react';
import type { Decorator } from '@storybook/react-vite';

/**
 * Shared story decorators that surface the cross-cutting design
 * philosophies in Storybook itself.
 *
 *   - `withRtl`        — wraps a story in `dir="rtl"`. Surfaces baked-in
 *                        left/right asymmetry per `I18N_PHILOSOPHY.md`.
 *   - `withReducedMotion` — injects the same animation-kill CSS used by
 *                        `@media (prefers-reduced-motion: reduce)`
 *                        in `preview.css`, so designers see what a
 *                        reduce user sees per `MOTION_PHILOSOPHY.md`.
 */
export const withRtl: Decorator = (Story) => (
  <div dir="rtl" lang="ar">
    <Story />
  </div>
);

const REDUCED_MOTION_CSS = `
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
`;

export const withReducedMotion: Decorator = (Story) => (
  <>
    <style dangerouslySetInnerHTML={{ __html: REDUCED_MOTION_CSS }} />
    <Story />
  </>
);

/**
 * Apply dark mode by toggling the `.dark` class on `<html>` for the
 * lifetime of the story.
 *
 * Why an effect instead of a wrapping div: Storybook's `sb-main-centered`
 * canvas sizes single-child decorators to their content. A wrapping
 * `<div className="dark bg-background">` collapses around the story's
 * visible glyphs, so axe-core's contrast walker (which uses
 * `getBoundingClientRect` to pick the covering background ancestor)
 * routinely walks PAST the wrapper to the un-painted white body and
 * scores every dark-mode foreground at ~1:1 contrast.
 *
 * Toggling `.dark` on `<html>` lets the preflight `body { background-color:
 * var(--background) }` rule paint the entire iframe dark, so the dark
 * surface covers any pixel the story might render. Cleanup on unmount
 * restores the previous class list (which the global toolbar theme
 * switcher writes to as well — withThemeByClassName, parentSelector
 * `'html'`).
 */
export const withDark: Decorator = (Story) => {
  React.useLayoutEffect(() => {
    const html = document.documentElement;
    const had = html.classList.contains('dark');
    html.classList.add('dark');
    return () => {
      if (!had) html.classList.remove('dark');
    };
  }, []);
  return <Story />;
};
