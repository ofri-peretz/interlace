import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../src/stories/**/*.mdx',
    '../src/stories/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'],
  // Override Storybook's default pink Storybook S favicon with the
  // Interlace brand mark. `public/favicon.svg` is copied
  // verbatim by `staticDirs`; this just rewrites the <link> tag in the
  // manager HTML so the browser tab + bookmark icon match the brand.
  managerHead: (head) =>
    head.replace(
      /<link rel="icon"[^>]*>/,
      '<link rel="icon" type="image/svg+xml" href="./favicon.svg" />',
    ) + '<link rel="icon" type="image/svg+xml" href="./favicon.svg" />',
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  core: {
    disableTelemetry: true,
  },
  /**
   * Keep build artefacts out of the dev server's watcher.
   *
   * `storybook build` writes into `storybook-static/`, which sits inside the
   * Vite root — so running a build while `storybook dev` is up fires a full
   * `page reload` for every file it emits. That is not cosmetic: a reload
   * landing mid-`play` kills the interaction, and the story is left in
   * whatever state it had reached. It reads as a component bug (an overlay
   * that "won't close on Escape") rather than as a reload, because the
   * assertion that fails is the one after the keypress that never arrived.
   *
   * Cost of getting this wrong is high and the symptom does not point here,
   * so ignore the artefact dirs outright. Nothing under them is a source
   * file — `stories` only globs `../src/stories`.
   */
  viteFinal: async (config) => {
    config.server ??= {};
    config.server.watch ??= {};
    const existing = config.server.watch.ignored;
    config.server.watch.ignored = [
      ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
      '**/storybook-static/**',
      '**/dist/**',
      '**/coverage/**',
    ];
    return config;
  },
};

export default config;
