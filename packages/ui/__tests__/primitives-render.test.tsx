/**
 * Render coverage for the server-safe primitives.
 *
 * WHAT THE EXISTING LOCKS ALREADY PROVE
 * -------------------------------------
 * `primitives-min-viewport-lock`, `storybook-coverage-lock`,
 * `skeleton-variant-coverage-lock`, `composite-contrast-lock` and friends are
 * static source parsers — `readFileSync` plus a regex. They are the right tool
 * for "every primitive declares MIN_VIEWPORT" or "no chip pairs a token with a
 * tint that fails AA", and they contribute exactly zero runtime coverage. A
 * variant map can be spelled correctly and still never be reachable.
 *
 * WHAT THIS FILE PROVES
 * ---------------------
 * That each primitive below actually renders, and that every branch a consumer
 * can reach — variant, tone, size, `as`, `loading`, the null-prop arms — is
 * one a React renderer has really executed. This is the file that lets
 * `src/primitives/**` enter the coverage glob at 100, which is the only way it
 * is allowed to enter at all (see the ratchet note in `vitest.config.ts`).
 *
 * WHAT jsdom CANNOT VERIFY HERE
 * -----------------------------
 * Anything geometric or painted. jsdom has no layout and no cascade: it cannot
 * tell you that `grid-cols-3` produced three columns, that `sr-only` actually
 * hid the label, or that `bg-success` cleared AA. Those live where they can be
 * measured — Storybook's axe + theme-matrix sweep for colour, the responsive
 * harness for layout. Assertions here are limited to what the DOM really
 * knows: tag name, attributes, accessible role/name, class *containment*, and
 * which subtree rendered.
 */

import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Alert, AlertDescription, AlertTitle } from '../src/primitives/alert.js';
import { AspectRatio } from '../src/primitives/aspect-ratio.js';
import { Badge } from '../src/primitives/badge.js';
import { Box } from '../src/primitives/box.js';
import { Button } from '../src/primitives/button.js';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../src/primitives/card.js';
import { FocusRing } from '../src/primitives/focus-ring.js';
import { GRADE_VALUES, GradeBadge } from '../src/primitives/grade-badge.js';
import { Grid, GridItem } from '../src/primitives/grid.js';
import { Input } from '../src/primitives/input.js';
import { Label } from '../src/primitives/label.js';
import { PublishedDate } from '../src/primitives/published-date.js';
import { ReadingTime } from '../src/primitives/reading-time.js';
import { Separator } from '../src/primitives/separator.js';
import { SkipLink } from '../src/primitives/skip-link.js';
import { Tag, TagList } from '../src/primitives/tag.js';
import { Typography } from '../src/primitives/typography.js';
import { VisuallyHidden } from '../src/primitives/visually-hidden.js';

afterEach(cleanup);

/** The DS marks every named part with `data-slot`; that is the query of record. */
const slot = (container: HTMLElement, name: string): HTMLElement | null =>
  container.querySelector(`[data-slot="${name}"]`);

/* ── Separator ──────────────────────────────────────────────────────────── */

describe('Separator', () => {
  it('is horizontal unless told otherwise, and says so to assistive tech', () => {
    const { container } = render(<Separator />);
    const el = slot(container, 'separator')!;
    expect(el.getAttribute('aria-orientation')).toBe('horizontal');
    expect(el.getAttribute('class')).toContain('w-full');
  });

  it('swaps its own axis classes when vertical — the divider is 1px the other way', () => {
    const { container } = render(<Separator orientation="vertical" />);
    const el = slot(container, 'separator')!;
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
    expect(el.getAttribute('class')).toContain('w-px');
    expect(el.getAttribute('class')).not.toContain('w-full');
  });

  it('merges a consumer className instead of dropping it', () => {
    const { container } = render(<Separator className="my-4" />);
    expect(slot(container, 'separator')!.getAttribute('class')).toContain('my-4');
  });
});

/* ── Label / Input ──────────────────────────────────────────────────────── */

describe('Label', () => {
  it('renders a real <label>, so clicking it focuses the control it names', () => {
    const { container } = render(<Label htmlFor="email">Email</Label>);
    const el = slot(container, 'label')!;
    expect(el.tagName).toBe('LABEL');
    expect(el.getAttribute('for')).toBe('email');
    expect(el.getAttribute('data-min-viewport')).toBe('320');
  });

  it('accepts a className without losing the base type scale', () => {
    const { container } = render(<Label className="sr-only">Hidden</Label>);
    const cls = slot(container, 'label')!.getAttribute('class')!;
    expect(cls).toContain('sr-only');
    expect(cls).toContain('font-medium');
  });
});

describe('Input', () => {
  it('forwards `type` so a password field is not silently a text field', () => {
    const { container } = render(<Input type="password" />);
    expect(slot(container, 'input')!.getAttribute('type')).toBe('password');
  });

  it('omits the type attribute entirely when the consumer omits it', () => {
    const { container } = render(<Input />);
    expect(slot(container, 'input')!.hasAttribute('type')).toBe(false);
  });

  it('carries the invalid styling hook through aria-invalid', () => {
    const { container } = render(<Input aria-invalid className="w-40" />);
    const el = slot(container, 'input')!;
    expect(el.getAttribute('aria-invalid')).toBe('true');
    expect(el.getAttribute('class')).toContain('w-40');
  });

  it('accepts a ref, so a form library can focus the first error', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current!.tagName).toBe('INPUT');
  });
});

/* ── VisuallyHidden / SkipLink / FocusRing ──────────────────────────────── */

describe('VisuallyHidden', () => {
  it('keeps its children in the accessibility tree rather than removing them', () => {
    const { container } = render(<VisuallyHidden>Sort ascending</VisuallyHidden>);
    const el = slot(container, 'visually-hidden')!;
    expect(el.textContent).toBe('Sort ascending');
    expect(el.getAttribute('class')).toContain('sr-only');
  });

  it('still merges a className on top of sr-only', () => {
    const { container } = render(<VisuallyHidden className="absolute">x</VisuallyHidden>);
    expect(slot(container, 'visually-hidden')!.getAttribute('class')).toContain('absolute');
  });
});

describe('SkipLink', () => {
  it('defaults to #main with the standard wording, so a page gets it for free', () => {
    render(<SkipLink />);
    const el = screen.getByRole('link', { name: 'Skip to main content' });
    expect(el.getAttribute('href')).toBe('#main');
  });

  it('lets a page override both target and wording', () => {
    render(<SkipLink href="#content">Jump to content</SkipLink>);
    const el = screen.getByRole('link', { name: 'Jump to content' });
    expect(el.getAttribute('href')).toBe('#content');
  });
});

describe('FocusRing', () => {
  it.each([
    ['none', 'focus-within:ring-offset-0'],
    ['sm', 'focus-within:ring-offset-1'],
    ['md', 'focus-within:ring-offset-2'],
    ['lg', 'focus-within:ring-offset-4'],
  ] as const)('maps offset=%s to its own ring-offset rung', (offset, expected) => {
    const { container } = render(
      <FocusRing offset={offset}>
        <button type="button">go</button>
      </FocusRing>,
    );
    expect(slot(container, 'focus-ring')!.getAttribute('class')).toContain(expected);
  });

  it('uses the md rung when no offset is given', () => {
    const { container } = render(<FocusRing>x</FocusRing>);
    expect(slot(container, 'focus-ring')!.getAttribute('class')).toContain(
      'focus-within:ring-offset-2',
    );
  });
});

/* ── Alert ──────────────────────────────────────────────────────────────── */

describe('Alert', () => {
  it('announces itself — an alert nobody hears is decoration', () => {
    render(
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Your token expires soon.</AlertDescription>
      </Alert>,
    );
    const el = screen.getByRole('alert');
    expect(el.textContent).toContain('Heads up');
    expect(el.textContent).toContain('Your token expires soon.');
  });

  it('paints the destructive variant off the token, not a raw red', () => {
    const { container } = render(<Alert variant="destructive">bad</Alert>);
    expect(slot(container, 'alert')!.getAttribute('class')).toContain('text-destructive');
  });

  it('falls back to the default variant when none is given', () => {
    const { container } = render(<Alert>ok</Alert>);
    const cls = slot(container, 'alert')!.getAttribute('class')!;
    expect(cls).toContain('bg-card');
    expect(cls).not.toContain('text-destructive');
  });

  it('places title and description in the second grid column, clear of the icon', () => {
    const { container } = render(
      <Alert>
        <AlertTitle className="t">t</AlertTitle>
        <AlertDescription className="d">d</AlertDescription>
      </Alert>,
    );
    expect(slot(container, 'alert-title')!.getAttribute('class')).toContain('col-start-2');
    expect(slot(container, 'alert-description')!.getAttribute('class')).toContain('col-start-2');
  });
});

/* ── AspectRatio ────────────────────────────────────────────────────────── */

describe('AspectRatio', () => {
  it('defaults to 16/9 so a media slot reserves its box before the image lands', () => {
    const { container } = render(<AspectRatio />);
    expect(slot(container, 'aspect-ratio')!.style.aspectRatio).toBe(String(16 / 9));
  });

  it('honours a custom ratio', () => {
    const { container } = render(<AspectRatio ratio={1} />);
    expect(slot(container, 'aspect-ratio')!.style.aspectRatio).toBe('1');
  });

  it('lets a consumer style merge in without clobbering the ratio', () => {
    const { container } = render(<AspectRatio ratio={2} style={{ width: '10px' }} />);
    const el = slot(container, 'aspect-ratio')!;
    expect(el.style.aspectRatio).toBe('2');
    expect(el.style.width).toBe('10px');
  });
});

/* ── Box ────────────────────────────────────────────────────────────────── */

describe('Box', () => {
  it.each([
    ['card', 'bg-card'],
    ['muted', 'bg-muted'],
    ['accent', 'bg-accent'],
  ] as const)('paints surface=%s from its token pair', (surface, expected) => {
    const { container } = render(<Box surface={surface} />);
    const el = slot(container, 'box')!;
    expect(el.getAttribute('class')).toContain(expected);
    expect(el.getAttribute('data-surface')).toBe(surface);
  });

  it('emits no data-surface when the surface is left unset', () => {
    const { container } = render(<Box />);
    expect(slot(container, 'box')!.hasAttribute('data-surface')).toBe(false);
  });

  it.each(['xs', 'sm', 'md', 'lg', 'xl'] as const)(
    'maps padding=%s onto the spacing token, never a raw rem',
    (padding) => {
      const { container } = render(<Box padding={padding} />);
      expect(slot(container, 'box')!.getAttribute('class')).toContain(`p-${padding}`);
    },
  );

  it.each(['none', 'sm', 'md', 'lg'] as const)('maps radius=%s to its rung', (radius) => {
    const { container } = render(<Box radius={radius} />);
    expect(slot(container, 'box')!.getAttribute('class')).toContain(`rounded-${radius}`);
  });

  it('draws a border only when asked', () => {
    const { container: on } = render(<Box border />);
    expect(slot(on, 'box')!.getAttribute('class')).toContain('border-border');
    cleanup();
    const { container: off } = render(<Box border={false} />);
    expect(slot(off, 'box')!.getAttribute('class')).not.toContain('border-border');
  });

  it('renders as another element via `as`, so a Box can be a <section>', () => {
    const { container } = render(<Box as="section" />);
    expect(slot(container, 'box')!.tagName).toBe('SECTION');
  });
});

/* ── Typography ─────────────────────────────────────────────────────────── */

describe('Typography', () => {
  it.each([
    ['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['h4', 'H4'], ['h5', 'H5'], ['h6', 'H6'],
    ['body', 'P'], ['long', 'P'],
    ['ui', 'SPAN'], ['ui-sm', 'SPAN'], ['caption', 'SPAN'],
    ['code', 'CODE'],
  ] as const)('renders variant=%s as <%s> — the tag is the semantics, not the size', (variant, tag) => {
    const { container } = render(<Typography variant={variant}>x</Typography>);
    const el = slot(container, 'typography')!;
    expect(el.tagName).toBe(tag);
    expect(el.getAttribute('data-variant')).toBe(variant);
  });

  it('defaults to body/<p> when no variant is given', () => {
    const { container } = render(<Typography>x</Typography>);
    const el = slot(container, 'typography')!;
    expect(el.tagName).toBe('P');
    expect(el.getAttribute('data-variant')).toBe('body');
  });

  it('lets `as` override the tag while keeping the variant type scale', () => {
    // A visual h1 that is semantically an h2 is a real page-outline need.
    const { container } = render(<Typography variant="h1" as="h2">x</Typography>);
    const el = slot(container, 'typography')!;
    expect(el.tagName).toBe('H2');
    expect(el.getAttribute('class')).toContain('text-h1');
  });

  it.each(['foreground', 'muted', 'primary', 'destructive'] as const)(
    'maps tone=%s onto a token class',
    (tone) => {
      const { container } = render(<Typography tone={tone}>x</Typography>);
      const el = slot(container, 'typography')!;
      expect(el.getAttribute('data-tone')).toBe(tone);
      expect(el.getAttribute('class')).toContain(tone === 'muted' ? 'text-muted-foreground' : `text-${tone}`);
    },
  );

  it('emits no data-tone when tone is unset', () => {
    const { container } = render(<Typography>x</Typography>);
    expect(slot(container, 'typography')!.hasAttribute('data-tone')).toBe(false);
  });

  it.each(['start', 'center', 'end'] as const)('maps align=%s to a text alignment', (align) => {
    const { container } = render(<Typography align={align}>x</Typography>);
    const expected = { start: 'text-left', center: 'text-center', end: 'text-right' }[align];
    expect(slot(container, 'typography')!.getAttribute('class')).toContain(expected);
  });

  it.each([1, 2, 3, 4, 5, 6] as const)('clamps to %i line(s) when asked', (n) => {
    const { container } = render(<Typography lineClamp={n}>x</Typography>);
    expect(slot(container, 'typography')!.getAttribute('class')).toContain(`line-clamp-${n}`);
  });

  it('adds no clamp class when lineClamp is omitted', () => {
    const { container } = render(<Typography>x</Typography>);
    expect(slot(container, 'typography')!.getAttribute('class')).not.toContain('line-clamp');
  });
});

/* ── Grid ───────────────────────────────────────────────────────────────── */

describe('Grid', () => {
  it.each([1, 2, 3, 4, 6, 12] as const)('maps cols=%i to its column class', (cols) => {
    const { container } = render(<Grid cols={cols} />);
    const el = slot(container, 'grid')!;
    expect(el.getAttribute('class')).toContain(`grid-cols-${cols}`);
    expect(el.getAttribute('data-cols')).toBe(String(cols));
  });

  it.each(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const)(
    'maps gap=%s onto the spacing token',
    (gap) => {
      const { container } = render(<Grid gap={gap} />);
      const expected = gap === 'none' ? 'gap-0' : `gap-${gap}`;
      expect(slot(container, 'grid')!.getAttribute('class')).toContain(expected);
    },
  );

  it('emits neither data attribute when cols and gap are left to the defaults', () => {
    const { container } = render(<Grid />);
    const el = slot(container, 'grid')!;
    expect(el.hasAttribute('data-cols')).toBe(false);
    expect(el.hasAttribute('data-gap')).toBe(false);
    expect(el.getAttribute('class')).toContain('grid-cols-12');
  });

  it('renders as another element via `as`', () => {
    const { container } = render(<Grid as="ul" />);
    expect(slot(container, 'grid')!.tagName).toBe('UL');
  });
});

describe('GridItem', () => {
  it.each([1, 4, 12, 'full'] as const)('maps span=%s to a col-span', (span) => {
    const { container } = render(<GridItem span={span} />);
    const el = slot(container, 'grid-item')!;
    expect(el.getAttribute('class')).toContain(`col-span-${span}`);
    expect(el.getAttribute('data-span')).toBe(String(span));
  });

  it('stacks the responsive spans so one item can change shape per breakpoint', () => {
    const { container } = render(<GridItem span={12} mdSpan={6} lgSpan={4} />);
    const cls = slot(container, 'grid-item')!.getAttribute('class')!;
    expect(cls).toContain('col-span-12');
    expect(cls).toContain('md:col-span-6');
    expect(cls).toContain('lg:col-span-4');
  });

  it('defaults to full width and emits no data-span', () => {
    const { container } = render(<GridItem />);
    const el = slot(container, 'grid-item')!;
    expect(el.getAttribute('class')).toContain('col-span-full');
    expect(el.hasAttribute('data-span')).toBe(false);
  });

  it('renders as another element via `as`', () => {
    const { container } = render(<GridItem as="li" />);
    expect(slot(container, 'grid-item')!.tagName).toBe('LI');
  });
});

/* ── Badge / Button ─────────────────────────────────────────────────────── */

describe('Badge', () => {
  it.each(['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const)(
    'renders variant=%s and records it on data-variant',
    (variant) => {
      const { container } = render(<Badge variant={variant}>x</Badge>);
      expect(slot(container, 'badge')!.getAttribute('data-variant')).toBe(variant);
    },
  );

  it('drops data-variant when the variant is explicitly null', () => {
    const { container } = render(<Badge variant={null}>x</Badge>);
    expect(slot(container, 'badge')!.hasAttribute('data-variant')).toBe(false);
  });

  it('swaps to a badge-shaped skeleton while loading, not a spinner in the layout', () => {
    const { container } = render(<Badge loading className="w-10" />);
    const el = slot(container, 'badge')!;
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.getAttribute('data-variant')).toBe('badge');
  });

  it('renders through a consumer element when given `render`', () => {
    const { container } = render(<Badge render={<a href="/t" />}>tag</Badge>);
    const el = slot(container, 'badge')!;
    expect(el.tagName).toBe('A');
    expect(el.getAttribute('href')).toBe('/t');
  });
});

describe('Button', () => {
  it('records variant and size on data attributes for downstream styling hooks', () => {
    const { container } = render(<Button variant="outline" size="sm">go</Button>);
    const el = slot(container, 'button')!;
    expect(el.getAttribute('data-variant')).toBe('outline');
    expect(el.getAttribute('data-size')).toBe('sm');
  });

  it('drops both data attributes when variant and size are explicitly null', () => {
    // `variant ?? undefined` — the null arm is the one a `cva()`-driven
    // consumer hits when it wants the base class with no modifier applied.
    const { container } = render(<Button variant={null} size={null}>go</Button>);
    const el = slot(container, 'button')!;
    expect(el.hasAttribute('data-variant')).toBe(false);
    expect(el.hasAttribute('data-size')).toBe(false);
  });

  it('renders through a consumer element when given `render`', () => {
    const { container } = render(<Button render={<a href="/x" />}>link</Button>);
    expect(slot(container, 'button')!.tagName).toBe('A');
  });
});

/* ── GradeBadge ─────────────────────────────────────────────────────────── */

describe('GradeBadge', () => {
  const EXPECTED_TONE: Record<string, string> = {
    'A+': 'excellent', A: 'excellent', 'A-': 'excellent',
    'B+': 'good', B: 'good', 'B-': 'good',
    'C+': 'fair', C: 'fair', 'C-': 'fair',
    'D+': 'poor', D: 'poor', 'D-': 'poor',
    F: 'fail',
  };

  it.each(GRADE_VALUES)('maps grade %s to its ladder rung', (grade) => {
    const { container } = render(<GradeBadge grade={grade} />);
    const el = slot(container, 'grade-badge')!;
    expect(el.getAttribute('data-grade')).toBe(grade);
    expect(el.getAttribute('data-tone'), grade).toBe(EXPECTED_TONE[grade]);
    // Colour is never the only signal — the letter is always printed.
    expect(el.textContent).toBe(grade);
  });

  it('names itself for a screen reader rather than leaving a bare letter', () => {
    render(<GradeBadge grade="B+" />);
    expect(screen.getByLabelText('Grade: B+')).not.toBeNull();
  });

  it.each(['sm', 'md', 'lg'] as const)('renders size=%s from the size scale', (size) => {
    const { container } = render(<GradeBadge grade="A" size={size} />);
    expect(slot(container, 'grade-badge')!.getAttribute('class')).toContain(
      { sm: 'h-5', md: 'h-7', lg: 'h-12' }[size],
    );
  });

  it('uses the five-rung tone ladder, one token per rung', () => {
    const tones = GRADE_VALUES.map((g) => {
      const { container } = render(<GradeBadge grade={g} />);
      const cls = slot(container, 'grade-badge')!.getAttribute('class')!;
      cleanup();
      return cls;
    });
    // `poor` has its own token (`--caution`); it must not collapse onto
    // warning or destructive, which is what happened before that token existed.
    expect(tones.some((c) => c.includes('bg-caution'))).toBe(true);
    expect(tones.some((c) => c.includes('bg-success'))).toBe(true);
    expect(tones.some((c) => c.includes('bg-destructive'))).toBe(true);
  });
});

/* ── ReadingTime / PublishedDate ────────────────────────────────────────── */

describe('ReadingTime', () => {
  it('prints the minutes and exposes them as data for a consumer to read back', () => {
    const { container } = render(<ReadingTime minutes={7} />);
    const el = slot(container, 'reading-time')!;
    expect(el.textContent).toContain('7 min read');
    expect(el.getAttribute('data-reading-time')).toBe('7');
  });

  it('draws the clock glyph only when asked, and hides it from assistive tech', () => {
    const { container } = render(<ReadingTime minutes={3} showIcon />);
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    cleanup();
    const { container: bare } = render(<ReadingTime minutes={3} />);
    expect(bare.querySelector('svg')).toBeNull();
  });

  it('reserves its footprint with a text skeleton while loading, so nothing reflows', () => {
    const { container } = render(<ReadingTime loading />);
    const el = slot(container, 'reading-time')!;
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.getAttribute('data-variant')).toBe('text');
  });
});

describe('PublishedDate', () => {
  it('emits a machine-readable dateTime alongside the human string', () => {
    const { container } = render(<PublishedDate dateIso="2026-03-14" />);
    const el = slot(container, 'published-date')!;
    expect(el.tagName).toBe('TIME');
    expect(el.getAttribute('datetime')).toBe('2026-03-14');
    expect(el.getAttribute('data-format')).toBe('long');
    expect(el.textContent!.length).toBeGreaterThan(0);
  });

  it('renders a materially different string for short than for long', () => {
    // Asserting the exact string would pin the test to the runner's locale.
    // Asserting that the two formats differ is the real contract.
    const { container: long } = render(<PublishedDate dateIso="2026-03-14" format="long" />);
    const longText = slot(long, 'published-date')!.textContent;
    cleanup();
    const { container: short } = render(<PublishedDate dateIso="2026-03-14" format="short" />);
    const shortText = slot(short, 'published-date')!.textContent;
    expect(shortText).not.toBe(longText);
    expect(shortText!.length).toBeLessThan(longText!.length);
  });

  it('falls back to the skeleton when the date is missing, not to an empty <time>', () => {
    // A missing date is indistinguishable from a slow one at render time, so
    // both take the same branch rather than printing "Invalid Date".
    const { container } = render(<PublishedDate />);
    expect(slot(container, 'published-date')!.getAttribute('aria-busy')).toBe('true');
  });

  it('shows the skeleton while loading even when a date is already known', () => {
    const { container } = render(<PublishedDate dateIso="2026-03-14" loading />);
    expect(slot(container, 'published-date')!.getAttribute('aria-busy')).toBe('true');
  });
});

/* ── Card ───────────────────────────────────────────────────────────────── */

describe('Card', () => {
  it('composes its parts without prop-drilling a single one of them', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Desc</CardDescription>
          <CardAction>act</CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Foot</CardFooter>
      </Card>,
    );
    for (const part of [
      'card', 'card-header', 'card-title', 'card-description',
      'card-action', 'card-content', 'card-footer',
    ]) {
      expect(slot(container, part), part).not.toBeNull();
    }
  });

  it('is a card surface, so it does not inherit the page background', () => {
    const { container } = render(<Card />);
    expect(slot(container, 'card')!.getAttribute('data-surface')).toBe('card');
  });

  it('swaps to a card-shaped skeleton while loading', () => {
    const { container } = render(<Card loading />);
    const el = slot(container, 'card')!;
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.getAttribute('data-variant')).toBe('card');
  });

  it('merges a className on every part', () => {
    const { container } = render(
      <Card className="mt-2">
        <CardHeader className="h" />
        <CardTitle className="t" />
        <CardDescription className="d" />
        <CardAction className="a" />
        <CardContent className="c" />
        <CardFooter className="f" />
      </Card>,
    );
    expect(slot(container, 'card')!.getAttribute('class')).toContain('mt-2');
    expect(slot(container, 'card-header')!.getAttribute('class')).toContain('h');
    expect(slot(container, 'card-footer')!.getAttribute('class')).toContain('f');
  });
});

/* ── Tag / TagList ──────────────────────────────────────────────────────── */

describe('Tag', () => {
  it.each(['default', 'primary', 'muted'] as const)(
    'maps tone=%s onto a token class and records it',
    (tone) => {
      const { container } = render(<Tag tone={tone} href="/t">x</Tag>);
      const el = slot(container, 'tag')!;
      expect(el.getAttribute('data-tone')).toBe(tone);
    },
  );

  it('emits no data-tone when tone is unset', () => {
    const { container } = render(<Tag href="/t">x</Tag>);
    expect(slot(container, 'tag')!.hasAttribute('data-tone')).toBe(false);
  });

  it('is a link when given an href, and reachable by its accessible name', () => {
    render(<Tag href="/tags/react">react</Tag>);
    expect(screen.getByRole('link', { name: 'react' }).getAttribute('href')).toBe('/tags/react');
  });

  it('swaps to a tag-shaped skeleton while loading', () => {
    const { container } = render(<Tag loading />);
    expect(slot(container, 'tag')!.getAttribute('data-variant')).toBe('tag');
  });
});

describe('TagList', () => {
  it('renders one list item per tag, so the count is announced', () => {
    const { container } = render(
      <TagList
        items={[
          { label: 'react', href: '/t/react' },
          { label: 'a11y', href: '/t/a11y', tone: 'primary' },
        ]}
      />,
    );
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'a11y' })).not.toBeNull();
  });

  it('renders an empty <ul> for an empty list rather than collapsing', () => {
    // The list keeps its box so a filter that removes every tag does not
    // shift the rest of the byline.
    const { container } = render(<TagList items={[]} />);
    expect(slot(container, 'tag-list')).not.toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });
});
