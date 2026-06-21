/**
 * Root ESLint flat-config for the Interlace community repo.
 *
 * Interlace ecosystem — à-la-carte dogfooding. Each plugin is wired separately
 * via its OWN `recommended` preset (NOT the @interlace/eslint-config meta-config).
 *
 * Layers:
 *  1. Global ignores — dist, .next, turbo cache, oxlint shim tooling, etc.
 *  2. react-a11y recommended — WCAG 2.1 A/AA gates on all TSX (pre-existing).
 *  3. react-features recommended — React best-practice / perf / security on TSX
 *     (pre-existing; left as interlace already wires it).
 *  4. À-la-carte security + quality presets (8 plugins with a working flat
 *     `configs.recommended` we spread as-is):
 *       security: browser-security, secure-coding, node-security
 *       quality:  conventions, import-next, modernization, modularity, reliability
 *  5. Hand-wired maintainability + operability — these two ship a BROKEN
 *     published `recommended` (doubled-namespace / categorized rule names flat
 *     config can't resolve), so their rules are listed explicitly.
 *  6. Baseline (non-blocking) — first-run interlace ERRORs downgraded to `warn`
 *     so PRs aren't blocked on pre-existing findings. Ratchet to `error` as the
 *     codebase is cleaned. See agents memory: eslint-dogfooding-doctrine.
 *
 * Each workspace may still layer its own config on top for framework-specific
 * overrides (next, storybook, react), but these root rules apply everywhere.
 *
 * NOTE: eslint-plugin-react-features componentApi preset (R5/R6/R8/R11/R12/
 * R18/R19 from the interlace-component skill) is not yet published to npm.
 * Add it once the next react-features release ships those `componentApi/*`
 * rules: `{ ...reactFeatures.configs.componentApi, files: ['packages/ui/**\/*.tsx'] }`.
 */

import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

import reactA11y from 'eslint-plugin-react-a11y';
import reactFeatures from 'eslint-plugin-react-features';

// À-la-carte clean presets — spread each plugin's OWN flat recommended.
import { configs as browserSecurityCfg } from 'eslint-plugin-browser-security';
import { configs as secureCodingCfg } from 'eslint-plugin-secure-coding';
import { configs as nodeSecurityCfg } from 'eslint-plugin-node-security';
import { configs as conventionsCfg } from 'eslint-plugin-conventions';
import { configs as importNextCfg } from 'eslint-plugin-import-next';
import { configs as modernizationCfg } from 'eslint-plugin-modernization';
import { configs as modularityCfg } from 'eslint-plugin-modularity';
import { configs as reliabilityCfg } from 'eslint-plugin-reliability';

// Default imports — hand-wired below (broken published `recommended`).
import maintainability from 'eslint-plugin-maintainability';
import operability from 'eslint-plugin-operability';

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
      // Synced from interlace/docs-baseline (agents repo) — auto-generated,
      // fix upstream, not here. Mirrors the blog's `.interlace/**` carve-out.
      '**/.interlace/**',
      // oxlint JS-plugin shims — CJS tooling, not app source (legit `require`).
      '**/tools/oxlint-plugins/**',
    ],
  },

  // ── 1b. TypeScript parser ──────────────────────────────────────────────────
  // The interlace plugins (react-a11y, react-features, the security/quality
  // presets) all run against TS/TSX. Without a TS-aware parser eslint chokes on
  // `as`, generics, type-only syntax. We use the non-type-checked parser (no
  // `project` service) — fast, and sufficient for every rule we wire here.
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    // Register the @typescript-eslint plugin (parser + rule namespace) without
    // turning any of its rules on — this keeps pre-existing inline
    // `eslint-disable @typescript-eslint/*` directives in real source valid.
    plugins: { '@typescript-eslint': tsPlugin },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },

  // ── 2. Accessibility (react-a11y recommended) ──────────────────────────────
  // configs.recommended already includes the plugin registration.
  // We override `files` so this config only runs on TSX, not JS/TS utilities.
  {
    ...reactA11y.configs.recommended,
    files: TSX_FILES,
  },

  // ── 3. React best-practices (react-features) ───────────────────────────────
  // react-features ships a BROKEN published `recommended` (rule names like
  // `@eslint/react-features/react/jsx-key` that flat config can't resolve and
  // which crash the whole run), so it is hand-wired with explicit flat names.
  {
    files: TSX_FILES,
    plugins: { 'react-features': reactFeatures },
    rules: {
      'react-features/jsx-key': 'error',
      'react-features/no-children-prop': 'warn',
      'react-features/no-danger': 'warn',
      'react-features/no-string-refs': 'error',
      'react-features/no-unknown-property': 'warn',
      'react-features/hooks-exhaustive-deps': 'warn',
      'react-features/jsx-no-target-blank': 'error',
      'react-features/jsx-no-script-url': 'error',
      'react-features/jsx-no-duplicate-props': 'error',
      'react-features/no-danger-with-children': 'error',
      'react-features/no-deprecated': 'warn',
      'react-features/no-unnecessary-rerenders': 'warn',
      'react-features/react-render-optimization': 'warn',
    },
  },

  // ── 4. À-la-carte security + quality recommended presets ───────────────────
  browserSecurityCfg.recommended,
  secureCodingCfg.recommended,
  nodeSecurityCfg.recommended,
  conventionsCfg.recommended,
  importNextCfg.recommended,
  modernizationCfg.recommended,
  modularityCfg.recommended,
  reliabilityCfg.recommended,

  // ── 5. Hand-wired: maintainability + operability (broken published recommended)
  {
    plugins: { maintainability, operability },
    rules: {
      'maintainability/cognitive-complexity': 'warn',
      'maintainability/identical-functions': 'warn',
      'maintainability/max-parameters': 'warn',
      'operability/no-console-log': 'warn',
      'operability/no-debug-code-in-production': 'warn',
      'operability/no-verbose-error-messages': 'warn',
    },
  },

  // ── 6. Baseline (non-blocking) ─────────────────────────────────────────────
  // First-run interlace backlog stays at `warn` so PRs aren't blocked on
  // pre-existing findings — run both linters every PR without the friction.
  // Every rule below is an interlace rule that actually fired at ERROR level on
  // the first full run (eslint apps packages); each is downgraded to `warn`.
  // Ratchet each back to `error` as the codebase is cleaned.
  // See agents memory: eslint-dogfooding-doctrine ("baseline-then-ratchet").
  //
  // NOTE: `import-next/no-unresolved` fires ~311× purely as resolver noise —
  // the design-system sources use extensionful ESM relative imports
  // (`'../primitives/button.js'`, the compiled path) which the plugin's default
  // resolver can't map back to the on-disk `.ts`. Warn until a TS-aware import
  // resolver is wired; not a real backlog.
  {
    rules: {
      'import-next/no-unresolved': 'warn',
      'import-next/no-duplicates': 'warn',
      'import-next/no-self-import': 'warn',
      'modularity/no-external-api-calls-in-utils': 'warn',
      'browser-security/detect-mixed-content': 'warn',
      'browser-security/no-http-urls': 'warn',
      'browser-security/no-clickjacking': 'warn',
      'secure-coding/no-hardcoded-credentials': 'warn',
      'secure-coding/no-improper-sanitization': 'warn',
      'secure-coding/no-xpath-injection': 'warn',
      'node-security/no-math-random-crypto': 'warn',
      'node-security/no-ssrf': 'warn',
      'reliability/require-network-timeout': 'warn',
    },
  },
  // TSX-scoped baseline (react-a11y + react-features ERRORs → warn).
  {
    files: TSX_FILES,
    rules: {
      'react-features/jsx-key': 'warn',
      'react-features/jsx-no-target-blank': 'warn',
      'react-a11y/role-supports-aria-props': 'warn',
      'react-a11y/click-events-have-key-events': 'warn',
      'react-a11y/interactive-supports-focus': 'warn',
      'react-a11y/alt-text': 'warn',
      'react-a11y/anchor-has-content': 'warn',
      'react-a11y/heading-has-content': 'warn',
    },
  },
];
