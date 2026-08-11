/**
 * The absence vocabulary — the part that can be proved.
 *
 * `data-state-model.ts` sits in `src/primitives/`, which is outside the
 * `src/charts/**` + `src/lib/**` coverage glob, so v8 will not fail the build
 * if a branch here goes unexecuted. It is written to the 100% standard anyway:
 * precedence is the kind of rule that is trivially "obviously right" in review
 * and wrong in production, and the whole component family resolves through it.
 *
 * It cannot live in `src/lib/` — a `../lib/` import that is not a declared
 * LIB_FILE survives unrewritten into the registry item and makes every
 * component that imports it silently uninstallable via `npx shadcn add`.
 */

import { describe, expect, it } from 'vitest';

import {
  announceDataState,
  DATA_STATES,
  DATA_STATE_PRESENTATION,
  HATCH_CLASS,
  HATCH_CLASS_FAINT,
  presentationFor,
  QUALIFYING_STATES,
  REPLACING_STATES,
  replacesBody,
  resolveDataState,
  type DataStateFlags,
  type DataStateName,
} from '../src/primitives/data-state-model.js';

const ABSENCES = DATA_STATES.filter((s) => s !== 'idle');

describe('the union', () => {
  it('carries exactly the eight absences plus idle', () => {
    expect([...DATA_STATES]).toEqual([
      'loading',
      'error',
      'not-applicable',
      'not-counted',
      'empty',
      'partial',
      'truncated',
      'first-measurement',
      'idle',
    ]);
  });

  it('partitions every absence into replacing or qualifying, never both', () => {
    for (const state of ABSENCES) {
      const replaces = REPLACING_STATES.has(state);
      const qualifies = QUALIFYING_STATES.has(state);
      expect(replaces || qualifies, `${state} belongs to neither set`).toBe(true);
      expect(replaces && qualifies, `${state} belongs to both sets`).toBe(false);
    }
  });

  it('leaves `idle` out of both sets — it is the absence of absence', () => {
    expect(REPLACING_STATES.has('idle')).toBe(false);
    expect(QUALIFYING_STATES.has('idle')).toBe(false);
    expect(replacesBody('idle')).toBe(false);
  });

  it('agrees with `replacesBody` for every member', () => {
    for (const state of DATA_STATES) {
      expect(replacesBody(state)).toBe(REPLACING_STATES.has(state));
    }
  });
});

describe('precedence', () => {
  /** Set every flag, then remove one at a time to walk down the order. */
  const ALL: Required<Omit<DataStateFlags, 'error'>> & { error: unknown } = {
    loading: true,
    error: new Error('boom'),
    notApplicable: true,
    notCounted: true,
    empty: true,
    partial: true,
    truncated: true,
    firstMeasurement: true,
  };

  it('is the array order — every flag on resolves to `loading`', () => {
    expect(resolveDataState(ALL).state).toBe('loading');
    expect(resolveDataState(ALL).active).toEqual([...ABSENCES]);
  });

  it('walks down the order as each winner is removed', () => {
    const order: [keyof DataStateFlags, DataStateName][] = [
      ['loading', 'loading'],
      ['error', 'error'],
      ['notApplicable', 'not-applicable'],
      ['notCounted', 'not-counted'],
      ['empty', 'empty'],
      ['partial', 'partial'],
      ['truncated', 'truncated'],
      ['firstMeasurement', 'first-measurement'],
    ];
    const flags: DataStateFlags = { ...ALL };
    for (const [key, expected] of order) {
      expect(resolveDataState(flags).state).toBe(expected);
      delete flags[key];
    }
    expect(resolveDataState(flags).state).toBe('idle');
  });

  // The two rules the phase-10 audit named by name.
  it('error beats empty — a failed fetch is not "nothing found"', () => {
    const resolved = resolveDataState({ error: 'ECONNRESET', empty: true });
    expect(resolved.state).toBe('error');
    expect(resolved.qualifiers).toContain('empty');
  });

  it('truncated is not empty, and does not replace the body', () => {
    const resolved = resolveDataState({ truncated: true });
    expect(resolved.state).toBe('truncated');
    expect(resolved.replaces).toBe(false);
    expect(resolved.state).not.toBe('empty');
  });

  it('ranks partial above truncated — an unreported source is invisible', () => {
    expect(resolveDataState({ partial: true, truncated: true }).state).toBe(
      'partial',
    );
  });

  it('ranks not-applicable above every other absence but error', () => {
    expect(
      resolveDataState({ notApplicable: true, notCounted: true, empty: true })
        .state,
    ).toBe('not-applicable');
    expect(
      resolveDataState({ notApplicable: true, error: true }).state,
    ).toBe('error');
  });
});

describe('resolveDataState', () => {
  it('returns idle with no flags at all', () => {
    const resolved = resolveDataState();
    expect(resolved).toEqual({
      state: 'idle',
      active: ['idle'],
      qualifiers: [],
      replaces: false,
      announcement: '',
    });
  });

  it('returns idle for an all-false flag bag', () => {
    expect(
      resolveDataState({ loading: false, error: null, empty: false }).state,
    ).toBe('idle');
  });

  it('keeps every loser as a qualifier rather than dropping it', () => {
    const resolved = resolveDataState({
      partial: true,
      truncated: true,
      firstMeasurement: true,
    });
    expect(resolved.state).toBe('partial');
    expect(resolved.qualifiers).toEqual(['truncated', 'first-measurement']);
  });

  it('reports `replaces` from the winner, not from the qualifiers', () => {
    expect(resolveDataState({ empty: true, truncated: true }).replaces).toBe(
      true,
    );
    expect(resolveDataState({ truncated: true, empty: false }).replaces).toBe(
      false,
    );
  });

  it('concatenates the winner sentence and every qualifier sentence', () => {
    const { announcement } = resolveDataState(
      { partial: true, truncated: true },
      { shown: 10, coverage: '4 of 9 sources reported' },
    );
    expect(announcement).toBe(
      'Partial coverage: 4 of 9 sources reported. Every count is a floor, not a total. ' +
        'Truncated list: showing 10 of an unknown total. Do not use this as a denominator.',
    );
  });

  it('treats any truthy error value as an error', () => {
    expect(resolveDataState({ error: new Error('x') }).state).toBe('error');
    expect(resolveDataState({ error: 'x' }).state).toBe('error');
    expect(resolveDataState({ error: 0 }).state).toBe('idle');
    expect(resolveDataState({ error: undefined }).state).toBe('idle');
  });
});

describe('announcements', () => {
  it('gives every absence a non-empty sentence with no options at all', () => {
    for (const state of ABSENCES) {
      expect(announceDataState(state), state).not.toBe('');
    }
  });

  it('ends every sentence with a full stop', () => {
    for (const state of ABSENCES) {
      expect(announceDataState(state).endsWith('.'), state).toBe(true);
    }
  });

  it('says nothing for idle', () => {
    expect(announceDataState('idle')).toBe('');
  });

  it('states that not-counted is not a zero', () => {
    // The distinction the hatch exists to draw. Without this clause a
    // listener has no way to separate an unmeasured cell from a measured 0,
    // which would keep the meaning for sighted readers and destroy it for
    // everyone else.
    expect(announceDataState('not-counted')).toMatch(/not a zero/i);
  });

  it('says a truncated list is not a denominator', () => {
    expect(announceDataState('truncated')).toMatch(/denominator/i);
    expect(announceDataState('truncated', { shown: 10 })).toMatch(/denominator/i);
  });

  it('says a partial count is a floor', () => {
    expect(announceDataState('partial')).toMatch(/floor/i);
    expect(announceDataState('partial', { coverage: '2 of 5' })).toMatch(/floor/i);
  });

  it('says a first measurement has no prior', () => {
    expect(announceDataState('first-measurement')).toMatch(/no prior/i);
  });

  it('folds the noun into loading, error and empty', () => {
    expect(announceDataState('loading', { noun: 'articles' })).toBe(
      'Loading articles.',
    );
    expect(announceDataState('empty', { noun: 'articles' })).toBe(
      'No articles.',
    );
    expect(announceDataState('error', { noun: 'articles' })).toBe(
      'Articles could not be loaded.',
    );
  });

  it('capitalises the noun at the head of the error sentence', () => {
    expect(announceDataState('error')).toBe('Data could not be loaded.');
    expect(announceDataState('error', { noun: '' })).toBe(' could not be loaded.');
  });

  it('folds the reason into not-applicable and falls back without one', () => {
    expect(announceDataState('not-applicable', { reason: 'no test suite' })).toBe(
      'Not applicable: no test suite.',
    );
    expect(announceDataState('not-applicable')).toMatch(/^Not applicable\./);
  });

  it('localises the shown count in a truncated list', () => {
    expect(announceDataState('truncated', { shown: 12345 })).toContain(
      (12345).toLocaleString(),
    );
  });

  it('distinguishes shown: 0 from an omitted shown', () => {
    // `shown === 0` is a real, reportable number; a `??` fallback here would
    // silently turn it into the generic sentence.
    expect(announceDataState('truncated', { shown: 0 })).toContain('showing 0');
    expect(announceDataState('truncated')).not.toContain('showing');
  });
});

describe('presentation', () => {
  it('covers every member of the union', () => {
    for (const state of DATA_STATES) {
      expect(DATA_STATE_PRESENTATION[state], state).toBeDefined();
      expect(presentationFor(state)).toBe(DATA_STATE_PRESENTATION[state]);
    }
  });

  it('hatches exactly the two states where no run happened', () => {
    const hatched = DATA_STATES.filter((s) => presentationFor(s).hatch);
    expect(hatched).toEqual(['not-applicable', 'not-counted']);
  });

  it('dashes exactly the three "not yet real" states', () => {
    const dashed = DATA_STATES.filter((s) => presentationFor(s).dashed);
    expect(dashed).toEqual(['partial', 'truncated', 'first-measurement']);
  });

  it('gives the accent to first-measurement alone — the one a reader can act on', () => {
    const accented = DATA_STATES.filter(
      (s) => presentationFor(s).emphasis === 'accent',
    );
    expect(accented).toEqual(['first-measurement']);
  });

  it('recedes not-applicable and alarms only on error', () => {
    expect(presentationFor('not-applicable').emphasis).toBe('recede');
    expect(
      DATA_STATES.filter((s) => presentationFor(s).emphasis === 'danger'),
    ).toEqual(['error']);
  });

  it('puts the matching hatch on each hatched state — on the swatch, not the chip', () => {
    expect(presentationFor('not-counted').swatch).toContain(HATCH_CLASS);
    expect(presentationFor('not-applicable').swatch).toContain(
      HATCH_CLASS_FAINT,
    );
  });

  it('never paints the hatch behind the chip text', () => {
    // The first browser pass did exactly this and the diagonals ran through
    // "not counted". Neither axe nor jsdom can see it.
    for (const state of DATA_STATES) {
      expect(presentationFor(state).chip, state).not.toContain(
        'repeating-linear-gradient',
      );
    }
  });

  it('gives a hatched state a swatch and no glyph, and vice versa', () => {
    for (const state of DATA_STATES) {
      const { hatch, swatch, glyph } = presentationFor(state);
      expect(Boolean(swatch), `${state}: swatch should track hatch`).toBe(hatch);
      if (swatch) expect(glyph, `${state}: two marks for one meaning`).toBe('');
    }
  });

  it('draws the hatch from --viz-axis, never the decorative --viz-grid', () => {
    // `--viz-grid` is documented at 1.37:1 and must never be the sole carrier
    // of a value. The reporting hatch IS the value, so it uses `--viz-axis`
    // (3.49:1 light / 3.83:1 dark) and clears SC 1.4.11.
    expect(HATCH_CLASS).toContain('var(--viz-axis)');
    expect(HATCH_CLASS_FAINT).toContain('var(--viz-grid)');
  });

  it('declares the border style in the class whenever `dashed` is true', () => {
    for (const state of DATA_STATES) {
      const presentation = presentationFor(state);
      if (!presentation.dashed) continue;
      expect(presentation.chip, state).toContain('border-dashed');
    }
  });

  it('gives every absence a visible short label', () => {
    for (const state of ABSENCES) {
      expect(presentationFor(state).short, state).not.toBe('');
    }
  });

  it('uses only token-backed colours — no raw hex, no palette scale', () => {
    for (const state of DATA_STATES) {
      expect(presentationFor(state).chip, state).not.toMatch(/#[0-9a-f]{3,8}/i);
      // e.g. `text-emerald-600` — the exact class that shipped at 3.65:1.
      expect(presentationFor(state).chip, state).not.toMatch(
        /\b(?:text|bg|border)-(?:red|green|blue|emerald|rose|amber|slate|zinc|gray|neutral)-\d{2,3}\b/,
      );
    }
  });
});
