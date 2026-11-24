// @vitest-environment node
/**
 * truepass dogfood lock.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * truepass keeps a green suite honest: a focused test, a skip with no reason,
 * a fixed sleep or a retry fails lint, and `truepass diff` fails a push that
 * moves an assertion to a weaker matcher or rewrites a snapshot without saying
 * why. That only holds while it is wired:
 *
 *   1. the root ESLint config turns `truepass.recommended` on, at error, for
 *      every workspace's test files (asked of ESLint itself, not a regex);
 *   2. each workspace's `eslint-suppressions.json` holds truepass findings
 *      only, so the ratchet cannot quietly hide another rule, and no lint
 *      script opts out of failing on a stale suppression;
 *   3. pre-push runs `truepass diff` against origin/main, through the hookset
 *      preset's test-integrity station (`hook:test-integrity`);
 *   4. `truepass` is a root devDependency on the 1.x line.
 *
 * Each assertion below goes red if one of those is unwired.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');
const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

const WORKSPACES = [
  'apps/landing',
  'apps/registry',
  'apps/storybook',
  'packages/cli',
  'packages/ui',
] as const;

const RULES = [
  'truepass/no-fixed-sleep',
  'truepass/no-focused-test',
  'truepass/no-test-retry',
  'truepass/no-unexplained-skip',
] as const;

/** A test file from every workspace, in each shape TEST_FILES matches (`*.test.*`, `*.spec.*`, `__tests__/`). */
const TEST_FILES = [
  'packages/ui/__tests__/truepass-dogfood-lock.test.ts',
  'packages/ui/__tests__/flip-card.test.tsx',
  'apps/storybook/visual/a11y-matrix.spec.ts',
  'apps/landing/src/__tests__/gateway-lock.test.ts',
  'packages/cli/__tests__/plan.test.ts',
  'apps/registry/src/__tests__/description-lock.test.ts',
];

type Suppressions = Record<string, Record<string, { count: number }>>;

describe('truepass is dogfooded', () => {
  it('the ESLint config runs every truepass.recommended rule at error on test files', async () => {
    const eslint = new ESLint({ cwd: ROOT });
    for (const file of TEST_FILES) {
      const config = await eslint.calculateConfigForFile(join(ROOT, file));
      for (const rule of RULES) {
        const setting = config.rules?.[rule];
        const severity = Array.isArray(setting) ? setting[0] : setting;
        expect(severity, `${rule} is not at error for ${file}`).toBe(2);
      }
    }
  }, 60_000);

  it('the ESLint config imports the truepass preset', () => {
    const config = read('eslint.config.mjs');
    expect(config).toContain("import { configs as truepass } from 'truepass/eslint';");
    expect(config).toMatch(/\.\.\.truepass\.recommended,\s*\n\s*files: TEST_FILES,/);
  });

  it('every suppressions file holds truepass findings only, so it cannot hide another rule', () => {
    for (const workspace of WORKSPACES) {
      const file = join(ROOT, workspace, 'eslint-suppressions.json');
      if (!existsSync(file)) continue;
      const suppressions = JSON.parse(readFileSync(file, 'utf8')) as Suppressions;
      const rules = new Set(Object.values(suppressions).flatMap((byRule) => Object.keys(byRule)));
      for (const rule of rules) {
        expect(rule.startsWith('truepass/'), `${workspace}/eslint-suppressions.json holds ${rule}`).toBe(true);
      }
    }
  });

  it('each workspace lints from its own directory, where its suppressions file lives, and fails on stale ones', () => {
    for (const workspace of WORKSPACES) {
      const pkg = JSON.parse(read(`${workspace}/package.json`)) as { scripts: Record<string, string> };
      expect(pkg.scripts['lint:eslint'], `${workspace} lint:eslint`).toBe('eslint .');
    }
  });

  it('pre-push runs truepass diff against origin/main, as the hookset test-integrity station', () => {
    // The pinned hookset pre-push preset runs `npm run --if-present hook:test-integrity`;
    // the script is what makes that station do something.
    expect(read('lefthook.yml')).toContain('packages/hookset/presets/lefthook/pre-push.yml');
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['hook:test-integrity']).toBe('truepass diff --base origin/main');
  });

  it('truepass is a root devDependency on the 1.x line', () => {
    const pkg = JSON.parse(read('package.json')) as { devDependencies: Record<string, string> };
    expect(pkg.devDependencies['truepass']).toMatch(/^\^1\./);
  });
});
