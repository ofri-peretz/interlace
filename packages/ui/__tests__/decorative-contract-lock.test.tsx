/**
 * Decorative & pattern contract lock.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * `src/effects/` and the decorative half of `src/patterns/`
 * are the DS's least-tested surface, because almost nothing about them is
 * visible to the tools that guard the rest of it:
 *
 *   - `motion-contract-lock` reads CSS. Every animation in these files that
 *     matters is JS-driven (`motion/react`, canvas, rAF), which that lock
 *     states plainly is out of its scope.
 *   - Storybook's axe sweep sees one story's default props, in the state that
 *     story paints, under a preview.css that has already clamped motion.
 *   - jsdom reports every box as 0×0, so nothing here can be checked by
 *     looking at layout.
 *
 * What IS observable is the props and classes a component EMITS. So that is
 * what this file asserts, with `useReducedMotion` mocked so the preference is
 * known at mount rather than one effect late. Each `it` below corresponds to a
 * defect that shipped; the comment on each names what it looked like.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT CLAIM
 * ------------------------------------------
 * That any of it *renders* correctly. A `transform: none` in jsdom means motion
 * wrote no transform, not that a user sees a still list; a `filter: url(#x)`
 * means the reference is unique, not that the goo resolves. Those need a real
 * browser and are the Storybook sweep's job. This file's job is the narrower
 * one those tools cannot do: proving the component asked for the right thing.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── the reduced-motion seam ─────────────────────────────────────────────
//
// Mocked rather than driven through `window.matchMedia`, and the reason is
// worth recording: `lib/use-reduced-motion.ts` is SSR-safe, so it returns
// `false` on the first render and only reports the true preference once its
// effect has run. Driving it through matchMedia therefore tests the hook's
// latency, not the component's gate — every assertion below would read the
// un-gated mount frame and pass or fail for the wrong reason. Mocking pins
// the question this file is actually asking: GIVEN the preference, what does
// the component emit?

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { SectionHeader } = await import('../src/patterns/section-header.js');
const { ArticleCard, FeaturedArticleCard } = await import(
  '../src/patterns/article-card.js'
);
type ArticleCardImageProps = import('../src/patterns/article-card.js').ArticleCardImageProps;

// ── jsdom shims ─────────────────────────────────────────────────────────
//
// None of these make the components *work* in jsdom — they make them reach the
// code path under test instead of bailing out at a missing global, which would
// turn every assertion below into a vacuous pass.

class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  reduced.value = false;
  vi.stubGlobal('IntersectionObserver', StubObserver);
  vi.stubGlobal('ResizeObserver', StubObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

// ════════════════════════════════════════════════════════════════════════
// A. Reduced motion
// ════════════════════════════════════════════════════════════════════════

describe('ArticleCard — the hover zoom carries its own gate', () => {
  it('gates the cover scale with motion-safe:, not with preflight alone', () => {
    // THE DEFECT: the cover was `transition-transform group-hover:scale-105`
    // with no gate of any kind, so the ONLY thing stopping a 5% zoom under
    // `reduce` was the `transition-duration: 0.01ms` wildcard in page/preflight.css.
    // Every stylesheet in this package is its own `exports` entry —
    // `motion-contract-lock` treats the structure/motion.css-without-preflight path as
    // live, and it is the reason `styles/index.css` exists. On that path there
    // was no gate at all, and unlike an `animate-*` utility, a `transition-*`
    // has no allowlist to be added to. `motion-safe:` compiles the media query
    // into the utility itself, so it travels with the class.
    render(
      <ArticleCard
        data-testid="card"
        title="T"
        href="#"
        imageUrl="https://example.com/c.png"
      />,
    );
    const cover = document.querySelector('img')!;
    const classes = cover.className.split(/\s+/);

    expect(classes).toContain('motion-safe:group-hover:scale-105');
    expect(
      classes,
      'A bare `group-hover:scale-105` is back on the cover. It applies ' +
        'regardless of preference; only the transition DURATION was ever ' +
        'clamped, and only when page/preflight.css is loaded.',
    ).not.toContain('group-hover:scale-105');
  });
});

// ════════════════════════════════════════════════════════════════════════
// B. Props that lie
// ════════════════════════════════════════════════════════════════════════

describe('SectionHeader — `align` reaches the eyebrow', () => {
  it('left-aligns the eyebrow row under align="start"', () => {
    // THE DEFECT: the eyebrow wrapper was a hard-coded `justify-center`. The
    // root's `text-left` cannot place a flex child on its main axis, so under
    // `align="start"` the eyebrow floated centred over a left-aligned heading.
    render(
      <SectionHeader align="start" eyebrow={<span>Eyebrow</span>} title="T" />,
    );
    const row = document.querySelector('[data-slot="section-header-eyebrow"]')!;
    expect(row.className).toContain('justify-start');
    expect(row.className).not.toContain('justify-center');
  });

  it('still centres it by default', () => {
    render(<SectionHeader eyebrow={<span>Eyebrow</span>} title="T" />);
    const row = document.querySelector('[data-slot="section-header-eyebrow"]')!;
    expect(row.className).toContain('justify-center');
  });
});

// ════════════════════════════════════════════════════════════════════════
// C. Correctness
// ════════════════════════════════════════════════════════════════════════

describe('ArticleCard — dates are pinned to UTC', () => {
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });

  it('renders a date-only ISO string as itself, west of UTC', () => {
    // THE DEFECT: `toLocaleDateString` with no `timeZone`. "2026-05-10" parses
    // as UTC midnight and is then re-projected into the reader's zone, so
    // every reader west of UTC saw "May 9". This ships on a live site, and
    // `patterns/author-byline.tsx` already pinned UTC — so the same article
    // could print two different dates on two surfaces of the same page.
    //
    // Node re-reads `process.env.TZ` per call, which is what makes this an
    // end-to-end check rather than an assertion about an options object.
    process.env.TZ = 'America/Los_Angeles';

    render(
      <ArticleCard data-testid="card" title="T" href="#" publishedAt="2026-05-10" />,
    );

    const byline = document.querySelector(
      '[data-slot="article-card-byline"]',
    )!;
    expect(
      byline.textContent,
      'The card rendered the day before the date it was given. Without ' +
        '`timeZone: UTC` the whole Western hemisphere reads every date-only ' +
        'string one day early.',
    ).toContain('May 10, 2026');
  });

  it('agrees with AuthorByline in a zone east of UTC too', () => {
    process.env.TZ = 'Asia/Tokyo';
    render(
      <ArticleCard data-testid="card" title="T" href="#" publishedAt="2026-05-10" />,
    );
    expect(
      document.querySelector('[data-slot="article-card-byline"]')!.textContent,
    ).toContain('May 10, 2026');
  });
});

// ════════════════════════════════════════════════════════════════════════
// E. Tokens
// ════════════════════════════════════════════════════════════════════════
//
// R19 is "tokens only", but for these components the interesting question
// is not whether a literal is gone — it is whether what replaced it is
// ADMISSIBLE, which depends on what the colour is doing. The DS gates SC 1.4.3
// / 1.4.11 by token maths rather than by axe (see composite-contrast-lock), so
// the check is arithmetic, on the same theme file.

type RGB = [number, number, number];

function parseHex(hex: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h =
    m[1].length === 3
      ? m[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : m[1];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: RGB): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrast(a: RGB, b: RGB): number {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// The palette (brand) and the names bound to it (semantics), read as one.
const THEME_CSS = ['brand/interlace.css', 'semantics.css'].map((f) =>
  resolve(__dirname, '../styles', f),
);

/**
 * Drop block and whole-line `//` comments, so a class NAMED in prose is never
 * read as a class APPLIED to an element. These headers document the defects
 * they used to have; without this, every fix would fail its own lock.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function readTheme(): Record<'light' | 'dark', Map<string, RGB>> {
  const css = THEME_CSS.map((f) => readFileSync(f, 'utf8')).join('\n');
  const darkAt = css.indexOf(".dark,\n  [data-scheme='dark']");
  expect(
    darkAt,
    'brand/interlace.css no longer contains the expected dark-mode selector.',
  ).toBeGreaterThan(-1);

  const out = { light: new Map(), dark: new Map() } as Record<
    'light' | 'dark',
    Map<string, RGB>
  >;
  const sections = { light: css.slice(0, darkAt), dark: css.slice(darkAt) };
  for (const mode of ['light', 'dark'] as const) {
    const re = /--interlace-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sections[mode])) !== null) {
      const rgb = parseHex(m[2]);
      if (rgb) out[mode].set(m[1], rgb);
    }
  }
  return out;
}

/** The prop defaults, read out of source — the values a consumer actually gets. */
function defaultsOf(file: string): Record<string, string> {
  const source = readFileSync(resolve(__dirname, '../src', file), 'utf8');
  const out: Record<string, string> = {};
  for (const m of source.matchAll(
    /^\s{2,6}(\w+) = ['"]([^'"]+)['"],?$/gm,
  )) {
    out[m[1]] = m[2];
  }
  return out;
}

const AA_NORMAL = 4.5;

describe('token defaults, weighed against what the colour is doing', () => {
  const theme = readTheme();

  it('parses the palette it is about to measure against', () => {
    // Every assertion below is a lookup. An empty map passes all of them.
    for (const mode of ['light', 'dark'] as const) {
      expect(theme[mode].size).toBeGreaterThan(10);
      for (const token of ['primary', 'primary-active', 'background', 'scrim']) {
        expect(theme[mode].has(token), `${mode} is missing --interlace-${token}`)
          .toBe(true);
      }
    }
  });

  it('SheenText: both stops are text-grade in both schemes', () => {
    // The gradient is clipped to the glyphs, so its stops are not decoration
    // behind the words: they ARE the words, and SC 1.4.3 binds at 4.5:1. The
    // component this one replaced shipped a stop that measured ~2:1 on white.
    const defaults = defaultsOf('effects/sheen-text.tsx');
    expect(defaults.from).toBe('var(--primary)');
    expect(defaults.to).toBe('var(--primary-active)');

    for (const mode of ['light', 'dark'] as const) {
      const surface = theme[mode].get('background')!;
      for (const token of ['primary', 'primary-active']) {
        const ratio = contrast(theme[mode].get(token)!, surface);
        expect(
          ratio,
          `${mode}: --interlace-${token} measures ${ratio.toFixed(2)}:1 on the ` +
            `page background. It is glyph fill, so it must clear ${AA_NORMAL}:1.`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    }
  });

  it('…and would have failed on the literals it replaced (negative control)', () => {
    // A contrast check that never returns a low number has stopped reading the
    // palette. Measure the values that actually shipped.
    //
    // Note what the numbers say, because it is not "both were terrible":
    // `#9c40ff` clears AA on white at 4.57:1 — it fails in DARK mode, at
    // 4.29:1 — while `#ffaa40` fails catastrophically on white at 1.90:1 and
    // is fine on the dark surface. A fixed literal cannot be right in both
    // schemes, which is the argument for a token rather than for a better hex.
    // So the claim is per-mode: in each scheme, at least one stop failed.
    const OLD = ['#ffaa40', '#9c40ff'].map((hex) => parseHex(hex)!);

    for (const mode of ['light', 'dark'] as const) {
      const surface = theme[mode].get('background')!;
      const ratios = OLD.map((literal) => contrast(literal, surface));
      expect(
        Math.min(...ratios),
        `${mode}: both old literals cleared AA (${ratios
          .map((r) => r.toFixed(2))
          .join(', ')}). If that is genuinely true now, the palette moved and ` +
          `this control needs rewriting — it is meant to prove the check ` +
          `above can return a failing number at all.`,
      ).toBeLessThan(AA_NORMAL);
    }
  });

  it('Sheen: light from the primary pair, so it reads on the primary button', () => {
    // Sheen sits under the label at z-index -1 inside the button, so it never
    // touches the text pair. Its default is the button's own foreground token.
    const defaults = defaultsOf('effects/sheen.tsx');
    expect(defaults.color).toBe('var(--primary-foreground)');
  });

  it('EdgeGlow: on tokens, and allowed a 3:1-grade one because it is not text', () => {
    // The arc is decoration inside a container that draws its own border: not
    // text (1.4.3), not the boundary identifying a control (1.4.11). So a
    // `--chart-*` token, tuned to the 3:1 graphical floor, is admissible here
    // where in SheenText it would not be.
    const defaults = defaultsOf('effects/edge-glow.tsx');
    expect(defaults.from).toBe('var(--primary)');
    expect(defaults.to).toBe('var(--chart-2)');
  });

  it('CountUp: takes the colour of the text around it', () => {
    // The component it replaced hand-rolled `text-black dark:text-white`, an
    // approximation of the foreground that was wrong under both themes. A
    // number in a sentence should simply inherit.
    const code = stripComments(
      readFileSync(resolve(__dirname, '../src/effects/count-up.tsx'), 'utf8'),
    );
    expect(code).not.toMatch(/text-(black|white)\b/);
    expect(code).not.toMatch(/['"]#[0-9a-f]{3,8}['"]/i);
  });
});

// ════════════════════════════════════════════════════════════════════════
// F. Things a real consumer tree found that no story did
// ════════════════════════════════════════════════════════════════════════
//
// Everything below came out of upgrading ofriperetz.dev — 50 installed items —
// onto the current registry. The pattern is the same in all three: the DS was
// not wrong in isolation, it was missing the seam the consumer needed, so the
// consumer re-patched the component locally and the DS never heard about it.

describe('ArticleCard — the cover is a slot, and the box is the cover’s ratio', () => {
  const COVER = 'https://example.com/cover.png';

  it('defaults to a plain <img> with the props it always had', () => {
    render(
      <ArticleCard data-testid="card" title="T" href="#" imageUrl={COVER} />,
    );
    const img = document.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(COVER);
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('width')).toBe('1000');
    expect(img.getAttribute('height')).toBe('420');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
  });

  it('hands renderImage the full bag and renders THAT instead', () => {
    // THE DEFECT: the DS shipped a hard `<img>`, so every Next.js consumer
    // replaced it by hand with `next/image` — a fork of the component for one
    // element. The DS cannot import `next/image` and stay framework-agnostic,
    // so the seam is a render prop.
    const seen: ArticleCardImageProps[] = [];
    render(
      <ArticleCard
        data-testid="card"
        title="T"
        href="#"
        imageUrl={COVER}
        priority
        renderImage={(props) => {
          seen.push(props);
          return <picture data-testid="custom-cover" />;
        }}
      />,
    );

    expect(seen, 'renderImage was never called').toHaveLength(1);
    const [bag] = seen;
    expect(bag.src).toBe(COVER);
    expect(bag.alt).toBe('');
    expect(bag.width).toBe(1000);
    expect(bag.height).toBe(420);
    // `priority` has to survive the seam — it is the LCP hint, and a consumer
    // reconstructing it from nothing is exactly the re-patching this removes.
    expect(bag.loading).toBe('eager');
    expect(bag.fetchPriority).toBe('high');
    expect(bag.decoding).toBe('async');

    // The class string is the contract, not the element: it carries the fit
    // AND the reduced-motion gate, so an adapter that forwards it keeps both.
    expect(bag.className).toContain('object-cover');
    expect(bag.className).toContain('motion-safe:group-hover:scale-105');

    // Replaced, not augmented.
    expect(document.querySelector('picture')).not.toBeNull();
    expect(
      document.querySelectorAll('img'),
      'The default <img> is still in the tree next to the slot output, so the ' +
        'consumer now ships two covers and downloads the image twice.',
    ).toHaveLength(0);
  });

  it('reaches the featured card too', () => {
    const seen: ArticleCardImageProps[] = [];
    render(
      <FeaturedArticleCard
        data-testid="hero"
        title="T"
        href="#"
        imageUrl={COVER}
        renderImage={(props) => {
          seen.push(props);
          return <picture />;
        }}
      />,
    );
    expect(seen, 'the hero shape ignores renderImage').toHaveLength(1);
  });

  it('is not called at all without an imageUrl', () => {
    // The gradient-and-title fallback is the card's own chrome. Calling the
    // slot with an empty `src` would push a broken-image request onto every
    // adapter.
    const renderImage = vi.fn(() => <picture />);
    render(<ArticleCard data-testid="card" title="T" href="#" renderImage={renderImage} />);
    expect(renderImage).not.toHaveBeenCalled();
  });

  it('reserves the cover’s own aspect ratio, not a fixed height', () => {
    // THE DEFECT: `h-44` — a fixed 176px HEIGHT, which fixes nothing about the
    // ratio, because the ratio then floats with the card's width. At the 320px
    // floor a tile is ~302px wide: a 1.72:1 box holding a 2.38:1 cover, so
    // `object-cover` scales the image to 419px to cover 176px of height and the
    // box discards 117 of them — 28% of the cover, and a different figure at
    // every breakpoint.
    //
    // jsdom reports every box as 0x0, so this cannot be measured by layout.
    // What IS checkable is the coupling the fix rests on: the reserved ratio
    // and the declared intrinsic size must be the same number.
    render(
      <ArticleCard data-testid="card" title="T" href="#" imageUrl={COVER} />,
    );
    const img = document.querySelector('img')!;
    const box = img.parentElement!;

    expect(
      box.className,
      'The cover box is back on a fixed height. A height cannot hold a ratio.',
    ).not.toMatch(/\bh-\d+\b/);

    const aspect = /aspect-\[(\d+)\/(\d+)\]/.exec(box.className);
    expect(aspect, `no aspect-[W/H] on the cover box (got "${box.className}")`)
      .not.toBeNull();

    const [, w, h] = aspect!;
    expect(
      [w, h],
      `The cover box reserves ${w}/${h} while the image declares ` +
        `${img.getAttribute('width')}/${img.getAttribute('height')}. ` +
        `object-cover crops the difference.`,
    ).toEqual([img.getAttribute('width'), img.getAttribute('height')]);
  });

  it('keeps object-center, because with the box fixed there is nothing to bias', () => {
    // The consumer also moved `object-center` to `object-left`. That was a
    // workaround for the crop above — bias the surviving window toward the
    // side its cover art puts the title on — and the crop is now zero for a
    // 1000x420 cover at every width. For a cover of some OTHER ratio, centre
    // is the neutral default; `object-left` would bake one consumer's art
    // direction into the design system. A caller who wants it owns the class
    // through `renderImage`.
    render(
      <ArticleCard data-testid="card" title="T" href="#" imageUrl={COVER} />,
    );
    const classes = document.querySelector('img')!.className.split(/\s+/);
    expect(classes).toContain('object-center');
    expect(classes).not.toContain('object-left');
  });
});

// ════════════════════════════════════════════════════════════════════════
// The one defect with no runtime and no type-level symptom
// ════════════════════════════════════════════════════════════════════════

