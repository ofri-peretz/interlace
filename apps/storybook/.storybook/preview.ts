import type { Preview } from '@storybook/react-vite';
import { withThemeByClassName } from '@storybook/addon-themes';

import './preview.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Backgrounds addon DISABLED: it injects an inline `body { background:
     // … }` style that wins over the token-cascade-driven CSS, painting
     // every story on the addon's default (light) regardless of the theme
     // class on <html>. axe then scores dark-mode text on a white body and
     // fails contrast at ~1.16:1. The theme switcher in this preview already
     // drives surface color via `--background` / `--foreground`; the
     // backgrounds picker is redundant for our use-case.
    backgrounds: { disable: true },
    a11y: {
      // Strict tag stack. Keep in sync with the two sibling gates:
      //   - apps/storybook/.storybook/test-runner.ts  STRICT_TAGS
      //   - apps/landing/e2e/a11y.spec.ts             A11Y_TAGS
      // All three now run the same seven tags. Landing additionally excludes
      // `color-contrast-enhanced` by name — its marketing gradient cannot
      // clear AAA — which is the one intentional difference; see the block
      // comment there. (`apps/docs` — cited here before — does not exist;
      // neither does scripts/a11y-summary.ts.)
      // `context`, not `element`. addon-a11y 10 renamed this, and the old key
      // is not ignored: the scan throws
      //   SB_ADDON_A11Y_0001 (ElementA11yParameterError)
      // and every story reports an addon error instead of a result, so NO
      // story is axe-scanned in the dev UI while the system advertises a
      // strict WCAG 2.2 AA + ACT gate. Verified by A/B-ing the key against a
      // running Storybook. (The test-runner gate is unaffected — it calls
      // axe.run directly and never reads this parameter.)
      context: '#storybook-root',
      config: {
        rules: [
          // WCAG 2.2 AAA (color-contrast-enhanced) is now ENFORCED.
          // Brand tokens have been bumped to clear ≥7:1 body / ≥4.5:1
          // large in both light and dark modes (see interlace-theme.css
          // for the colour ladder).
          //
          // Per-story carve-outs (rare; e.g. an intentional anti-pattern
          // demo) go in `parameters.a11y.config.rules` on the story
          // itself, with a JSDoc note explaining the rationale.
        ],
      },
      options: {
        runOnly: {
          type: 'tag',
          values: [
            'wcag2a',
            'wcag2aa',
            'wcag21a',
            'wcag21aa',
            'wcag22aa',
            'best-practice',
            'ACT',
          ],
        },
      },
      test: 'error',
    },
    /**
     * `padded`, NOT `centered`. This is a responsiveness contract, not a
     * cosmetic preference.
     *
     * Storybook's centered layout sizes the story root to its CONTENT — it
     * measured 32px wide against a 1280px body. Every component in this DS is
     * built mobile-first and sizes itself from its container (`w-full`,
     * `max-w-*`, `viewBox`), and a percentage width against an indefinite
     * container resolves to nothing. So the centered layout rendered
     * SignInForm as a ~40px column with circular inputs, FocusRing as one word
     * per line, and every chart as a blank box — a layout no user will ever
     * see, presented as the component's live preview on ds.interlace.tools.
     *
     * `padded` gives the root a definite, full width. Components that genuinely
     * want centering (a lone Badge, a Button) opt in per story with
     * `parameters: { layout: 'centered' }` — that is the exception, and it is
     * safe because those components have intrinsic width.
     *
     * Corollary for anyone adding a story: if it only looks right centered, the
     * component probably has no responsive width strategy, and THAT is the bug.
     */
    layout: 'padded',
    options: {
      storySort: {
        // `Welcome` first so the root URL deep-links to the landing page
        // instead of `Tokens/Color Contrast/Docs` (alphabetic default).
        order: [
          'Welcome',
          // Reader-facing explainers (what the system guarantees and why),
          // ahead of `Philosophy` — which is the raw contract corpus those
          // pages cite. Concepts is the front door; Philosophy is the source.
          'Concepts',
          [
            'Responsiveness',
            'Layout',
            'Color & Theming',
            'Accessibility',
            'Loading & Motion',
            'Versioning',
          ],
          'Philosophy',
          // `Foundations`, `Charts` and `Templates` were all UNLISTED, so they
          // sorted to the bottom in arbitrary order and a reader reached
          // MagicUI ornaments before the type scale. Vocabulary (foundations,
          // tokens) precedes the components that spend it; our own layers
          // precede third-party decoration.
          'Foundations',
          'Tokens',
          ['Color Contrast'],
          // The non-component registry items. `Utilities` is the `registry:lib`
          // tier (cn, the two hooks, the theme manifest and bootstrap);
          // `Contracts` is the pure `.ts` modules that a component spends but
          // that render nothing themselves (variant catalogues, the absence
          // vocabulary, the meter arithmetic). Both sit here — after the
          // vocabulary, before the components — because that is what they are:
          // shared language, not parts.
          'Utilities',
          'Contracts',
          'Primitives',
          'Blocks',
          'Charts',
          'Templates',
          'Pages',
          // Meta-installs, so they come after everything they pull in.
          'Starters',
          'Fumadocs',
          'MagicUI',
        ],
      },
    },
  },
  /**
   * `manual` moved from `parameters.a11y` to GLOBALS in Storybook 10. Left in
   * parameters it is silently ignored — the addon then falls back to its own
   * default (`manual: false`), so the practical effect is nil, but stating it
   * here keeps the intent explicit and survives an upstream default flip.
   *
   * FIXED — see the back-fill block in `.storybook/manager.ts`. This note is
   * kept because the diagnosis it records is right and the conclusion it drew
   * was wrong; the wrong conclusion is what kept the panel broken.
   *
   * The behaviour was: on a HARD page load the panel sat on "Preparing
   * accessibility scan…" permanently — not just for the first story, for every
   * story, because the panel never subscribes until its tab is activated and
   * nothing re-delivers what it missed. It was written off below as upstream
   * panel behaviour that is merely cosmetic. It was not cosmetic: it meant NO
   * story was ever axe-scanned in the dev UI while this file advertises a
   * strict WCAG 2.2 AA + ACT gate, which is a false claim about the product.
   * The scan itself always ran correctly — the result was simply dropped on
   * the floor of the manager channel, and `channel.last(STORY_FINISHED)` had
   * it the whole time.
   *
   * The original note read: "on a HARD page load the panel can sit on
   * 'Preparing accessibility scan…'. The panel only leaves that state on a
   * `STORY_FINISHED` it is mounted to receive, so a scan that completed before
   * the panel mounted is never back-filled. Any story navigation or a 'Reload
   * story' click scans immediately. This is upstream panel behaviour, NOT a
   * misconfiguration here."
   *
   * Every mechanical sentence there is accurate. "Upstream, therefore ours to
   * live with" is the part that was wrong: upstream drops the result, but the
   * channel retains it, so the manager can hand it back. It is also why "any
   * story navigation scans immediately" was reassuring and shouldn't have
   * been — navigation works precisely because the panel is subscribed BY then,
   * which is the tell that the first story was never scanned at all.
   */
  initialGlobals: {
    // Run on story visit rather than on a button press. `manual` moved from
    // `parameters.a11y` to globals in Storybook 10; left in parameters it is
    // silently ignored.
    a11y: { manual: false },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
      // CRITICAL for a11y contrast scoring: by default the addon puts the
      // theme class on a story-wrapper <div>, which means `body` resolves
      // `var(--background)` from `:root` (light) instead of `.dark`. axe
      // then scores dark-mode foreground (`#ededf2`) against the unchanged
      // white body and every dark story fails with contrast ~1.1:1.
      // Lifting the class to `<html>` makes `body { background-color:
      // var(--background) }` see the `.dark`-scoped token, painting the
      // iframe body near-black and giving axe the correct backdrop.
      parentSelector: 'html',
    }),
    /**
     * The THEME axis (`data-theme`), orthogonal to the scheme axis the
     * decorator above owns (`.dark`).
     *
     * Written to `<html>` for the same reason the class is: the brand tokens
     * are declared on the root, and `--primary: var(--interlace-primary)` is
     * substituted on the element that declares it — so an attribute on a
     * story-wrapper div changes the brand values and repaints nothing.
     *
     * The default theme writes NO attribute: `:root` already is that theme
     * (see packages/ui/src/lib/use-theme.ts for the same rule at runtime).
     */
    (Story, context) => {
      const theme = context.globals.interlaceTheme as string | undefined;
      const html = document.documentElement;
      if (!theme || theme === 'interlace') html.removeAttribute('data-theme');
      else html.setAttribute('data-theme', theme);
      return Story();
    },
  ],
  globalTypes: {
    interlaceTheme: {
      description: 'Interlace brand theme (data-theme)',
      defaultValue: 'interlace',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        dynamicTitle: true,
        items: [
          { value: 'interlace', title: 'Interlace' },
          { value: 'harbor', title: 'Harbor' },
        ],
      },
    },
  },
  // No global `autodocs` tag. With autodocs on, every component's sidebar
  // entry becomes "Docs" as the default child, and the Docs view doesn't
  // render the Controls / Actions / Interactions / Accessibility bottom
  // panels — those are Canvas-only. Removing the tag means clicking a
  // component takes the user straight to its first story (Canvas view)
  // where every addon panel + populated Controls table is visible.
  // Stories that genuinely want an auto-generated docs page can opt in
  // per-meta via `tags: ['autodocs']`. MDX-driven docs (Welcome.mdx,
  // tokens/ColorContrast.stories.tsx) remain unaffected.
};

export default preview;
