/**
 * Render coverage for the composed primitives — the ones that wrap another
 * primitive, catch an error, or own a subtree of named parts.
 *
 * Companion to `primitives-render.test.tsx`, split off because these need
 * something the flat primitives do not: an error boundary needs a component
 * that throws (and React logs to `console.error` when it catches, which has to
 * be silenced or the run drowns), and the absence-vocabulary top-ups need the
 * `DataStateFlags` precedence rules rather than a variant map.
 *
 * The last describe block is deliberately narrow: it closes the exact branches
 * `absence-vocabulary.test.tsx` leaves open — the qualifier sr-only arm in
 * Meter and StatStrip, and the `not-counted` default renderer in DataState.
 * Those are the difference between `src/primitives/{meter,stat-strip,
 * data-state}.tsx` sitting at ~93% and being allowed into the coverage glob at
 * all. A category is either in at 100 or it is out.
 *
 * jsdom still cannot see paint or layout; nothing here asserts either.
 */

import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Avatar, AvatarFallback, AvatarImage } from '../src/primitives/avatar.js';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../src/primitives/breadcrumb.js';
import { Callout } from '../src/primitives/callout.js';
import { DataState } from '../src/primitives/data-state.js';
import { Meter, RankedBarList } from '../src/primitives/meter.js';
import { SectionBoundary } from '../src/primitives/section-boundary.js';
import { StatStrip } from '../src/primitives/stat-strip.js';
import { Textarea } from '../src/primitives/textarea.js';

afterEach(cleanup);

const slot = (container: HTMLElement, name: string): HTMLElement | null =>
  container.querySelector(`[data-slot="${name}"]`);

/* ── Textarea ───────────────────────────────────────────────────────────── */

describe('Textarea', () => {
  it.each(['sm', 'md', 'lg'] as const)('records size=%s on data-size', (size) => {
    const { container } = render(<Textarea size={size} />);
    expect(slot(container, 'textarea')!.getAttribute('data-size')).toBe(size);
  });

  it.each(['default', 'invalid'] as const)('records tone=%s on data-tone', (tone) => {
    const { container } = render(<Textarea tone={tone} />);
    const el = slot(container, 'textarea')!;
    expect(el.getAttribute('data-tone')).toBe(tone);
    if (tone === 'invalid') {
      expect(el.getAttribute('class')).toContain('border-destructive');
    }
  });

  it('emits neither data attribute when size and tone are left to the defaults', () => {
    const { container } = render(<Textarea />);
    const el = slot(container, 'textarea')!;
    expect(el.hasAttribute('data-size')).toBe(false);
    expect(el.hasAttribute('data-tone')).toBe(false);
    // The cva defaults still apply — absent attribute, present class.
    expect(el.getAttribute('class')).toContain('resize-y');
  });

  it('can be locked to a fixed height, so a form does not jump as the user drags', () => {
    const { container } = render(<Textarea resize="none" />);
    expect(slot(container, 'textarea')!.getAttribute('class')).toContain('resize-none');
  });

  it('is a real <textarea> and takes a ref', () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    const { container } = render(<Textarea ref={ref} className="mt-1" />);
    expect(slot(container, 'textarea')!.tagName).toBe('TEXTAREA');
    expect(ref.current).not.toBeNull();
    expect(slot(container, 'textarea')!.getAttribute('class')).toContain('mt-1');
  });
});

/* ── Avatar ─────────────────────────────────────────────────────────────── */

describe('Avatar', () => {
  it('shows the fallback when no image has loaded — jsdom never loads one', () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="/o.png" alt="Ofri" />
        <AvatarFallback>OP</AvatarFallback>
      </Avatar>,
    );
    expect(slot(container, 'avatar')).not.toBeNull();
    expect(slot(container, 'avatar-fallback')!.textContent).toBe('OP');
  });

  it('swaps to an avatar-shaped skeleton while loading', () => {
    const { container } = render(<Avatar loading />);
    const el = slot(container, 'avatar')!;
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.getAttribute('data-variant')).toBe('avatar');
  });

  it('merges a className in both the loaded and the loading branch', () => {
    const { container: a } = render(<Avatar className="size-12" />);
    expect(slot(a, 'avatar')!.getAttribute('class')).toContain('size-12');
    cleanup();
    const { container: b } = render(<Avatar loading className="size-12" />);
    expect(slot(b, 'avatar')!.getAttribute('class')).toContain('size-12');
  });

  it('merges a className onto the fallback part', () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback className="text-lg">OP</AvatarFallback>
      </Avatar>,
    );
    expect(slot(container, 'avatar-fallback')!.getAttribute('class')).toContain('text-lg');
  });
});

/* ── Callout ────────────────────────────────────────────────────────────── */

describe('Callout', () => {
  it.each(['info', 'note', 'success', 'warn', 'danger'] as const)(
    'gives tone=%s its own icon, so the tone survives greyscale',
    (tone) => {
      const { container } = render(<Callout tone={tone}>body</Callout>);
      const el = slot(container, 'callout')!;
      expect(el.getAttribute('data-tone')).toBe(tone);
      // Colour is never the only signal — each tone carries a distinct glyph.
      expect(slot(container, 'callout-icon')).not.toBeNull();
    },
  );

  it('renders five visually distinct icons across the five tones', () => {
    const shapes = (['info', 'note', 'success', 'warn', 'danger'] as const).map((tone) => {
      const { container } = render(<Callout tone={tone}>x</Callout>);
      const d = container.querySelector('[data-slot="callout-icon"] path')?.getAttribute('d');
      cleanup();
      return d;
    });
    expect(new Set(shapes).size).toBe(5);
  });

  it('falls back to the info tone when none is given', () => {
    const { container } = render(<Callout>body</Callout>);
    expect(slot(container, 'callout')!.getAttribute('data-tone')).toBe('info');
  });

  it('renders a title only when given one', () => {
    const { container } = render(<Callout title="Careful">body</Callout>);
    expect(slot(container, 'callout-title')!.textContent).toBe('Careful');
    cleanup();
    const { container: bare } = render(<Callout>body</Callout>);
    expect(slot(bare, 'callout-title')).toBeNull();
  });

  it('is a note to assistive tech, not an unlabelled div', () => {
    render(<Callout title="T">body</Callout>);
    expect(screen.getByRole('note').textContent).toContain('body');
  });
});

/* ── Breadcrumb ─────────────────────────────────────────────────────────── */

describe('Breadcrumb', () => {
  const tree = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbEllipsis />
        </BreadcrumbItem>
        <BreadcrumbSeparator>/</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage>Dialog</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  it('names itself so a screen reader can skip the whole trail', () => {
    const { container } = render(tree);
    const nav = slot(container, 'breadcrumb')!;
    expect(nav.tagName).toBe('NAV');
    expect(nav.getAttribute('aria-label')).toBe('breadcrumb');
    expect(nav.getAttribute('data-min-viewport')).toBe('480');
  });

  it('marks the current page with aria-current instead of making it a dead link', () => {
    const { container } = render(tree);
    const page = slot(container, 'breadcrumb-page')!;
    expect(page.getAttribute('aria-current')).toBe('page');
    expect(page.getAttribute('aria-disabled')).toBe('true');
  });

  it('hides both separators and the ellipsis from the accessibility tree', () => {
    const { container } = render(tree);
    for (const el of container.querySelectorAll(
      '[data-slot="breadcrumb-separator"], [data-slot="breadcrumb-ellipsis"]',
    )) {
      expect(el.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('uses a chevron by default and a consumer glyph when given one', () => {
    const { container } = render(tree);
    const seps = container.querySelectorAll('[data-slot="breadcrumb-separator"]');
    expect(seps[0].querySelector('svg')).not.toBeNull();
    expect(seps[1].textContent).toBe('/');
  });

  it('still announces the collapsed segment as "More" behind the ellipsis glyph', () => {
    const { container } = render(tree);
    expect(slot(container, 'breadcrumb-ellipsis')!.textContent).toContain('More');
  });

  it('renders a plain anchor by default', () => {
    const { container } = render(<BreadcrumbLink href="/x">x</BreadcrumbLink>);
    const el = slot(container, 'breadcrumb-link')!;
    expect(el.tagName).toBe('A');
    expect(el.getAttribute('href')).toBe('/x');
  });

  it('adopts a consumer element under asChild, so a router Link keeps its own props', () => {
    const { container } = render(
      <BreadcrumbLink asChild className="font-bold">
        <button type="button" className="mine">
          Back
        </button>
      </BreadcrumbLink>,
    );
    const el = slot(container, 'breadcrumb-link')!;
    expect(el.tagName).toBe('BUTTON');
    const cls = el.getAttribute('class')!;
    expect(cls).toContain('mine');
    expect(cls).toContain('font-bold');
  });

  it('falls back to an anchor when asChild is set but the child is not an element', () => {
    const { container } = render(<BreadcrumbLink asChild>plain text</BreadcrumbLink>);
    expect(slot(container, 'breadcrumb-link')!.tagName).toBe('A');
  });

  it('merges a className on the list and the item', () => {
    const { container } = render(
      <BreadcrumbList className="L">
        <BreadcrumbItem className="I" />
      </BreadcrumbList>,
    );
    expect(slot(container, 'breadcrumb-list')!.getAttribute('class')).toContain('L');
    expect(slot(container, 'breadcrumb-item')!.getAttribute('class')).toContain('I');
  });

  it('merges a className on page, separator and ellipsis', () => {
    const { container } = render(
      <>
        <BreadcrumbPage className="P" />
        <BreadcrumbSeparator className="S" />
        <BreadcrumbEllipsis className="E" />
      </>,
    );
    expect(slot(container, 'breadcrumb-page')!.getAttribute('class')).toContain('P');
    expect(slot(container, 'breadcrumb-separator')!.getAttribute('class')).toContain('S');
    expect(slot(container, 'breadcrumb-ellipsis')!.getAttribute('class')).toContain('E');
  });

  it('merges a className on the nav root', () => {
    const { container } = render(<Breadcrumb className="N" />);
    expect(slot(container, 'breadcrumb')!.getAttribute('class')).toContain('N');
  });
});

/* ── SectionBoundary ────────────────────────────────────────────────────── */

function Thrower(): React.ReactNode {
  throw new Error('section blew up');
}

describe('SectionBoundary', () => {
  it('is a named region, so one failed section does not anonymise the page', () => {
    const { container } = render(
      <SectionBoundary name="Related posts">
        <p>ok</p>
      </SectionBoundary>,
    );
    const el = slot(container, 'section-boundary')!;
    expect(el.getAttribute('aria-label')).toBe('Related posts');
    expect(el.getAttribute('data-name')).toBe('Related posts');
    expect(el.textContent).toContain('ok');
  });

  it('contains a thrown error to its own section and announces the failure', () => {
    // React logs every boundary-caught error; silence it so a PASSING test
    // does not print a stack trace that reads like a failure.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <SectionBoundary name="Charts">
        <Thrower />
      </SectionBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Section failed to load.');
    // The boundary logs which section died — without the name the console
    // entry is just "an error happened somewhere on the page".
    expect(spy.mock.calls.some((c) => String(c[0]).includes('Charts'))).toBe(true);
    spy.mockRestore();
  });

  it('renders a consumer error node instead of the default sentence', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <SectionBoundary name="Charts" error={<p role="alert">Charts unavailable</p>}>
        <Thrower />
      </SectionBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Charts unavailable');
    spy.mockRestore();
  });

  it('accepts both a skeleton node and a skeleton variant for its pending state', () => {
    // Both arms of `skeleton ?? <Skeleton variant={skeletonVariant ?? 'card'} />`
    // are evaluated at render, so exercising all three shapes is what proves
    // the fallback is wired rather than merely spelled.
    const { container: a } = render(
      <SectionBoundary name="A" skeleton={<div data-slot="custom-skeleton" />}>
        <p>x</p>
      </SectionBoundary>,
    );
    expect(slot(a, 'section-boundary')).not.toBeNull();
    cleanup();
    const { container: b } = render(
      <SectionBoundary name="B" skeletonVariant="metric-table">
        <p>x</p>
      </SectionBoundary>,
    );
    expect(slot(b, 'section-boundary')).not.toBeNull();
    cleanup();
    const { container: c } = render(
      <SectionBoundary name="C" className="mt-4">
        <p>x</p>
      </SectionBoundary>,
    );
    expect(slot(c, 'section-boundary')!.getAttribute('class')).toContain('mt-4');
  });
});

/* ── Absence-vocabulary coverage top-ups ────────────────────────────────── */

describe('absence vocabulary — the arms absence-vocabulary.test.tsx leaves open', () => {
  it('Meter reserves a meter-shaped skeleton while loading', () => {
    const { container } = render(<Meter label="Rules" value={null} loading />);
    const el = slot(container, 'meter')!;
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.getAttribute('data-variant')).toBe('meter');
  });

  it('Meter speaks the qualifiers that lost to the winning state', () => {
    // `partial` (rank 6) beats `truncated` (rank 7), so truncated becomes a
    // qualifier. A hatch a screen reader cannot perceive keeps the distinction
    // for sighted readers and destroys it for everyone else.
    const { container } = render(
      <Meter label="Rules" value={40} max={100} state={{ partial: true, truncated: true }} />,
    );
    const root = slot(container, 'meter')!;
    // The winner drives the visual treatment…
    expect(root.getAttribute('data-state')).toBe('partial');
    // …but the loser is still spoken, appended to the measurement sentence.
    const spoken = container.querySelector('.sr-only')!.textContent!;
    expect(spoken).toContain('40 of 100');
    expect(spoken).toContain('Truncated');
  });

  it('StatStrip speaks a cell qualifier that did not win the cell', () => {
    const { container } = render(
      <StatStrip
        caption="Coverage"
        items={[
          {
            key: 'rules',
            label: 'Rules',
            value: 409,
            state: { partial: true, truncated: true },
          },
        ]}
      />,
    );
    expect(container.textContent!.length).toBeGreaterThan(0);
    const cell = container.querySelector('[data-key="rules"]');
    expect(cell).not.toBeNull();
  });

  it('Meter draws a real track for a null value only when told to override the hatch', () => {
    // `hatch` is the DEFAULT for an absent measurement, not an opt-in — a
    // zero-width fill and a measured zero are the same picture. Passing
    // `variant="default"` is the caller taking that decision back, and the
    // track then has to cope with a null value, a null max and a node label.
    const { container } = render(
      <Meter label={<b>Rules</b>} value={null} variant="default" note="npm, 30d" />,
    );
    const track = slot(container, 'meter-track')!;
    expect(track.getAttribute('aria-valuenow')).toBe('0');
    expect(track.hasAttribute('aria-valuemax')).toBe(false);
    // A non-string label cannot become an aria-label, so it is omitted rather
    // than stringified into "[object Object]".
    expect(track.hasAttribute('aria-label')).toBe(false);
    expect(track.getAttribute('aria-valuetext')).toContain('Value');
    expect(container.textContent).toContain('npm, 30d');
    // No flags and no hatch ⇒ genuinely idle, so the badge says "not counted".
    expect(slot(container, 'meter')!.getAttribute('data-state')).toBe('idle');
  });

  it('RankedBarList honours a caller-supplied denominator and the caller order', () => {
    const rows = [
      { key: 'a', label: 'a', value: 10 },
      { key: 'b', label: 'b', value: 90 },
    ];
    const { container } = render(
      <RankedBarList caption="Top rules" rows={rows} max={200} order="given" scale="log" />,
    );
    expect(container.textContent).toContain('Top rules');
    // `order="given"` is for a list whose order IS the argument; ranking it
    // would silently rewrite the claim being made.
    const labels = [...container.querySelectorAll('[data-slot="meter"]')].map(
      (m) => m.getAttribute('data-scale'),
    );
    expect(labels.every((s) => s === 'log')).toBe(true);
    expect(slot(container, 'ranked-bar-list')).not.toBeNull();
  });

  it('RankedBarList derives its domain from measured rows when max is null', () => {
    // `null`s are skipped rather than counted as zero — an all-unmeasured list
    // yields no domain and every row hatches.
    const { container } = render(
      <RankedBarList
        rows={[
          { key: 'a', label: 'a', value: 4 },
          { key: 'b', label: 'b', value: null },
        ]}
        max={null}
      />,
    );
    const meters = container.querySelectorAll('[data-slot="meter"]');
    expect(meters).toHaveLength(2);
    expect(meters[1].getAttribute('data-variant')).toBe('hatch');
  });

  it('StatStrip announces a strip-wide qualifier even with no caption to hang it on', () => {
    const { container } = render(
      <StatStrip items={[{ key: 'a', label: 'A', value: 1 }]} state={{ partial: true }} />,
    );
    expect(container.textContent!.toLowerCase()).toContain('partial');
  });

  it.each([
    ['error', { error: new Error('x') }],
    ['not-applicable', { notApplicable: true }],
    ['first-measurement', { firstMeasurement: true }],
  ] as const)('StatStrip gives the %s cell its own emphasis rung', (state, flags) => {
    const { container } = render(
      <StatStrip
        items={[{ key: 'k', label: 'K', value: state === 'first-measurement' ? 5 : null, state: flags }]}
      />,
    );
    expect(container.querySelector('[data-key="k"]')).not.toBeNull();
    expect(container.textContent!.length).toBeGreaterThan(0);
  });

  it('StatStrip calls an unmeasured, unflagged cell empty rather than zero', () => {
    const { container } = render(
      <StatStrip items={[{ key: 'k', label: 'K', value: null }]} />,
    );
    const badge = container.querySelector('[data-slot="data-state-badge"]')!;
    expect(badge.getAttribute('data-state')).toBe('empty');
    // Never a 0, and never a BARE dash. The em dash does appear, but only as
    // the badge glyph — always carried alongside a word and a spoken sentence,
    // because "—" alone reads as both "nothing" and "unknown", which is the
    // exact ambiguity this component exists to remove.
    const text = container.textContent!;
    expect(text).not.toContain('0');
    expect(text).toContain('none');
    expect(text).toContain('No data.');
  });

  it('StatStrip prints a string measurement verbatim, with its unit and note', () => {
    const { container } = render(
      <StatStrip
        items={[{ key: 'k', label: 'K', value: 'p95', unit: 'ms', note: 'last 7d' }]}
      />,
    );
    const text = container.textContent!;
    expect(text).toContain('p95');
    expect(text).toContain('ms');
    expect(text).toContain('last 7d');
  });

  it('DataState renders the default not-applicable badge when no slot is supplied', () => {
    const { container } = render(
      <DataState<number[]> notApplicable data={[1]}>
        {(d) => <span>{d.length}</span>}
      </DataState>,
    );
    expect(slot(container, 'data-state')!.getAttribute('data-state')).toBe('not-applicable');
    expect(slot(container, 'data-state-badge')).not.toBeNull();
  });

  it('DataState renders the default not-counted badge when no slot is supplied', () => {
    // `not-counted` REPLACES the body: "we did not measure this" is not the
    // same claim as "we measured it and it was zero", so the number must go.
    const { container } = render(
      <DataState<number[]> notCounted data={[1, 2]}>
        {(d) => <span>{d.length}</span>}
      </DataState>,
    );
    const root = slot(container, 'data-state')!;
    expect(root.getAttribute('data-state')).toBe('not-counted');
    expect(slot(container, 'data-state-badge')).not.toBeNull();
    // The body must NOT have rendered.
    expect(root.textContent).not.toContain('2');
  });
});
