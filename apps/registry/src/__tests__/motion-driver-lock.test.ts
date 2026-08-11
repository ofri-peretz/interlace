import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { motionFrom } from '../../scripts/build-agent-surface.mjs';

const INDEX = path.join(process.cwd(), 'public', 'data', 'agent-index.json');

type Item = {
  name: string;
  a11y: {
    motion: { driver: string; declaresPreference: boolean; stylesheetCannotReach: boolean };
  };
};

const load = async (): Promise<Item[]> =>
  JSON.parse(await readFile(INDEX, 'utf8')).items;

/**
 * A component whose motion is driven from JavaScript must at least know that
 * `prefers-reduced-motion` exists.
 *
 * The distinction this locks is the one that decides who is responsible.
 * `preflight.css` clamps `animation-duration` and `transition-duration` to
 * 0.01ms with `!important` on `*` under `reduce`, so a CSS-driven component is
 * covered whether or not it mentions the preference. Nothing in any stylesheet
 * reaches `motion/react`, `requestAnimationFrame` or a `setInterval` step — a
 * JS-driven component that never references the preference is ignoring the
 * user's operating-system setting outright, and no reset we ship can save it.
 *
 * **What this lock does NOT claim.** Referencing the preference is not the same
 * as honouring it everywhere. `animated-list` referenced it — it gated
 * auto-advance — while every entry still sprang in from `scale: 0` under
 * `reduce`. Text cannot decide that; only rendering under a mocked preference
 * can, which is what the per-component tests in `packages/ui/__tests__` are
 * for. This lock is the floor, deliberately: it catches the component that was
 * written without the preference in mind at all, which is the way the class
 * usually enters a codebase.
 *
 * It currently finds nothing, and that is the point of adding it now — a lock
 * written the day after the violation is a lock nobody has to argue about.
 */
describe('motion driver', () => {
  it('never ships JS-driven motion that has never heard of the preference', async () => {
    const offenders = (await load())
      .filter((i) => i.a11y.motion.stylesheetCannotReach && !i.a11y.motion.declaresPreference)
      .map((i) => i.name);
    expect(
      offenders,
      'these animate from JavaScript, which no stylesheet reset can reach, and never reference prefers-reduced-motion',
    ).toEqual([]);
  });

  it('classifies the driver from evidence, not from a name', () => {
    expect(motionFrom("import { motion } from 'motion/react';").driver).toBe('js');
    expect(motionFrom('<div className="animate-pulse" />').driver).toBe('css');
    expect(motionFrom('const x = 1;').driver).toBe('none');
    expect(
      motionFrom("import { motion } from 'motion/react';\n<div className='animate-pulse'/>").driver,
    ).toBe('both');
  });

  it('reports a reference to the preference as a reference, not as a guarantee', () => {
    // The exact shape that made the old boolean lie: the file knows about the
    // preference and still has an ungated animation inside it.
    const src = "import { useReducedMotion } from './use-reduced-motion.js';\nmotion.div";
    expect(motionFrom(src).declaresPreference).toBe(true);
    expect(motionFrom(src).stylesheetCannotReach).toBe(false); // no JS-motion evidence in this snippet
  });

  it('marks JS motion as out of reach of the stylesheet reset', () => {
    expect(motionFrom('requestAnimationFrame(tick)').stylesheetCannotReach).toBe(true);
    expect(motionFrom('<div className="animate-pulse" />').stylesheetCannotReach).toBe(false);
  });
});
