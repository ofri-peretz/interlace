/**
 * Wordmark: Label in Name (WCAG 2.5.3), checked by axe with `label-content-name-mismatch`
 * switched on (it is an experimental rule, off by default in some axe versions).
 *
 * The lockup prints three lines. A link named by a string that lacks them fails; the two
 * documented forms pass. The failing case asserts the failure, so an axe change that stops
 * catching the mistake turns this file red.
 */
import { render } from '@testing-library/react';
import axe from 'axe-core';
import { beforeAll, describe, expect, it } from 'vitest';

import { Wordmark } from '../src/patterns/wordmark.js';

const scripts = (
  <>
    <Wordmark.Line lang="en">ACME</Wordmark.Line>
    <Wordmark.Line lang="ja">アクメ</Wordmark.Line>
    <Wordmark.Line lang="ar" dir="rtl">
      أكمي
    </Wordmark.Line>
  </>
);

const RULE = 'label-content-name-mismatch';

// axe tells an icon-font ligature from text by drawing it on a canvas, which jsdom lacks. With a
// threshold of 0 it decides "not a ligature" before it draws, so the text is read as text.
const CHECKS = { [RULE]: { options: { occurrenceThreshold: 0 } } } as unknown as axe.Checks;

async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'rule', values: [RULE, 'link-name'] },
    rules: { [RULE]: { enabled: true } },
    checks: CHECKS,
  });
  return results.violations.map((v) => v.id);
}

beforeAll(() => {
  // axe still asks for a canvas context; jsdom has none, so hand it an empty one.
  HTMLCanvasElement.prototype.getContext = (() => ({ canvas: {} })) as unknown as HTMLCanvasElement['getContext'];
});

describe('Wordmark: label in name', () => {
  it('has the rule switched on and applicable, so a pass means something', async () => {
    const { container } = render(
      <Wordmark href="/" label="ACME アクメ أكمي, home">
        {scripts}
      </Wordmark>,
    );
    const results = await axe.run(container, {
      runOnly: { type: 'rule', values: [RULE] },
      rules: { [RULE]: { enabled: true } },
      checks: CHECKS,
    });
    expect(results.passes.map((p) => p.id)).toContain(RULE);
  });

  it('passes with no label: the link is named by its lines, plus the hint', async () => {
    const { container } = render(
      <Wordmark href="/" hint=", home">
        {scripts}
      </Wordmark>,
    );
    expect(await violations(container)).toEqual([]);
  });

  it('passes with a label that contains all the lines', async () => {
    const { container } = render(
      <Wordmark href="/" label="ACME アクメ أكمي, home">
        {scripts}
      </Wordmark>,
    );
    expect(await violations(container)).toEqual([]);
  });

  it('passes a tagline wordmark whose label contains both lines', async () => {
    const { container } = render(
      <Wordmark href="/" label="Acme Field notes, home">
        <Wordmark.Line lang="en">ACME</Wordmark.Line>
        <Wordmark.Line lang="en">Field notes</Wordmark.Line>
      </Wordmark>,
    );
    expect(await violations(container)).toEqual([]);
  });

  it('fails with one translated label over three scripts', async () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      const { container } = render(
        <Wordmark href="/" label="Acme, home">
          {scripts}
        </Wordmark>,
      );
      expect(await violations(container)).toEqual([RULE]);
    } finally {
      console.warn = warn;
    }
  });
});
