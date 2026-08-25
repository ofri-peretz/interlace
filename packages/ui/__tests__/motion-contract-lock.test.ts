/**
 * Motion contract lock.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * MOTION_PHILOSOPHY.md and LOADING_PHILOSOPHY.md make three numeric promises
 * about motion. All three were false in the shipped CSS at some point, and
 * none of the three could go red — because a duration is a literal inside a
 * shorthand and a reduced-motion rule is a selector list, and neither is
 * something a component test can observe. jsdom reports no computed
 * animation, Storybook's preview.css clamps everything to 0.001ms before a
 * reviewer ever looks, and a stylesheet that quietly stops matching a class
 * throws nothing. Every one of these failures is invisible at the surface
 * where the DS is normally inspected.
 *
 * So the numbers are recomputed here, from the stylesheets, against the
 * DOC — `MOTION_PHILOSOPHY.md` supplies the 200ms ceiling this file
 * enforces, rather than the ceiling being re-typed here where it could
 * drift from the sentence that justifies it.
 *
 * THE THREE THINGS IT HOLDS
 * -------------------------
 *   1. The preflight wildcard still exists. It is the PRIMARY
 *      reduced-motion guarantee and the only one that reaches the
 *      animations no selector can name (`data-[open]:animate-in` compiles
 *      to `.data-\[open\]\:animate-in`). Delete it and Dialog, Sheet,
 *      Popover, Tooltip, DropdownMenu, ContextMenu, Skeleton and every
 *      `transition-*` in the DS start animating under `reduce`, with no
 *      symptom anywhere.
 *   2. Every bare `animate-*` utility the DS puts on an element is in the
 *      tokens.css allowlist — the second layer, which is the ONLY layer on
 *      the à-la-carte import path (every stylesheet is its own `exports`
 *      entry, so a consumer can take tokens.css + theme.css and skip
 *      preflight.css). `.animate-pulse` was missing from it for the whole
 *      of Skeleton's life.
 *   3. No finite animation exceeds the documented entry budget, and none
 *      carries an entry delay. `.animate-slide-in-left` shipped at
 *      0.5s + 0.3s = 800ms before the reader saw anything.
 *
 * WHAT IT DOES NOT COVER
 * ----------------------
 * JS-driven motion (`motion/react`, canvas, rAF). That is gated
 * per-component through `useReducedMotion`, and `use-reduced-motion.test.tsx`
 * owns it. This file only knows about CSS.
 *
 * It also cannot see a duration written at a CALL SITE as a Tailwind
 * `duration-*` utility — those live in component source, not here.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative } from 'path';

const STYLES = resolve(__dirname, '../styles');
const TOKENS_CSS = resolve(STYLES, 'tokens.css');
const THEME_CSS = resolve(STYLES, 'theme.css');
const PREFLIGHT_CSS = resolve(STYLES, 'preflight.css');
const SRC = resolve(__dirname, '../src');
const MOTION_DOC = resolve(__dirname, '../../../docs/philosophies/MOTION_PHILOSOPHY.md');

const REDUCE_QUERY = '@media (prefers-reduced-motion: reduce)';

/**
 * Bare `animate-*` utilities the allowlist cannot usefully carry, each with
 * the reason. An entry here is a claim that the class is neutralised by some
 * OTHER mechanism — keep the justification concrete, because the alternative
 * to a short exemption list is a long one nobody reads.
 */
const EXEMPT_UTILITIES: Record<string, string> = {
  'animate-in':
    'tw-animate-css enter utility. It is a dependency of the CONSUMER apps ' +
    '(apps/storybook, apps/registry), not of @interlace/ui — the DS ships no ' +
    'rule for it, so listing it here would neutralise a class this stylesheet ' +
    'does not own. Its paired exit (`data-[closed]:animate-out`) is also ' +
    'unreachable by a plain `.animate-out` selector, since Tailwind compiles ' +
    'the variant into the class name itself. Both are covered by the ' +
    'preflight wildcard, which assertion (1) below holds in place.',
};

// ── CSS parsing ─────────────────────────────────────────────────────────

/** Drop `/* … *\/` so a class NAMED in prose is never read as a rule. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Strip JS/TS comments so a class name in a JSDoc EXAMPLE is not scanned as
 * a real call site. `use-reduced-motion.ts` documents itself with
 * `className={reduce ? 'static' : 'animate-bounce'}`, and `skeleton.tsx`
 * lists `animate-pulse` in its rule table — neither is an element.
 *
 * Line comments are stripped only when they own the whole line, so a `//`
 * inside a URL in real code survives.
 */
function stripJsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * The body of the `@media (prefers-reduced-motion: reduce)` block in `file`,
 * by brace matching.
 *
 * Deliberately not a CSS parser: a hand-rolled matcher fails by throwing or
 * returning nothing, which fails the test. A lenient parser fails by
 * returning something plausible, which passes it.
 */
function readReduceBlock(file: string): string {
  const css = stripCssComments(readFileSync(file, 'utf8'));
  const at = css.indexOf(REDUCE_QUERY);
  expect(
    at,
    `${relative(STYLES, file)} no longer contains a \`${REDUCE_QUERY}\` block. ` +
      `Reduced motion is a hard contract in MOTION_PHILOSOPHY.md; if the block ` +
      `moved, move this lock with it rather than letting every assertion below ` +
      `pass vacuously.`,
  ).toBeGreaterThan(-1);

  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`Unbalanced braces after \`${REDUCE_QUERY}\` in ${file}`);
}

/** The class names selected by the tokens.css reduced-motion allowlist. */
function readAllowlist(): Set<string> {
  const block = readReduceBlock(TOKENS_CSS);
  // Selector positions only — strip declaration bodies first so property
  // text can never read as a class. The block holds MULTIPLE rules now:
  // `animation: none` for pure decoration, and the draw-gesture rule
  // (animation-duration clamp) that completes instead of vanishing.
  const selectors = block.replace(/\{[^{}]*\}/g, ',');
  return new Set(
    [...selectors.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((match) => match[1]),
  );
}

/** Every bare `animate-*` utility `packages/ui/src` puts on an element. */
function readEmittedUtilities(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of walkSync(SRC)) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = stripJsComments(readFileSync(file, 'utf8'));
    // Reject a preceding `-` (`--animate-x`), `:` (`data-[open]:animate-in`,
    // `motion-safe:animate-pulse` — already correctly gated) or word char.
    for (const match of source.matchAll(/(?<![-:\w])animate-[a-z][a-z0-9-]*/g)) {
      const list = out.get(match[0]) ?? [];
      list.push(relative(SRC, file));
      out.set(match[0], list);
    }
  }
  return out;
}

function walkSync(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkSync(full, out);
    else out.push(full);
  }
  return out;
}

interface Animation {
  /** `--animate-marquee` or `.animate-fade-in-up`. */
  readonly name: string;
  readonly where: string;
  readonly value: string;
  /** Ambient loops are exempt from the entry budget — they are never entry. */
  readonly infinite: boolean;
  /** Literal `<time>` values in the shorthand: [duration, delay]. */
  readonly times: readonly number[];
}

/** `1.5s` / `200ms` → milliseconds. */
function toMs(value: string, unit: string): number {
  return unit === 'ms' ? Number(value) : Number(value) * 1000;
}

/**
 * Every animation shorthand the DS declares: `--animate-*` theme tokens
 * (tokens.css, which Tailwind emits as `.animate-*` utilities) plus the
 * hand-written `.animate-*` rules (tokens.css + theme.css).
 */
function readAnimations(): Animation[] {
  const out: Animation[] = [];
  for (const file of [TOKENS_CSS, THEME_CSS]) {
    const css = stripCssComments(readFileSync(file, 'utf8'));
    const where = relative(STYLES, file);

    const declarations = [
      ...css.matchAll(/(--animate-[a-z0-9-]+)\s*:\s*([^;]+);/g),
      ...css.matchAll(/(\.animate-[a-z0-9-]+)\s*\{[^}]*?\banimation\s*:\s*([^;]+);/g),
    ];

    for (const [, name, raw] of declarations) {
      const value = raw.replace(/\s+/g, ' ').trim();
      out.push({
        name,
        where,
        value,
        infinite: /\binfinite\b/.test(value),
        times: [...value.matchAll(/(?<![\w.])(\d*\.?\d+)(ms|s)\b/g)].map((m) =>
          toMs(m[1], m[2]),
        ),
      });
    }
  }
  return out;
}

/** The entry ceiling, read out of the doc that justifies it. */
function readEntryBudgetMs(): number {
  const doc = readFileSync(MOTION_DOC, 'utf8');
  const match = /Max (\d+)ms on entry/.exec(doc);
  expect(
    match,
    `MOTION_PHILOSOPHY.md no longer states the entry ceiling as "Max <n>ms on ` +
      `entry". That sentence is this lock's source of truth for the number — ` +
      `re-typing the ceiling here instead would let the code and the paragraph ` +
      `justifying it drift apart, which is the exact failure this file exists ` +
      `to prevent. Restore the phrasing, or update this parser in the same change.`,
  ).not.toBeNull();
  return Number(match![1]);
}

/** The draw-gesture ceiling — same doc, same drift contract. */
function readDrawBudgetMs(): number {
  const doc = readFileSync(MOTION_DOC, 'utf8');
  const match = /Max (\d+)ms on a draw gesture/.exec(doc);
  expect(
    match,
    `MOTION_PHILOSOPHY.md no longer states the draw-gesture ceiling as ` +
      `"Max <n>ms on a draw gesture". Restore the phrasing, or update this ` +
      `parser in the same change.`,
  ).not.toBeNull();
  return Number(match![1]);
}

/**
 * Keyframe names qualifying for the draw-gesture exception — exactly as
 * wide as the doc says: the body animates `stroke-dashoffset` and NOTHING
 * else. A keyframe that also touches opacity or transform is an entry
 * animation, whatever it is named.
 */
function readDrawKeyframes(): Set<string> {
  const css = stripCssComments(readFileSync(TOKENS_CSS, 'utf8'));
  const out = new Set<string>();
  // Segment by @keyframes header; each segment runs to the next header (or
  // EOF), which over-captures trailing CSS after the LAST keyframe — safe
  // here because over-captured declarations can only DISQUALIFY, and the
  // parser pins below fail loudly if the file's structure stops matching.
  const segments = css.split(/@keyframes\s+/).slice(1);
  for (const segment of segments) {
    const name = /^([a-z0-9-]+)/.exec(segment)?.[1];
    if (!name) continue;
    const properties = [...segment.matchAll(/([a-z-]+)\s*:\s*[^;{}]+;/g)].map(
      (m) => m[1],
    );
    if (properties.length > 0 && properties.every((p) => p === 'stroke-dashoffset'))
      out.add(name);
  }
  return out;
}

/** First ident of an animation shorthand = its keyframe name. */
function keyframeNameOf(value: string): string {
  return /^\s*([a-z][a-z0-9-]*)/.exec(value)?.[1] ?? '';
}

const ALLOWLIST = readAllowlist();
const EMITTED = readEmittedUtilities();
const ANIMATIONS = readAnimations();
const ENTRY_BUDGET_MS = readEntryBudgetMs();
const DRAW_BUDGET_MS = readDrawBudgetMs();
const DRAW_KEYFRAMES = readDrawKeyframes();

// ── the lock ────────────────────────────────────────────────────────────

describe('motion contract lock', () => {
  // ── the parser's own tests ───────────────────────────────────────────
  // Everything below rests on reading numbers out of CSS correctly. A parser
  // that quietly stopped matching would make every assertion pass vacuously,
  // so pin its behaviour — including its ability to FAIL — first.

  it('parses duration and delay out of an animation shorthand', () => {
    const parse = (value: string) =>
      [...value.matchAll(/(?<![\w.])(\d*\.?\d+)(ms|s)\b/g)].map((m) => toMs(m[1], m[2]));
    expect(parse('fade-in-up 0.2s ease-out both')).toEqual([200]);
    expect(parse('slide-in-left 0.5s ease-out 0.3s both')).toEqual([500, 300]);
    expect(parse('accordion-down 0.2s ease-out')).toEqual([200]);
    expect(parse('marquee var(--duration) infinite linear')).toEqual([]);
  });

  it('would flag the durations that actually shipped (negative control)', () => {
    // The three classes this lock was written for, at the values they carried
    // before it existed. A green suite that cannot go red is decoration.
    const historical = [
      { name: '.animate-fade-in-up', value: 'fade-in-up 0.5s ease-out both' },
      { name: '.animate-slide-in-left', value: 'slide-in-left 0.5s ease-out 0.3s both' },
      { name: '.animate-scale-in', value: 'scale-in 0.4s ease-out 0.2s both' },
    ];
    const overBudget = historical.filter(({ value }) => {
      const times = [...value.matchAll(/(?<![\w.])(\d*\.?\d+)(ms|s)\b/g)].map((m) =>
        toMs(m[1], m[2]),
      );
      return times[0] > ENTRY_BUDGET_MS || (times[1] ?? 0) > 0;
    });
    expect(overBudget.map((a) => a.name)).toEqual([
      '.animate-fade-in-up',
      '.animate-slide-in-left',
      '.animate-scale-in',
    ]);
  });

  it('reads a non-empty allowlist, animation set and source scan', () => {
    // Each of the three assertions below is a set comparison. An empty set on
    // either side passes every one of them.
    expect(ALLOWLIST.size).toBeGreaterThan(10);
    expect(ANIMATIONS.length).toBeGreaterThan(10);
    expect(EMITTED.size).toBeGreaterThan(5);
    expect(ENTRY_BUDGET_MS).toBeGreaterThan(0);
  });

  it('classifies draw gestures from keyframe evidence, not from a name', () => {
    // The exception is exactly as wide as the doc: stroke-dashoffset-only.
    // strand-draw qualifies; every content-moving keyframe must not —
    // renaming `fade-in-up` to `hero-draw` buys it nothing.
    expect(DRAW_KEYFRAMES.has('strand-draw')).toBe(true);
    expect(DRAW_KEYFRAMES.has('shimmer-slide')).toBe(false);
    expect(DRAW_KEYFRAMES.has('fade-in-up')).toBe(false);
    expect(DRAW_BUDGET_MS).toBeGreaterThan(ENTRY_BUDGET_MS);
    // The multi-rule allowlist parser sees selectors in EVERY rule of the
    // reduce block — the draw rule's class must be reachable.
    expect(ALLOWLIST.has('animate-strand-draw')).toBe(true);
  });

  it('would flag an over-budget draw and a draw-named content entry (negative control)', () => {
    // A 700ms draw exceeds even the draw ceiling…
    expect(700 > DRAW_BUDGET_MS).toBe(true);
    // …and a 600ms animation whose keyframe moves content is judged by the
    // ENTRY ceiling regardless of what it is called.
    expect(DRAW_KEYFRAMES.has('scale-in')).toBe(false);
    expect(600 > ENTRY_BUDGET_MS).toBe(true);
  });

  // ── 1. the primary guarantee: preflight's wildcard ───────────────────

  describe('preflight wildcard', () => {
    const block = readReduceBlock(PREFLIGHT_CSS);

    it('still clamps every element, pseudo-element included', () => {
      expect(
        block.replace(/\s+/g, ' '),
        'The universal selector disappeared from the preflight reduced-motion ' +
          'block. It is not redundant with the tokens.css allowlist: a class ' +
          'list can only name classes, and the DS\'s most common animations ' +
          'are not nameable — Tailwind compiles `data-[open]:animate-in` into ' +
          '`.data-\\[open\\]\\:animate-in`, so every Dialog, Sheet, Popover, ' +
          'Tooltip, DropdownMenu and ContextMenu enter/exit is reachable ONLY ' +
          'from here, as is every `transition-*` utility in the package.',
      ).toContain('*, *::before, *::after {');
    });

    it('clamps duration, iteration count and transitions, all !important', () => {
      // Each one is load-bearing and each fails silently on its own:
      //   - no animation-duration  → the animation runs at its authored speed
      //   - no iteration-count     → an `infinite` loop stays infinite
      //   - no transition-duration → every hover/focus/state transition plays
      //   - no !important          → loses to the utility that set it, since
      //                              the interlace layers sort AFTER Tailwind's
      //                              for normal declarations but the utility is
      //                              a shorthand that would otherwise win.
      for (const property of [
        'animation-duration',
        'animation-iteration-count',
        'transition-duration',
      ]) {
        const declaration = new RegExp(`${property}\\s*:\\s*[^;]+!important`);
        expect(
          declaration.test(block),
          `preflight's reduced-motion block no longer sets \`${property}\` with ` +
            `!important. Without it the declaration loses to the animation ` +
            `shorthand on the utility class, and reduced motion silently stops ` +
            `applying to everything this block is the only cover for.`,
        ).toBe(true);
      }
    });
  });

  // ── 2. the second layer: the tokens.css allowlist ────────────────────

  describe('reduced-motion allowlist', () => {
    it('names every bare animate-* utility the DS emits', () => {
      const missing = [...EMITTED.entries()]
        .filter(([utility]) => !ALLOWLIST.has(utility) && !(utility in EXEMPT_UTILITIES))
        .map(([utility, files]) => `  .${utility} — ${[...new Set(files)].join(', ')}`);

      expect(
        missing,
        `packages/ui/src puts ${missing.length} animate-* utilit(ies) on an ` +
          `element that the tokens.css reduced-motion allowlist does not name.\n\n` +
          `This is survivable only while preflight.css is loaded. Every ` +
          `stylesheet in this package is a separate \`exports\` entry, so a ` +
          `consumer can import tokens.css + theme.css and skip preflight — ` +
          `index.css exists precisely because that used to happen. On that ` +
          `path the allowlist is the whole contract, and an unlisted class ` +
          `animates for a user who asked for no animation.\n\n` +
          `Add the class to the allowlist in styles/tokens.css, or gate the ` +
          `call site with \`motion-safe:\`.\n\n${missing.join('\n')}`,
      ).toEqual([]);
    });

    it('lists nothing it cannot reach', () => {
      // A dead entry is worse than a missing one: it reads as coverage. An
      // entry earns its place by being either a class this package declares
      // or a class this package puts on an element.
      const declared = new Set(
        ANIMATIONS.map((animation) => animation.name.replace(/^(--|\.)/, '')),
      );
      const dead = [...ALLOWLIST].filter(
        (utility) => !declared.has(utility) && !EMITTED.has(utility),
      );
      expect(
        dead,
        `The reduced-motion allowlist names ${dead.length} class(es) that this ` +
          `package neither declares nor renders. A renamed keyframe leaves the ` +
          `old selector behind, still matching nothing, still looking like ` +
          `coverage.\n\n  .${dead.join('\n  .')}`,
      ).toEqual([]);
    });

    it('covers the skeleton pulse specifically', () => {
      // Named on its own because it is the one the DS renders most and the
      // one that went unlisted longest — every loading state in every
      // consumer app, on a 2s infinite opacity loop, on the à-la-carte path.
      // LOADING_PHILOSOPHY §2: "Under prefers-reduced-motion: reduce: no
      // pulse. Static dimmed placeholder."
      expect(ALLOWLIST.has('animate-pulse')).toBe(true);
      expect([...EMITTED.get('animate-pulse') ?? []].some((f) => f.includes('skeleton'))).toBe(
        true,
      );
    });
  });

  // ── 3. the duration budget ───────────────────────────────────────────

  describe(`entry budget (${ENTRY_BUDGET_MS}ms, per MOTION_PHILOSOPHY.md)`, () => {
    /**
     * Finite animations in this package are entry animations: they run once,
     * with `both` fill from `opacity: 0`, and nothing the reader came for is
     * legible until they finish. Ambient loops (`infinite`) are the carve-out
     * the doc names — they are background motion, never entry.
     */
    const finite = ANIMATIONS.filter((animation) => !animation.infinite);

    it('has finite and ambient animations to tell apart', () => {
      expect(finite.length).toBeGreaterThan(0);
      expect(ANIMATIONS.length - finite.length).toBeGreaterThan(0);
    });

    it('keeps every entry animation inside the ceiling', () => {
      // Draw gestures (stroke-dashoffset-only keyframes, per the doc's
      // exception) get the draw ceiling; everything else — anything that
      // moves content — keeps the entry ceiling.
      const budgetFor = (a: Animation): number =>
        DRAW_KEYFRAMES.has(keyframeNameOf(a.value))
          ? DRAW_BUDGET_MS
          : ENTRY_BUDGET_MS;
      const over = finite
        .filter((animation) => (animation.times[0] ?? 0) > budgetFor(animation))
        .map(
          (a) =>
            `  ${a.name} (${a.where}) — ${a.times[0]}ms > ${budgetFor(a)}ms: ${a.value}`,
        );
      expect(
        over,
        `${over.length} animation(s) exceed their MOTION_PHILOSOPHY.md ` +
          `ceiling (${ENTRY_BUDGET_MS}ms entry; ${DRAW_BUDGET_MS}ms for ` +
          `non-occluding draw gestures). First paint belongs to content, not ` +
          `theatre.\n\n${over.join('\n')}`,
      ).toEqual([]);
    });

    it('gives no entry animation a delay', () => {
      // The worse half of the original breach. `.animate-slide-in-left` was
      // 0.5s of motion behind 0.3s of nothing — 800ms to first legible pixel,
      // 4× the ceiling, of which the delay contributed no information at all.
      const delayed = finite
        .filter((animation) => (animation.times[1] ?? 0) > 0)
        .map((a) => `  ${a.name} (${a.where}) — ${a.times[1]}ms delay: ${a.value}`);
      expect(
        delayed,
        `${delayed.length} entry animation(s) carry a delay. A delay on an ` +
          `entry animation is dead time: the element is already laid out at ` +
          `opacity 0, so the reader waits and sees nothing appear.\n\n` +
          `${delayed.join('\n')}`,
      ).toEqual([]);
    });

    it('keeps every ambient loop killable under reduced motion', () => {
      // An `infinite` animation is exempt from the ceiling only because it is
      // never entry. That exemption is conditional on it stopping when asked.
      const unkillable = ANIMATIONS.filter((animation) => animation.infinite)
        .map((animation) => animation.name.replace(/^(--|\.)/, ''))
        .filter((utility) => !ALLOWLIST.has(utility));
      expect(
        unkillable,
        `${unkillable.length} infinite animation(s) are not in the ` +
          `reduced-motion allowlist. An ambient loop is the one kind of motion ` +
          `that never stops on its own.\n\n  .${unkillable.join('\n  .')}`,
      ).toEqual([]);
    });
  });

  // ── 4. the token tables MOTION_PHILOSOPHY.md documents ───────────────

  describe('duration & easing bands', () => {
    it('documents bands, not a token scale that does not exist', () => {
      // The doc used to print `--duration-*` / `--ease-*` tables as though
      // they were tokens. They never existed, so `var(--duration-fast)`
      // resolved to nothing — a component author following the doc shipped an
      // animation with no duration and no error. The doc now says bands; this
      // asserts the styles still agree with that.
      const declared = [TOKENS_CSS, THEME_CSS, PREFLIGHT_CSS]
        .flatMap((file) => [
          ...stripCssComments(readFileSync(file, 'utf8')).matchAll(
            /(--(?:duration|ease)-[a-z0-9-]+)\s*:/g,
          ),
        ])
        .map((match) => match[1]);

      const doc = readFileSync(MOTION_DOC, 'utf8');

      expect(
        declared.filter((token) => !doc.includes(token)),
        `packages/ui/styles declares ${declared.length} motion token(s), and ` +
          `MOTION_PHILOSOPHY.md does not name all of them. The doc currently ` +
          `tells authors NO such scale exists; a scale that ships without the ` +
          `doc catching up is a scale nobody is allowed to use.\n\n  ` +
          `${declared.join('\n  ')}`,
      ).toEqual([]);

      // The other direction is the one that actually bit. `var(--duration-fast)`
      // is not an error when the token is absent — it is invalid at
      // computed-value time, so the animation simply runs at 0s and the author
      // who followed the doc ships nothing. The disclaimer is what stops that
      // being written, so it is load-bearing text, not commentary.
      expect(
        doc,
        `MOTION_PHILOSOPHY.md's duration/easing tables lost the sentence that ` +
          `says they are bands rather than tokens. Without it the tables read ` +
          `as a token scale — which is how they read for as long as they ` +
          `existed, while packages/ui/styles declared no such token. Restore ` +
          `the disclaimer, or ship the tokens (and extend this lock).`,
      ).toContain('budget bands, not CSS custom properties');
    });
  });
});
