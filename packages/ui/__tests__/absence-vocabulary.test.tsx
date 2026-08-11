/**
 * DataState / StatStrip / Meter — the rendered contract.
 *
 * `data-state-model.test.ts` and `meter-scale.test.ts` prove the rules. This
 * proves what a reader actually receives, and specifically the half of it that
 * only exists for people who are not looking at the screen.
 *
 * The bar these are written to: **a hatch that exists only in pixels is worse
 * than no hatch at all.** It keeps the "no run happened" / "measured zero"
 * distinction for sighted readers and destroys it for everyone else. Axe would
 * score all of that green — it reads a `repeating-linear-gradient` as a
 * background and has no opinion about what a background means. So every
 * assertion below is either about the accessible name, or about a number the
 * component refused to invent.
 *
 * jsdom reports every box as 0×0 and cannot resolve a Tailwind class, so
 * nothing here asserts geometry — the width CLASS is asserted, and the real
 * geometry is checked in a browser against the Storybook stories.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DataState,
  DataStateBadge,
} from '../src/primitives/data-state.js';
import { Meter, RankedBarList } from '../src/primitives/meter.js';
import { StatStrip } from '../src/primitives/stat-strip.js';
import { DATA_STATES } from '../src/primitives/data-state-model.js';

afterEach(cleanup);

const root = () => document.querySelector('[data-slot="data-state"]')!;

describe('DataStateBadge', () => {
  it('announces every state, including the ones drawn only as texture', () => {
    for (const state of DATA_STATES.filter((s) => s !== 'idle')) {
      cleanup();
      render(<DataStateBadge state={state} />);
      const badge = document.querySelector('[data-slot="data-state-badge"]')!;
      // The glyph and the short word are both aria-hidden; the sentence is
      // the only thing in the accessible name.
      expect(badge.textContent, state).toContain('.');
      expect(
        badge.querySelector('.sr-only')?.textContent,
        state,
      ).toBeTruthy();
    }
  });

  it('marks the glyph and the word decorative so nothing is read twice', () => {
    render(<DataStateBadge state="not-counted" />);
    const badge = document.querySelector('[data-slot="data-state-badge"]')!;
    for (const child of badge.querySelectorAll('span:not(.sr-only)')) {
      expect(child.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('lets a caller shorten the visible word but never the sentence', () => {
    render(<DataStateBadge state="not-counted" label="n/c" />);
    expect(screen.getByText('n/c')).toBeTruthy();
    expect(document.body.textContent).toMatch(/not a zero/i);
  });

  it('keeps the sentence in glyph-only mode', () => {
    render(<DataStateBadge state="not-counted" glyphOnly />);
    expect(screen.queryByText('not counted')).toBeNull();
    expect(document.body.textContent).toMatch(/not a zero/i);
  });

  it('flags the hatch in the DOM so a cell can be audited without a screenshot', () => {
    render(<DataStateBadge state="not-counted" />);
    expect(
      document
        .querySelector('[data-slot="data-state-badge"]')!
        .getAttribute('data-hatch'),
    ).toBe('true');
  });
});

describe('DataState — precedence in the DOM', () => {
  const body = () => <p>REAL DATA</p>;

  it('renders the skeleton and marks itself busy while loading', () => {
    render(
      <DataState loading empty error="boom">
        {body}
      </DataState>,
    );
    expect(root().getAttribute('data-state')).toBe('loading');
    expect(root().getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('REAL DATA')).toBeNull();
  });

  it('renders an error as an alert, not as "no results"', () => {
    render(
      <DataState error="ECONNRESET" empty>
        {body}
      </DataState>,
    );
    expect(root().getAttribute('data-state')).toBe('error');
    expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/i);
    expect(document.body.textContent).not.toMatch(/^No data\.$/);
  });

  it('publishes the losing states as `data-qualifiers`', () => {
    render(
      <DataState error="x" empty truncated>
        {body}
      </DataState>,
    );
    expect(root().getAttribute('data-qualifiers')).toBe('empty truncated');
  });

  it('still renders the body for a QUALIFYING state — truncated is not empty', () => {
    render(<DataState truncated>{body}</DataState>);
    expect(root().getAttribute('data-state')).toBe('truncated');
    expect(screen.getByText('REAL DATA')).toBeTruthy();
    expect(document.body.textContent).toMatch(/denominator/i);
  });

  it('keeps the caveat audible when the visible notice is suppressed', () => {
    render(
      <DataState partial notice={false}>
        {body}
      </DataState>,
    );
    expect(screen.getByText('REAL DATA')).toBeTruthy();
    // `notice={false}` hides the chip, not the fact.
    expect(document.body.textContent).toMatch(/floor, not a total/i);
  });

  it('hatches an unmeasured cell rather than replacing it with a dash', () => {
    render(<DataState notCounted>{body}</DataState>);
    expect(root().getAttribute('data-state')).toBe('not-counted');
    expect(document.body.textContent).toMatch(/not a zero/i);
    expect(screen.queryByText('REAL DATA')).toBeNull();
  });

  it('runs the render prop only when there is data to render', () => {
    let ran = 0;
    render(
      <DataState empty>
        {() => {
          ran += 1;
          return null;
        }}
      </DataState>,
    );
    expect(ran).toBe(0);
  });

  it('passes data through when idle', () => {
    render(<DataState data={{ n: 7 }}>{(d) => <p>{d.n}</p>}</DataState>);
    expect(root().getAttribute('data-state')).toBe('idle');
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('folds the caller noun into the default empty message', () => {
    render(
      <DataState empty announce={{ noun: 'articles' }}>
        {body}
      </DataState>,
    );
    expect(screen.getByText('No articles.')).toBeTruthy();
  });

  it('lets a caller replace any state slot', () => {
    render(
      <DataState empty emptyState={<p>Nothing published yet</p>}>
        {body}
      </DataState>,
    );
    expect(screen.getByText('Nothing published yet')).toBeTruthy();
  });
});

describe('StatStrip — the three-state null', () => {
  const cell = (key: string) =>
    document.querySelector(`[data-slot="stat-strip-item"][data-key="${key}"]`)!;

  it('renders a value with a prior and the caller delta', () => {
    render(
      <StatStrip
        items={[
          {
            key: 'views',
            label: 'views',
            value: 1240,
            prior: 1100,
            delta: <span>+140</span>,
          },
        ]}
      />,
    );
    expect(within(cell('views') as HTMLElement).getByText('1,240')).toBeTruthy();
    expect(screen.getByText('+140')).toBeTruthy();
  });

  it('shows "first measurement" and DROPS the delta when the prior is null', () => {
    render(
      <StatStrip
        items={[
          {
            key: 'views',
            label: 'views',
            value: 1240,
            prior: null,
            delta: <span data-testid="delta">+0%</span>,
          },
        ]}
      />,
    );
    // The whole reason this component exists. There must be no path by which
    // a missing prior reaches the DOM as a change of zero.
    expect(screen.queryByTestId('delta')).toBeNull();
    expect(document.body.textContent).not.toContain('+0%');
    expect(document.body.textContent).toMatch(/no prior reading/i);
  });

  it('claims nothing about change when the prior is omitted', () => {
    render(
      <StatStrip items={[{ key: 'views', label: 'views', value: 1240 }]} />,
    );
    expect(document.body.textContent).not.toMatch(/first measurement/i);
    expect(document.body.textContent).not.toMatch(/no prior reading/i);
  });

  it('never renders an unmeasured value as 0 or as a bare dash', () => {
    render(
      <StatStrip
        items={[
          {
            key: 'runs',
            label: 'runs',
            value: null,
            state: { notCounted: true },
          },
        ]}
      />,
    );
    const text = cell('runs').textContent ?? '';
    expect(text).not.toMatch(/\b0\b/);
    expect(text).not.toContain('—');
    expect(text).toMatch(/not a zero/i);
    expect(cell('runs').getAttribute('data-state')).toBe('not-counted');
  });

  it('distinguishes a measured zero from an unmeasured cell', () => {
    render(
      <StatStrip
        items={[
          { key: 'zero', label: 'measured', value: 0 },
          { key: 'gap', label: 'unmeasured', value: null, state: { notCounted: true } },
        ]}
      />,
    );
    expect(within(cell('zero') as HTMLElement).getByText('0')).toBeTruthy();
    expect(cell('gap').textContent).not.toMatch(/\b0\b/);
  });

  it('qualifies a measured value that is only a floor', () => {
    render(
      <StatStrip
        items={[
          { key: 'n', label: 'findings', value: 128, state: { partial: true } },
        ]}
      />,
    );
    expect(within(cell('n') as HTMLElement).getByText('128')).toBeTruthy();
    expect(cell('n').textContent).toMatch(/floor, not a total/i);
  });

  it('announces a strip-wide caveat once, not once per cell', () => {
    render(
      <StatStrip
        caption="last 30 days"
        state={{ partial: true }}
        items={[
          { key: 'a', label: 'a', value: 1 },
          { key: 'b', label: 'b', value: 2 },
        ]}
      />,
    );
    const occurrences = (document.body.textContent ?? '').match(
      /floor, not a total/gi,
    );
    expect(occurrences).toHaveLength(1);
  });

  it('is a real description list, so every number has its label', () => {
    render(
      <StatStrip items={[{ key: 'a', label: 'downloads', value: 12 }]} />,
    );
    expect(document.querySelector('dl')).toBeTruthy();
    expect(document.querySelector('dt')!.textContent).toBe('downloads');
    expect(document.querySelector('dd')!.textContent).toContain('12');
  });

  it('reserves the strip silhouette while loading', () => {
    render(<StatStrip loading items={[]} />);
    const skeleton = document.querySelector('[data-slot="stat-strip"]')!;
    expect(skeleton.getAttribute('data-variant')).toBe('stat-strip');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
  });

  /**
   * Finding 3 from the control-room conversion: the strip could say what a
   * number is and how it changed, and had no way at all to say **this one is
   * bad**. A blown error budget rendered in the same weight as a healthy one,
   * and the reader had to know the thresholds to see it — which is the job the
   * strip existed to do.
   */
  describe('tone — "this number is bad", said three ways', () => {
    it('colours the value and the rail', () => {
      render(
        <StatStrip
          items={[{ key: 'budget', label: 'error budget', value: 4, tone: 'negative' }]}
        />,
      );
      expect(cell('budget').className).toContain('border-destructive');
      expect(cell('budget').querySelector('[dir="auto"]')!.className).toContain(
        'text-viz-negative',
      );
    });

    it('says it out loud as well, because a hue is not a sentence', () => {
      // `--viz-negative` is invisible in a greyscale print, in a screenshot
      // pasted into a chat, and to a screen reader.
      render(
        <StatStrip items={[{ key: 'a', label: 'a', value: 4, tone: 'negative' }]} />,
      );
      expect(document.body.textContent).toMatch(/Needs attention\./);
      cleanup();
      render(
        <StatStrip items={[{ key: 'a', label: 'a', value: 4, tone: 'positive' }]} />,
      );
      expect(document.body.textContent).toMatch(/Good\./);
    });

    it('publishes the judgement as `data-tone`, and says nothing when there is none', () => {
      render(
        <StatStrip
          items={[
            { key: 'judged', label: 'a', value: 1, tone: 'positive' },
            { key: 'unjudged', label: 'b', value: 2 },
          ]}
        />,
      );
      expect(cell('judged').getAttribute('data-tone')).toBe('positive');
      expect(cell('unjudged').getAttribute('data-tone')).toBeNull();
    });

    it('leaves a `neutral` number uncoloured by judgement and unannounced', () => {
      // `neutral` is a number deliberately NOT being judged, which is a
      // different thing from `default` — a number nobody HAS judged.
      render(
        <StatStrip items={[{ key: 'a', label: 'a', value: 4, tone: 'neutral' }]} />,
      );
      expect(cell('a').querySelector('[dir="auto"]')!.className).toContain(
        'text-viz-neutral',
      );
      expect(cell('a').getAttribute('data-tone')).toBe('neutral');
      expect(document.body.textContent).not.toMatch(/Needs attention|Good\./);
    });

    it('never carries magnitude in the tone — two values at one tone differ only in digits', () => {
      render(
        <StatStrip
          items={[
            { key: 'small', label: 'a', value: 1, tone: 'negative' },
            { key: 'large', label: 'b', value: 9_999, tone: 'negative' },
          ]}
        />,
      );
      expect(cell('small').className).toBe(cell('large').className);
    });

    it('lets ABSENCE outrank judgement — an unmeasured cell has no number to judge', () => {
      render(
        <StatStrip
          items={[
            {
              key: 'gap',
              label: 'a',
              value: null,
              tone: 'positive',
              state: { notCounted: true },
            },
          ]}
        />,
      );
      // The rail reports the absence, not an opinion about a value nobody has.
      expect(cell('gap').className).toContain('border-muted-foreground/50');
      expect(cell('gap').textContent).not.toMatch(/Good\./);
    });
  });

  it('collapses to two tracks at the 320 floor whatever `cols` says', () => {
    render(
      <StatStrip cols={6} items={[{ key: 'a', label: 'a', value: 1 }]} />,
    );
    const list = document.querySelector('dl')!.className;
    expect(list).toContain('grid-cols-2');
    expect(list).toContain('lg:grid-cols-6');
  });
});

describe('Meter', () => {
  const track = () => document.querySelector('[data-slot="meter-track"]')!;
  const fill = () => document.querySelector('[data-slot="meter-fill"]');

  it('carries magnitude as length AND as a number', () => {
    render(<Meter label="Coverage" value={62} max={100} unit="%" />);
    expect(fill()!.className).toContain('w-[62%]');
    expect(screen.getByText('62 %')).toBeTruthy();
  });

  it('exposes the real value through role=meter, not the percentage', () => {
    render(<Meter label="Downloads" value={6200} max={10_000} unit="downloads" />);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('6200');
    expect(meter.getAttribute('aria-valuemax')).toBe('10000');
    expect(meter.getAttribute('aria-valuetext')).toBe(
      'Downloads: 6,200 downloads of 10,000 downloads.',
    );
  });

  it('hatches an unmeasured row instead of drawing an empty bar', () => {
    render(<Meter label="Runs" value={null} max={100} />);
    expect(fill()).toBeNull();
    expect(track().getAttribute('data-hatch')).toBe('true');
    expect(document.querySelector('[data-slot="meter"]')!.getAttribute('data-variant')).toBe(
      'hatch',
    );
    expect(document.body.textContent).toMatch(/not a zero/i);
  });

  it('draws a measured zero as an empty bar, which is a different picture', () => {
    render(<Meter label="Runs" value={0} max={100} />);
    expect(fill()!.className).toContain('w-[0%]');
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('0');
    expect(document.body.textContent).not.toMatch(/not a zero/i);
  });

  it('hatches when there is no denominator to draw a length against', () => {
    render(<Meter label="Runs" value={42} max={null} />);
    expect(fill()).toBeNull();
  });

  it('does not call a real number "not measured" just because it hatched', () => {
    // The bar hatches because there is no scale to draw a length against. The
    // VALUE is still real, and the sentence reports the value.
    render(<Meter label="Runs" value={42} max={null} />);
    expect(document.body.textContent).toContain('Runs: 42.');
    expect(document.body.textContent).not.toMatch(/not measured/i);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('lets `dead` recede without vanishing — it still holds its rank', () => {
    render(<Meter label="Legacy" value={30} max={100} variant="dead" />);
    expect(fill()!.className).toContain('w-[30%]');
    expect(fill()!.className).toContain('bg-muted-foreground/30');
    expect(screen.getByRole('meter')).toBeTruthy();
  });

  it('never carries magnitude in the fill colour', () => {
    // Tone answers "is this good", never "how big". Two different values at
    // the same tone must differ only in width.
    render(
      <>
        <Meter label="A" value={10} max={100} tone="positive" />
        <Meter label="B" value={90} max={100} tone="positive" />
      </>,
    );
    const fills = [...document.querySelectorAll('[data-slot="meter-fill"]')];
    expect(fills[0].className.replace('w-[10%]', '')).toBe(
      fills[1].className.replace('w-[90%]', ''),
    );
  });

  it('clamps an overage to the track and reports it in the number', () => {
    render(<Meter label="Budget" value={150} max={100} />);
    expect(fill()!.className).toContain('w-[100%]');
    expect(screen.getByText('150')).toBeTruthy();
  });

  it('accepts an explicit fraction for the odds-bar case', () => {
    render(
      <Meter label="Odds" value={3} max={100} fraction={0.75} display="3 in 4" />,
    );
    expect(fill()!.className).toContain('w-[75%]');
    expect(screen.getByText('3 in 4')).toBeTruthy();
  });
});

describe('RankedBarList', () => {
  const rows = [
    { key: 'a', label: 'npm', value: 10_000_000 },
    { key: 'b', label: 'blog', value: 10_000 },
    { key: 'c', label: 'talks', value: null },
  ];

  it('ranks descending and keeps unmeasured rows in the list', () => {
    render(<RankedBarList rows={rows} />);
    const labels = [...document.querySelectorAll('[data-slot="meter"]')].map(
      (m) => m.getAttribute('data-state'),
    );
    expect(labels).toHaveLength(3);
    expect(screen.getByText('talks')).toBeTruthy();
  });

  it('derives the domain from measured values only', () => {
    render(<RankedBarList rows={rows} />);
    const fills = [...document.querySelectorAll('[data-slot="meter-fill"]')];
    expect(fills[0].className).toContain('w-[100%]');
    // 10k against a 10M domain is a hairline — which is the honest linear
    // answer, and the reason the log scale exists.
    expect(fills[1].className).toContain('w-[0%]');
  });

  it('makes both rows legible on a log axis', () => {
    render(<RankedBarList rows={rows} scale="log" />);
    const fills = [...document.querySelectorAll('[data-slot="meter-fill"]')];
    expect(fills[0].className).toContain('w-[100%]');
    expect(fills[1].className).toContain('w-[57%]');
  });

  it('labels a log axis, because an unlabelled one flatters every small row', () => {
    render(<RankedBarList rows={rows} scale="log" />);
    expect(screen.getByText('log scale')).toBeTruthy();
  });

  it('does not label a linear axis', () => {
    render(<RankedBarList rows={rows} />);
    expect(screen.queryByText('log scale')).toBeNull();
  });

  it('keeps the caller order when asked', () => {
    render(<RankedBarList rows={rows} order="given" />);
    const first = document.querySelector('[data-slot="meter"]')!;
    expect(first.textContent).toContain('npm');
  });

  it('says a truncated list is not a denominator', () => {
    render(
      <RankedBarList rows={rows} state={{ truncated: true }} announce={{ shown: 3 }} />,
    );
    expect(document.body.textContent).toMatch(/denominator/i);
    expect(
      document
        .querySelector('[data-slot="ranked-bar-list"]')!
        .getAttribute('data-state'),
    ).toBe('truncated');
  });

  it('reserves one meter silhouette per row while loading', () => {
    render(<RankedBarList rows={[]} loading loadingRows={4} />);
    const skeleton = document.querySelector('[data-slot="ranked-bar-list"]')!;
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(
      skeleton.querySelectorAll('[data-variant="meter"]').length,
    ).toBe(4);
  });

  it('hatches every row when nothing in the list was measured', () => {
    render(
      <RankedBarList
        rows={[
          { key: 'a', label: 'a', value: null },
          { key: 'b', label: 'b', value: null },
        ]}
      />,
    );
    expect(document.querySelectorAll('[data-slot="meter-fill"]')).toHaveLength(0);
    expect(
      document.querySelectorAll('[data-slot="meter-track"][data-hatch]'),
    ).toHaveLength(2);
  });
});
