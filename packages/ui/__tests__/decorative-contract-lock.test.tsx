/**
 * Decorative & pattern contract lock.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * `src/magicui/`, `src/aceternity/` and the decorative half of `src/patterns/`
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

const { AnimatedList, AnimatedListItem } = await import(
  '../src/magicui/animated-list.js'
);
const { Marquee } = await import('../src/magicui/marquee.js');
const { Particles } = await import('../src/magicui/particles.js');
const { ShootingStars, Meteors } = await import(
  '../src/aceternity/stars-background.js'
);
const { BackgroundLines } = await import('../src/aceternity/background-lines.js');
const { BackgroundGradientAnimation } = await import(
  '../src/aceternity/background-gradient-animation.js'
);
const { SectionHeader } = await import('../src/patterns/section-header.js');
const { ArticleCard } = await import('../src/patterns/article-card.js');

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

/** Enough of a 2D context for the particle field to seed and paint. */
function stubCanvas() {
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    translate: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  return ctx;
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

const styleOf = (el: Element) => el.getAttribute('style') ?? '';

// ════════════════════════════════════════════════════════════════════════
// A. Reduced motion
// ════════════════════════════════════════════════════════════════════════

describe('AnimatedList — reduced motion reaches the ITEM, not just the list', () => {
  // An ARRAY, not a fragment: `AnimatedList` counts its children with
  // `Children.toArray`, which sees a single Fragment as one child. Wrapping
  // these in `<>…</>` yields a one-entry feed and quietly weakens every
  // assertion below.
  const feed = [
    <div key="a">A</div>,
    <div key="b">B</div>,
    <div key="c">C</div>,
  ];

  it('mounts every entry settled, with no spring pop-in', () => {
    // THE DEFECT: the list correctly killed auto-advance and revealed all
    // three at once, and then every one of them sprang in from `scale: 0`
    // simultaneously — a bigger movement than the staggered version it
    // replaced. `AnimatedListItem` passed `initial={{ scale: 0, opacity: 0 }}`
    // unconditionally. `motion/react` writes inline styles, so neither the
    // preflight wildcard nor the tokens.css allowlist could reach it, and no
    // `MotionConfig` wrapped the tree.
    reduced.value = true;
    render(<AnimatedList data-testid="feed">{feed}</AnimatedList>);

    const items = [
      ...document.querySelectorAll('[data-slot="animated-list-item"]'),
    ];
    expect(items).toHaveLength(3);

    for (const item of items) {
      expect(
        styleOf(item),
        'An entry mounted mid-animation under `reduce`. motion writes the ' +
          '`initial` keyframe as an inline style, so `scale(0)` here means the ' +
          'pop-in is still running.',
      ).not.toContain('scale(0)');
      expect(styleOf(item)).not.toContain('opacity: 0');
    }
  });

  it('still plays the pop-in when motion is allowed (negative control)', () => {
    // Without this, the assertion above passes just as well against a
    // component that never animates at all.
    reduced.value = false;
    render(<AnimatedList data-testid="feed">{feed}</AnimatedList>);

    const items = [
      ...document.querySelectorAll('[data-slot="animated-list-item"]'),
    ];
    expect(items.length).toBeGreaterThan(0);
    expect(
      styleOf(items[0]),
      'No entry animation at all under no-preference — the gate is stuck on.',
    ).toContain('scale(0)');
  });

  it('gates the exported item on its own, not via the list', () => {
    // `AnimatedListItem` is exported for consumers driving the window
    // themselves. A gate that lived only in `AnimatedList` would leave them
    // with the un-gated pop-in.
    reduced.value = true;
    render(<AnimatedListItem>solo</AnimatedListItem>);
    const item = document.querySelector('[data-slot="animated-list-item"]')!;
    expect(styleOf(item)).not.toContain('scale(0)');
  });
});

describe('Marquee — no control that cannot do what it says', () => {
  it('withdraws the pause button under reduce', () => {
    // THE DEFECT: `isAnimating = !paused && !reducedMotion`, so under `reduce`
    // the button rendered in its "Play" state with `aria-pressed=true` — and
    // clicking it flipped `paused` to false, which changed `isAnimating` not at
    // all, because reduced motion outranks it. A control announcing "Resume
    // scrolling content" that can never resume anything.
    reduced.value = true;
    render(<Marquee>logos</Marquee>);
    expect(
      document.querySelector('button'),
      'The pause control is still rendered under `reduce`, where it cannot ' +
        'affect the animation state in either direction.',
    ).toBeNull();
  });

  it('still ships the control when motion is allowed (WCAG 2.2.2)', () => {
    // The other half: withdrawing it under `reduce` must not become
    // withdrawing it always. A 40s infinite scroll needs a pause affordance.
    reduced.value = false;
    render(<Marquee>logos</Marquee>);
    const button = document.querySelector('button')!;
    expect(button).not.toBeNull();
    expect(button.getAttribute('aria-label')).toBe('Pause scrolling content');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('ArticleCard — the hover zoom carries its own gate', () => {
  it('gates the cover scale with motion-safe:, not with preflight alone', () => {
    // THE DEFECT: the cover was `transition-transform group-hover:scale-105`
    // with no gate of any kind, so the ONLY thing stopping a 5% zoom under
    // `reduce` was the `transition-duration: 0.01ms` wildcard in preflight.css.
    // Every stylesheet in this package is its own `exports` entry —
    // `motion-contract-lock` treats the tokens.css-without-preflight path as
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
        'clamped, and only when preflight.css is loaded.',
    ).not.toContain('group-hover:scale-105');
  });
});

// ════════════════════════════════════════════════════════════════════════
// B. Props that lie
// ════════════════════════════════════════════════════════════════════════

describe('Particles — `interactive` listens somewhere it can actually be heard', () => {
  /**
   * Record every `addEventListener` call with the element it was made on.
   *
   * Spying on ONE element instead would not work, and the way it fails is
   * instructive: React 19 attaches its delegated handlers — `pointermove`
   * among ~136 others — to the root container it renders into. A spy on that
   * container therefore reports `pointermove` whatever the component does, and
   * the test passes against the broken code. Hence a prototype-level spy that
   * records the target, plus assertions naming the exact elements, plus a
   * render tree deep enough that the interesting parent is NOT React's root.
   */
  function recordListeners() {
    const calls: Array<{ target: Element; type: string }> = [];
    const original = Element.prototype.addEventListener;
    vi.spyOn(Element.prototype, 'addEventListener').mockImplementation(
      function (
        this: Element,
        type: string,
        ...rest: [EventListenerOrEventListenerObject, (boolean | AddEventListenerOptions)?]
      ) {
        calls.push({ target: this, type });
        return original.call(this, type, ...rest);
      } as typeof Element.prototype.addEventListener,
    );
    return calls;
  }

  const targetsFor = (
    calls: Array<{ target: Element; type: string }>,
    type: string,
  ) => calls.filter((call) => call.type === type).map((call) => call.target);

  it('binds pointermove to the parent, never to the pointer-events-none wrapper', () => {
    // THE DEFECT: the listener was bound to the wrapper, and the wrapper is
    // `pointer-events-none` by contract (a decorative field must not eat
    // clicks). An element with `pointer-events: none` is not a hit target, so
    // the handler could never fire — which made `interactive`, `staticity` and
    // `ease` three props the component accepted and ignored.
    stubCanvas();
    const calls = recordListeners();

    render(
      <div data-testid="host">
        <Particles data-testid="field" interactive />
      </div>,
    );

    const wrapper = document.querySelector('[data-slot="particles"]')!;
    const host = wrapper.parentElement!;

    expect(
      wrapper.className,
      'The wrapper stopped being pointer-events-none. That would make the ' +
        'original binding work again — and make the field swallow clicks, ' +
        'which is the reason it is decorative-only in the first place.',
    ).toContain('pointer-events-none');

    const listeners = targetsFor(calls, 'pointermove');
    expect(
      listeners,
      'The pointermove listener is still on the field wrapper, which is not a ' +
        'hit target. It can never fire.',
    ).not.toContain(wrapper);
    expect(
      listeners,
      'Nothing bound pointermove to the surface the field covers.',
    ).toContain(host);
  });

  it('binds nothing when interactive is off', () => {
    // Pins that the assertion above measures the `interactive` path, and not
    // some listener the component adds unconditionally.
    stubCanvas();
    const calls = recordListeners();

    render(
      <div data-testid="host">
        <Particles data-testid="field" interactive={false} />
      </div>,
    );

    const wrapper = document.querySelector('[data-slot="particles"]')!;
    const listeners = targetsFor(calls, 'pointermove');
    expect(listeners).not.toContain(wrapper);
    expect(listeners).not.toContain(wrapper.parentElement!);
  });
});

describe('Meteors — `trailColor` reaches the gradient', () => {
  it('uses the prop as the tail stop', () => {
    // THE DEFECT: destructured to `_trailColor` and dropped on the floor. The
    // tail was hard-coded `transparent`, so the prop was documented, typed,
    // accepted — and inert.
    render(<Meteors trailColor="rgb(1, 2, 3)" number={2} />);
    const streaks = [...document.querySelectorAll('span')];
    expect(streaks.length).toBeGreaterThan(0);
    for (const streak of streaks) {
      expect(
        styleOf(streak),
        'The meteor tail does not mention the colour it was given.',
      ).toContain('rgb(1, 2, 3)');
    }
  });

  it('still defaults to a transparent falloff', () => {
    // The fix must be invisible at the default — `trailColor` defaults to
    // `transparent`, which is exactly what the literal used to be. A visual
    // change here would mean the prop was wired to the wrong stop.
    render(<Meteors number={1} />);
    const streak = document.querySelector('span')!;
    expect(styleOf(streak)).toContain('transparent 100%');
  });
});

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

describe('BackgroundGradientAnimation — the goo filter id is per-instance', () => {
  it('gives two instances on one page two different filters', () => {
    // THE DEFECT: `id="bga-goo"`, a literal. SVG ids are document-global, so
    // two instances emitted duplicate ids; `url(#bga-goo)` resolves to the
    // first, meaning both surfaces shared one filter and unmounting the first
    // took the second's goo with it.
    render(
      <>
        <BackgroundGradientAnimation>one</BackgroundGradientAnimation>
        <BackgroundGradientAnimation>two</BackgroundGradientAnimation>
      </>,
    );

    const ids = [...document.querySelectorAll('filter')].map((f) => f.id);
    expect(ids).toHaveLength(2);
    expect(
      new Set(ids).size,
      `Both instances emitted the same filter id (${ids[0]}). Duplicate ids ` +
        `are legal HTML and silently wrong SVG.`,
    ).toBe(2);

    // …and each blob layer must point at its OWN filter, not merely at a
    // unique-looking string. A per-instance id that nothing references is the
    // same bug with an extra step.
    const layers = [...document.querySelectorAll('[data-slot="gradient-blobs"]')];
    expect(layers).toHaveLength(2);
    layers.forEach((layer, index) => {
      expect(styleOf(layer)).toContain(`url(#${ids[index]})`);
    });
  });

  it('keeps the reference out of the class system', () => {
    // Tailwind scans source as raw TEXT. A `[filter:url(#${id})]` utility is a
    // candidate it can never see, so the class would be emitted by React and
    // never generated by Tailwind — a fix that type-checks, renders, and
    // produces no filter at all. It has to be an inline style.
    render(<BackgroundGradientAnimation>x</BackgroundGradientAnimation>);
    const layer = document.querySelector('[data-slot="gradient-blobs"]')!;
    expect(styleOf(layer)).toContain('filter:');
    expect(layer.className).not.toContain('filter:url');
  });
});

describe('ShootingStars — the spawn chain has an owner', () => {
  beforeEach(() => {
    // Only the timer functions: `requestAnimationFrame` is left real so the
    // star-movement loop does not land in `getTimerCount()` and make the
    // count below meaningless.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not leave a second chain running when a timing prop changes', () => {
    // THE DEFECT: `setTimeout(createStar, …)` re-armed itself forever and the
    // effect returned no cleanup. It self-terminated after UNMOUNT (because
    // `svgRef.current` goes null), which is what made it look harmless — but
    // re-tuning any of minSpeed/maxSpeed/minDelay/maxDelay while mounted, or
    // scrolling back into view, re-ran the effect and started a second chain
    // on top of the first. Two chains, one `setStar`, twice the stars.
    const { rerender } = render(<ShootingStars minDelay={1000} maxDelay={2000} />);
    expect(vi.getTimerCount()).toBe(1);

    rerender(<ShootingStars minDelay={3000} maxDelay={4000} />);
    expect(
      vi.getTimerCount(),
      'A second spawn chain is pending alongside the first. Each one keeps ' +
        're-arming, so the leak compounds with every prop change.',
    ).toBe(1);
  });

  it('cancels the chain on unmount', () => {
    const { unmount } = render(<ShootingStars />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('ShootingStars — the trail gradient id is per-instance', () => {
  it('does not reach for `#gradient`', () => {
    // Found alongside the goo-filter defect and identical in kind, but worse
    // in degree: `id="gradient"` is about the most collision-prone id an SVG
    // can declare.
    render(
      <>
        <ShootingStars />
        <ShootingStars />
      </>,
    );
    const ids = [...document.querySelectorAll('linearGradient')].map((g) => g.id);
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain('gradient');
    expect(new Set(ids).size).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════════
// D. Accessibility
// ════════════════════════════════════════════════════════════════════════

describe('BackgroundLines — the decorative layer is hidden from AT', () => {
  it('marks the SVG aria-hidden', () => {
    // THE DEFECT: twelve unlabelled `<path>`s, `pointer-events-none` but with
    // no `aria-hidden` — the only backdrop in `aceternity/` missing it.
    reduced.value = false;
    render(<BackgroundLines>content</BackgroundLines>);
    const svg = document.querySelector('svg');
    expect(svg, 'The decorative layer did not render; nothing was asserted.')
      .not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });
});

// ════════════════════════════════════════════════════════════════════════
// E. Tokens
// ════════════════════════════════════════════════════════════════════════
//
// R19 is "tokens only", but for these four components the interesting question
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

const THEME_CSS = resolve(__dirname, '../styles/interlace-theme.css');

/**
 * Drop block and whole-line `//` comments, so a class NAMED in prose is never
 * read as a class APPLIED to an element. These headers document the defects
 * they used to have; without this, every fix would fail its own lock.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function readTheme(): Record<'light' | 'dark', Map<string, RGB>> {
  const css = readFileSync(THEME_CSS, 'utf8');
  const darkAt = css.indexOf(".dark,\n  [data-scheme='dark']");
  expect(
    darkAt,
    'interlace-theme.css no longer contains the expected dark-mode selector.',
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
    /^\s{2,6}(\w+) = "([^"]+)",?$/gm,
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

  it('AnimatedGradientText: both stops are text-grade in both schemes', () => {
    // THE DEFECT: `#ffaa40` / `#9c40ff`, raw literals — and the span is
    // `bg-clip-text text-transparent`, so those literals were not decoration
    // sitting behind the words, they WERE the words. `#ffaa40` measures ~2:1
    // on white: an AA failure on text, on the DS's default surface, shipped as
    // a default.
    const defaults = defaultsOf('magicui/animated-gradient-text.tsx');
    expect(defaults.colorFrom).toBe('var(--primary)');
    expect(defaults.colorTo).toBe('var(--primary-active)');

    for (const mode of ['light', 'dark'] as const) {
      const surface = theme[mode].get('background')!;
      for (const token of ['primary', 'primary-active']) {
        const ratio = contrast(theme[mode].get(token)!, surface);
        expect(
          ratio,
          `${mode}: --interlace-${token} measures ${ratio.toFixed(2)}:1 on the ` +
            `page background. It is a gradient stop on bg-clip-text, so it is ` +
            `glyph fill and SC 1.4.3 binds at ${AA_NORMAL}:1.`,
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

  it('ShimmerButton: the scrim pair, which does not invert and clears AA', () => {
    // THE DEFECT: `text-white`, `border-white/10`, `rgba(0, 0, 0, 1)`,
    // `#ffffff` — four literals for colours the token system already names.
    // `--scrim` / `--scrim-foreground` are the tokens for "dark by intent, not
    // by mode": identical in both schemes, which is why moving to them changes
    // nothing visually and everything about forkability.
    const defaults = defaultsOf('magicui/shimmer-button.tsx');
    expect(defaults.background).toBe('var(--scrim)');
    expect(defaults.shimmerColor).toBe('var(--scrim-foreground)');

    for (const mode of ['light', 'dark'] as const) {
      const ratio = contrast(
        theme[mode].get('scrim-foreground')!,
        theme[mode].get('scrim')!,
      );
      expect(
        ratio,
        `${mode}: the button's own text pair measures ${ratio.toFixed(2)}:1.`,
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    }

    // The pair not inverting is the property the choice rests on. If a fork
    // makes the scrim theme-dependent, this button silently becomes a
    // light-on-light CTA in one mode.
    expect(theme.light.get('scrim')).toEqual(theme.dark.get('scrim'));
    expect(theme.light.get('scrim-foreground')).toEqual(
      theme.dark.get('scrim-foreground'),
    );
  });

  it('BorderBeam: on tokens, and allowed a 3:1-grade one because it is not text', () => {
    // THE DEFECT: the same `#ffaa40` / `#9c40ff` pair as the gradient text —
    // but the admissibility question has a different answer here. The beam is
    // a decorative overlay inside a container that draws its own border: not
    // text (1.4.3), not the boundary identifying a control (1.4.11). So a
    // `--chart-*` token, tuned to the 3:1 graphical floor, is fine — where in
    // AnimatedGradientText it would not be.
    const defaults = defaultsOf('magicui/border-beam.tsx');
    expect(defaults.colorFrom).toBe('var(--primary)');
    expect(defaults.colorTo).toBe('var(--chart-2)');
  });

  it('NumberTicker: text-foreground, not a hand-rolled black/white', () => {
    // THE DEFECT: `text-black dark:text-white` — an approximation of
    // `text-foreground` that is wrong under both shipped themes
    // (`--interlace-foreground` is #0d0b09 / #f0ede9, neither pure).
    //
    // Comments are stripped first. The file header NAMES the old classes while
    // explaining what replaced them, and a scanner that cannot tell a class
    // from a sentence about a class would fail on the documentation of the fix.
    const code = stripComments(
      readFileSync(resolve(__dirname, '../src/magicui/number-ticker.tsx'), 'utf8'),
    );
    expect(code).toContain('text-foreground');
    expect(code).not.toContain('text-black');
    expect(code).not.toContain('dark:text-white');
  });
});

// ════════════════════════════════════════════════════════════════════════
// The one defect with no runtime and no type-level symptom
// ════════════════════════════════════════════════════════════════════════

describe('AnimatedGradientText — props describe the element it renders', () => {
  it('declares span props for a span root', () => {
    // `ComponentPropsWithoutRef<"div">` on a component that renders a `<span>`.
    //
    // This is asserted STRUCTURALLY, and the reason is worth stating rather
    // than hiding: the defect has no runtime symptom (the type is erased) AND
    // no type-level one. React's event handlers are declared through the
    // `bivarianceHack` indirection, which makes `MouseEventHandler<HTMLDivElement>`
    // and `MouseEventHandler<HTMLSpanElement>` mutually assignable — so the two
    // prop types are structurally interchangeable and no `tsc` assertion, and
    // no `expectTypeOf`, can tell them apart. Reading the source is the only
    // check that discriminates, so that is the check.
    const source = readFileSync(
      resolve(__dirname, '../src/magicui/animated-gradient-text.tsx'),
      'utf8',
    );

    const propsExtends = /extends ComponentPropsWithoutRef<"(\w+)">/.exec(source);
    expect(propsExtends, 'props interface no longer extends a native element')
      .not.toBeNull();

    const rootTag = /return \(\s*<(\w+)/.exec(source);
    expect(rootTag, 'could not find the rendered root element').not.toBeNull();

    expect(
      propsExtends![1],
      `Props extend <${propsExtends![1]}> while the component renders a ` +
        `<${rootTag![1]}>. Div-only attributes type-check and then do nothing.`,
    ).toBe(rootTag![1]);
  });
});
