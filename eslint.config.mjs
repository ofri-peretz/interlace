/**
 * Root ESLint flat-config for the Interlace community repo.
 *
 * Layers:
 *  1. Global ignores — dist, .next, turbo cache, etc.
 *  2. eslint-plugin-react-a11y recommended — WCAG 2.1 A/AA gates on all TSX.
 *  3. eslint-plugin-react-features recommended — React best-practice / perf /
 *     security rules on all TSX.
 *
 * Each workspace may still layer its own config on top for framework-specific
 * overrides (next, storybook, react), but these root rules apply everywhere.
 *
 * NOTE: eslint-plugin-react-features componentApi preset (R5/R6/R8/R11/R12/
 * R18/R19 from the interlace-component skill) is not yet published to npm.
 * Add it here as block 4 once the next react-features release ships those
 * rules: `{ ...reactFeatures.configs.componentApi, files: ['packages/ui/**\/*.tsx'] }`.
 */

import reactA11y from 'eslint-plugin-react-a11y';
import reactFeatures from 'eslint-plugin-react-features';

/** All TSX files across apps and packages (excluding build artefacts). */
const TSX_FILES = ['apps/**/*.tsx', 'packages/**/*.tsx'];

export default [
  // ── 1. Global ignores ──────────────────────────────────────────────────────
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

  // ── 2. Accessibility (react-a11y recommended) ──────────────────────────────
  // configs.recommended already includes the plugin registration.
  // We override `files` so this config only runs on TSX, not JS/TS utilities.
  {
    ...reactA11y.configs.recommended,
    files: TSX_FILES,
  },

  // ── 3. React best-practices (react-features recommended) ───────────────────
  {
    ...reactFeatures.configs.recommended,
    files: TSX_FILES,
  },
];
