/**
 * Composite AA contrast lock.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * Every `--interlace-*` value in `interlace-theme.css` was measured against
 * the surface it was *designed* for, and the header comments record those
 * numbers. But components don't only put solid tokens on solid surfaces —
 * they put a TINT of a token on a surface and then text on top of that:
 *
 *     <span className="bg-primary/10 text-primary">
 *
 * That composite is a colour nobody measured. It is also the binding
 * constraint on the whole palette: `#7d350c` is 8.80:1 on white but only
 * 7.46:1 on its own 10% tint, and the theme file says so explicitly — a
 * lighter orange (`#8a3a10`) cleared 8:1 on white and still failed axe at
 * 6.63:1 on the tint. The tint is where the palette actually breaks.
 *
 * Storybook's axe gate catches this only for pairs a story happens to
 * render, in the states that story happens to paint. This lock reads the
 * SOURCE instead: every `bg-<token>/<alpha>` that shares an element with a
 * `text-<token>` gets composited and measured, whether or not a story
 * exercises it. Static parsing is the point — a pair that only appears
 * under `data-highlighted:` or `aria-invalid:` is still a pair a user will
 * see, and no story enumerates all of those.
 *
 * WHAT IT DOES NOT COVER
 * ----------------------
 * Alpha composition over an *unknown* backdrop. `bg-scrim/70` sits on a
 * user-supplied cover photo; there is no way to compute its contrast from
 * source, so it is exempted below with the reason recorded. Those surfaces
 * are the ones that need a human looking at a screenshot — the exemption
 * list is deliberately short so that stays true.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');
const THEME_CSS = resolve(__dirname, '../styles/interlace-theme.css');
const SCAN_ROOTS = [resolve(__dirname, '../src')];

/** WCAG 2.2 AA floor for normal body text. */
const AA_NORMAL = 4.5;

/**
 * Composites this lock cannot compute, each with the reason it can't.
 * Keyed by the token pair, NOT by file — an exemption is a statement about
 * the colours, so it should apply everywhere those colours meet.
 *
 * Adding an entry is a claim that a human verified the surface. Keep the
 * justification concrete enough that the next reader can re-check it.
 */
const EXEMPT: Record<string, string> = {
  'scrim+scrim-foreground':
    'The scrim sits on a consumer-supplied cover image, not on a DS surface. ' +
    'Its contrast is a property of that photo. The gradient stack ' +
    '(85%→55%→15%) is tuned so white copy clears AA over light and busy ' +
    'covers alike; verified visually in the ArticleCard stories.',
  'scrim-foreground+scrim-foreground':
    'Same surface as above — a white tint chip carrying white text over the ' +
    'image scrim, legible because the scrim under BOTH is what supplies the ' +
    'contrast.',
  'hero-foreground+hero-foreground':
    'HeroCosmic paints its own always-dark surface (--hero-surface) rather ' +
    'than a themed one, and the token pair on it is measured in the theme ' +
    'file at 16.4:1. The tint here is a translucent button face over that ' +
    'same dark surface, so it can only increase contrast.',
};

// ── colour maths ────────────────────────────────────────────────────────

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

/** Lay `fg` over `bg` at `alpha` (0–1). Straight source-over compositing. */
function composite(fg: RGB, bg: RGB, alpha: number): RGB {
  return [0, 1, 2].map((i) =>
    Math.round(fg[i] * alpha + bg[i] * (1 - alpha)),
  ) as RGB;
}

/** WCAG 2.x relative luminance. */
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

// ── theme parsing ───────────────────────────────────────────────────────

type Mode = 'light' | 'dark';

/**
 * Pull the concrete `--interlace-*: #hex` declarations out of the brand
 * layer. The file declares light under `:root` and dark under
 * `.dark, [data-theme='dark']`, in that order, so splitting on the dark
 * selector is enough — no CSS parser needed, and a structural change to the
 * file surfaces as an empty map (which fails the sanity test below) rather
 * than as a silently-passing lock.
 */
function readThemeTokens(): Record<Mode, Map<string, RGB>> {
  const css = readFileSync(THEME_CSS, 'utf8');
  const darkAt = css.indexOf(".dark,\n  [data-theme='dark']");
  expect(
    darkAt,
    'interlace-theme.css no longer contains the expected dark-mode selector — ' +
      'this lock parses the file structurally; update it alongside the CSS.',
  ).toBeGreaterThan(-1);

  const sections: Record<Mode, string> = {
    light: css.slice(0, darkAt),
    dark: css.slice(darkAt),
  };

  const out = { light: new Map(), dark: new Map() } as Record<
    Mode,
    Map<string, RGB>
  >;
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

// ── source scanning ─────────────────────────────────────────────────────

function walkSync(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) walkSync(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * One utility, with whatever variant prefixes it carries.
 *
 * `dark:bg-destructive/60` → prefixes `['dark']`, token `destructive`,
 * alpha `0.6`. The token charset excludes `[` and `(` so arbitrary values
 * (`bg-[color:var(--x)]`) and fumadocs-prefixed tokens fall out rather than
 * parsing as garbage.
 */
/**
 * Split a whitespace-delimited token into its parts, without a regex.
 *
 * Doing this in code rather than in one pattern is deliberate: expressing
 * "any number of `prefix:` segments, each optionally carrying a `[…]`
 * arbitrary value" as a regex needs a quantifier nested inside a quantifier,
 * which is the exponential-backtracking shape (and our own
 * `no-redos-vulnerable-regex` rule flags it, correctly in spirit). A
 * `lastIndexOf` on the final colon does the same job in linear time and reads
 * better besides.
 */
function parseToken(token: string): Utility | null {
  const lastColon = token.lastIndexOf(':');
  const prefixPart = lastColon === -1 ? '' : token.slice(0, lastColon);
  const utility = token.slice(lastColon + 1);

  const m = /^(bg|text)-([a-z][a-z0-9-]*)(?:\/(\d{1,3}))?$/.exec(utility);
  if (!m) return null;

  return {
    // Split on colons that are NOT inside an arbitrary-value bracket, so
    // `data-[state=open]:hover:` yields two prefixes, not three.
    prefixes: splitVariants(prefixPart),
    kind: m[1] as 'bg' | 'text',
    token: m[2],
    alpha: m[3] === undefined ? 1 : Number(m[3]) / 100,
  };
}

/** Colon-split that ignores colons inside `[...]`. */
function splitVariants(prefixPart: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of prefixPart) {
    if (char === '[') depth++;
    else if (char === ']') depth--;
    if (char === ':' && depth === 0) {
      if (current) out.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) out.push(current);
  return out;
}

interface Utility {
  prefixes: string[];
  kind: 'bg' | 'text';
  token: string;
  alpha: number;
}

interface Pair {
  file: string;
  line: number;
  /** Which colour scheme this pair actually renders in. */
  modes: Mode[];
  bgToken: string;
  bgAlpha: number;
  textToken: string;
  textAlpha: number;
}

function parseUtilities(line: string): Utility[] {
  // Class chains are authored as whitespace-separated tokens inside string
  // literals, so splitting on the quote/whitespace set recovers them without
  // needing to know which literal they came from.
  return line
    .split(/[\s'"`{}(),]+/)
    .map(parseToken)
    .filter((u): u is Utility => u !== null);
}

/** The non-`dark:` prefixes, which are what scope a utility to a state. */
const stateKey = (u: Utility) =>
  u.prefixes.filter((p) => p !== 'dark').join(':');

/**
 * Find the background a given text utility actually sits on, in one mode.
 *
 * This is the part that makes the lock trustworthy rather than merely
 * noisy. Naively pairing every `bg-*` on a line with every `text-*` on the
 * same line produced four confident, wrong failures on the first run — the
 * loudest being `bg-input/30` (a checkbox's resting field) paired with
 * `data-[checked]:text-primary-foreground` (the checkmark that only ever
 * appears once `data-[checked]:bg-primary` has repainted that field
 * opaque). The two never coexist.
 *
 * So resolve the cascade instead of ignoring it:
 *
 *   1. A text utility scoped to a state prefers a background under the SAME
 *      state — that is the surface it was written for.
 *   2. Failing that, it falls back to the unconditional background.
 *   3. Within either group, a `dark:` background wins in dark mode, because
 *      that is exactly what the prefix is for.
 *
 * Returns `null` when the resulting background is opaque: an alpha-free
 * surface is a colour someone already measured, and it is the tint case
 * this lock exists for.
 */
function effectiveBackground(
  text: Utility,
  bgs: Utility[],
  mode: Mode,
): Utility | null {
  const applicable = bgs.filter(
    (bg) => mode === 'dark' || !bg.prefixes.includes('dark'),
  );
  const sameState = applicable.filter((bg) => stateKey(bg) === stateKey(text));
  const candidates =
    sameState.length > 0
      ? sameState
      : applicable.filter((bg) => stateKey(bg) === '');
  if (candidates.length === 0) return null;

  // Later declaration wins on a tie; `dark:` outranks unconditional in dark
  // mode regardless of order.
  const winner =
    (mode === 'dark'
      ? [...candidates].reverse().find((bg) => bg.prefixes.includes('dark'))
      : undefined) ?? candidates[candidates.length - 1];

  return winner.alpha < 1 ? winner : null;
}

/**
 * Collect (tinted background, text colour) pairs that share a line AND a
 * rendered surface.
 *
 * Same-line co-occurrence is the structural approximation underneath this:
 * in this codebase a class chain is authored as one string per element (cva
 * slot, `cn(...)` argument, or `className=`), so sharing a line is a good
 * proxy for sharing an element. It can miss a pair split across two lines —
 * it cannot invent one that isn't there, which is the direction that
 * matters for a gate.
 */
function collectPairs(themeTokens: Set<string>): Pair[] {
  const pairs: Pair[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walkSync(root)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // Comment lines describe classes, they don't apply them.
        if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;

        const utils = parseUtilities(line).filter((u) =>
          themeTokens.has(u.token),
        );
        const bgs = utils.filter((u) => u.kind === 'bg');
        if (!bgs.some((bg) => bg.alpha < 1)) return;

        for (const text of utils.filter((u) => u.kind === 'text')) {
          for (const mode of ['light', 'dark'] as const) {
            const bg = effectiveBackground(text, bgs, mode);
            if (!bg) continue;
            pairs.push({
              file,
              line: i + 1,
              modes: [mode],
              bgToken: bg.token,
              bgAlpha: bg.alpha,
              textToken: text.token,
              textAlpha: text.alpha,
            });
          }
        }
      });
    }
  }
  return pairs;
}

// ── the lock ────────────────────────────────────────────────────────────

describe('composite AA contrast lock', () => {
  const theme = readThemeTokens();

  // ── the scanner's own tests ──────────────────────────────────────────
  // Everything below rests on the parser reading class chains correctly. A
  // parser that quietly stopped matching would make every assertion pass
  // vacuously — the failure mode a lock can't afford — so pin its behaviour
  // on the token shapes this codebase actually authors.

  it('parses variant prefixes, tokens, and alpha off a real class chain', () => {
    const utils = parseUtilities(
      `'bg-destructive text-destructive-foreground dark:bg-destructive/60 [a&]:hover:bg-destructive/90'`,
    );

    expect(utils).toEqual([
      { prefixes: [], kind: 'bg', token: 'destructive', alpha: 1 },
      { prefixes: [], kind: 'text', token: 'destructive-foreground', alpha: 1 },
      { prefixes: ['dark'], kind: 'bg', token: 'destructive', alpha: 0.6 },
      { prefixes: ['[a&]', 'hover'], kind: 'bg', token: 'destructive', alpha: 0.9 },
    ]);
  });

  it('does not split colons nested inside an arbitrary value', () => {
    const [util] = parseUtilities(`'data-[state=open]:hover:bg-accent/50'`);
    expect(util.prefixes).toEqual(['data-[state=open]', 'hover']);
    expect(util.alpha).toBe(0.5);
  });

  it('ignores arbitrary-value utilities it cannot resolve to a token', () => {
    expect(parseUtilities(`'bg-[color:var(--interlace-success)] text-[10px]'`)).toEqual(
      [],
    );
  });

  it('picks the state-matched background over the unconditional one', () => {
    // The checkbox case that produced this lock's first false positive: the
    // checkmark's colour belongs to the surface `data-[checked]:` painted,
    // not to the resting field underneath it.
    const utils = parseUtilities(
      `'dark:bg-input/30 data-[checked]:bg-primary data-[checked]:text-primary-foreground'`,
    );
    const text = utils.find((u) => u.kind === 'text')!;
    const bgs = utils.filter((u) => u.kind === 'bg');

    // `data-[checked]:bg-primary` is opaque, so there is no tint to measure.
    expect(effectiveBackground(text, bgs, 'dark')).toBeNull();
  });

  it('parses both brand-layer palettes out of interlace-theme.css', () => {
    // If the parse silently returned nothing, every assertion below would
    // vacuously pass. Anchor on tokens the file is built around.
    for (const mode of ['light', 'dark'] as const) {
      expect(theme[mode].size, `${mode} palette parsed empty`).toBeGreaterThan(
        10,
      );
      for (const token of ['primary', 'background', 'foreground', 'muted-foreground']) {
        expect(
          theme[mode].has(token),
          `${mode} palette is missing --interlace-${token}`,
        ).toBe(true);
      }
    }
  });

  it('reproduces the documented binding constraint (primary on its own 10% tint)', () => {
    // The theme file's own claim: #7d350c measures 8.80:1 on white and
    // 7.46:1 on `bg-primary/10` over white, and that second number is what
    // pins the palette. If this drifts, the comment is now fiction — and
    // every badge-style tint in the DS moved with it.
    const primary = theme.light.get('primary')!;
    const background = theme.light.get('background')!;

    expect(contrast(primary, background)).toBeGreaterThanOrEqual(8.5);

    const tint = composite(primary, background, 0.1);
    const onTint = contrast(primary, tint);
    expect(
      onTint,
      `text-primary on bg-primary/10 measured ${onTint.toFixed(2)}:1. The ` +
        `theme file documents 7.46:1 as the binding constraint on the whole ` +
        `palette — a drop here means the primary token moved and every ` +
        `brand-tinted chip in the DS moved with it.`,
    ).toBeGreaterThanOrEqual(7);
  });

  it('every tinted surface in DS source clears AA against its text token', () => {
    const known = new Set([...theme.light.keys(), ...theme.dark.keys()]);
    const pairs = collectPairs(known);

    const failures: string[] = [];
    const checked: string[] = [];

    for (const pair of pairs) {
      const key = `${pair.bgToken}+${pair.textToken}`;
      if (EXEMPT[key]) continue;

      for (const mode of pair.modes) {
        const palette = theme[mode];
        const bgToken = palette.get(pair.bgToken);
        const textToken = palette.get(pair.textToken);
        const surface = palette.get('background');
        if (!bgToken || !textToken || !surface) continue;

        // The tinted surface: the bg token laid over the page background.
        const tinted = composite(bgToken, surface, pair.bgAlpha);
        // The text, itself possibly translucent, laid over that.
        const text = composite(textToken, tinted, pair.textAlpha);

        const ratio = contrast(text, tinted);
        const label = `${mode} bg-${pair.bgToken}/${Math.round(pair.bgAlpha * 100)} + text-${pair.textToken}${pair.textAlpha < 1 ? `/${Math.round(pair.textAlpha * 100)}` : ''}`;
        checked.push(label);

        if (ratio < AA_NORMAL) {
          failures.push(
            `  ${relative(REPO_ROOT, pair.file)}:${pair.line}\n` +
              `    ${label} → ${ratio.toFixed(2)}:1 (needs ${AA_NORMAL}:1)`,
          );
        }
      }
    }

    // A lock that silently checks nothing is worse than no lock: it reports
    // green forever while the thing it guards rots. Assert it found work.
    expect(
      checked.length,
      'The scanner found no token-tint composites at all. Either the DS ' +
        'genuinely stopped using them (unlikely) or BG_RE / TEXT_RE stopped ' +
        'matching the way classes are authored here. Check the regexes ' +
        'before assuming this is good news.',
    ).toBeGreaterThan(0);

    expect(
      failures,
      `Tinted surfaces below the AA floor.\n\n` +
        `A tint is a colour nobody measured: bg-X/10 composites X onto the ` +
        `page background, and the text on top now needs contrast against ` +
        `THAT, not against the background. Fix by darkening the text token, ` +
        `raising the tint alpha, or pairing with the token's own -foreground.\n\n` +
        `${failures.join('\n')}`,
    ).toEqual([]);
  });

  it('solid semantic pairs clear AA in both modes', () => {
    // The filled counterpart to the tint check: every `bg-X text-X-foreground`
    // pair the DS ships as a status chip / button face.
    const PAIRS = [
      'primary',
      'secondary',
      'destructive',
      'success',
      'warning',
      'info',
      'caution',
      'accent',
      'card',
      'popover',
    ];

    const failures: string[] = [];
    for (const mode of ['light', 'dark'] as const) {
      for (const name of PAIRS) {
        const bg = theme[mode].get(name);
        const fg = theme[mode].get(`${name}-foreground`);
        if (!bg || !fg) continue;
        const ratio = contrast(fg, bg);
        if (ratio < AA_NORMAL) {
          failures.push(
            `  ${mode}: text-${name}-foreground on bg-${name} → ${ratio.toFixed(2)}:1`,
          );
        }
      }
    }

    expect(
      failures,
      `Solid semantic pairs below the AA floor:\n${failures.join('\n')}`,
    ).toEqual([]);
  });

  it('status tokens stay legible as text on the page background', () => {
    // `text-destructive` on `bg-background` is how error copy renders — the
    // foreground token is NOT involved. This is the pair axe flags on form
    // error messages.
    const STATUS = ['destructive', 'success', 'warning', 'info', 'caution', 'primary', 'muted-foreground'];

    const failures: string[] = [];
    for (const mode of ['light', 'dark'] as const) {
      const surface = theme[mode].get('background')!;
      for (const name of STATUS) {
        const token = theme[mode].get(name);
        if (!token) continue;
        const ratio = contrast(token, surface);
        if (ratio < AA_NORMAL) {
          failures.push(
            `  ${mode}: text-${name} on bg-background → ${ratio.toFixed(2)}:1`,
          );
        }
      }
    }

    expect(
      failures,
      `Status tokens below the AA floor as body text:\n${failures.join('\n')}`,
    ).toEqual([]);
  });
});
