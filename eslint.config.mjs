/**
 * Minimal flat-config ESLint root for the Interlace community repo.
 *
 * Each workspace is free to layer its own config on top — apps/storybook,
 * apps/landing, and packages/ui each ship their own `eslint.config.mjs`
 * with framework-specific overrides (next, storybook, react).
 *
 * Today this root config registers the project-wide ignores only; the
 * `componentApi` preset that polices R1–R26 (from eslint-plugin-react-features
 * in the ofri-peretz/eslint repo) is opted into per-package, only where it
 * applies (packages/ui).
 */
export default [
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/storybook-static/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
    ],
  },
];
