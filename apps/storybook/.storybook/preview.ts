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
      // Strict tag stack — matches apps/docs/e2e/a11y.spec.ts and the
      // test-runner gate. Keep these in sync: any tag added here must also
      // be added to apps/storybook/.storybook/test-runner.ts STRICT_TAGS.
      element: '#storybook-root',
      config: {
        rules: [
          // AAA-only rules get pulled in by their `ACT` tag (see
          // test-runner.ts AAA_RULES_DISABLED). Floor is WCAG 2.2 AA.
          { id: 'color-contrast-enhanced', enabled: false },
          // Per-story overrides go in `parameters.a11y.config.rules`.
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
      manual: false,
    },
    layout: 'centered',
    options: {
      storySort: {
        // `Welcome` first so the root URL deep-links to the landing page
        // instead of `Tokens/Color Contrast/Docs` (alphabetic default).
        order: [
          'Welcome',
          'Philosophy',
          'Tokens',
          ['Color Contrast'],
          'Primitives',
          'Blocks',
          'Pages',
          'Fumadocs',
          'MagicUI',
        ],
      },
    },
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
  ],
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
