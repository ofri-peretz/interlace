/**
 * Analytics Synthetic-Hatch Lock
 *
 * The `navigator.webdriver` guard drops automated traffic. Without an opt-in
 * hatch there is no way to prove capture still works end-to-end — a scripted
 * check cannot answer "are events still flowing?", which is exactly the
 * question that matters when something is broken.
 *
 * This locks the three halves together, because any one alone is a bug:
 *   1. the hatch exists,
 *   2. the guard actually consults it,
 *   3. events let through are MARKED `is_synthetic` so they stay filterable.
 *
 * Dropping (3) would silently mix scripted traffic into real numbers — the
 * problem the webdriver guard was added to solve in the first place.
 *
 * Assertions are anchored to code shapes that cannot occur in the surrounding
 * prose, so a doc comment can never satisfy them.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

const APP_ROOT = resolve(__dirname, '../..');
const TARGET = join(APP_ROOT, 'src/lib/posthog-init.ts');

describe('analytics: synthetic-monitoring hatch', () => {
  let src: string;
  beforeAll(() => {
    src = readFileSync(TARGET, 'utf-8');
  });

  it('defines the webdriver guard', () => {
    expect(src).toMatch(/^function isAutomatedBrowser\(\): boolean \{$/m);
    expect(src).toMatch(/navigator\.webdriver === true;/);
  });

  it('defines the synthetic-check hatch', () => {
    expect(src).toMatch(/^function isSyntheticCheck\(\): boolean \{$/m);
    expect(src).toMatch(
      /localStorage\.getItem\('interlace_synthetic_check'\) === '1'/,
    );
  });

  it('the guard consults the hatch (not a bare webdriver drop)', () => {
    expect(src).toMatch(
      /^\s*if \(isAutomatedBrowser\(\) && !isSyntheticCheck\(\)\) return false;$/m,
    );
    // A bare drop would make the hatch dead code.
    expect(src).not.toMatch(/^\s*if \(isAutomatedBrowser\(\)\) return false;$/m);
  });

  it('marks synthetic events so they stay filterable', () => {
    expect(src).toMatch(
      /if \(isSyntheticCheck\(\)\) ph\.register\(\{ is_synthetic: true \}\);/,
    );
  });
});
