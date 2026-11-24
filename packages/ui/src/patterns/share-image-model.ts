/**
 * @interlace/ui — share-image-model
 *
 * The pure half of `ShareImage`: the sizes the networks crop to, the theme an
 * image is painted with, which way its text runs, how big its title can be,
 * and the `og:` and `twitter:` tags that point at it.
 *
 * A share image is painted by an image renderer (Next's `ImageResponse`,
 * Satori, a headless browser), not by the page, so it cannot read CSS
 * variables. `themeFromCss()` reads the consumer's own theme file instead:
 * the same `:root { --background: …; --primary: … }` block the site is
 * styled with, `var()` references resolved and `oklch()` turned into hex.
 * The brand stays in one place.
 *
 * | Size     | Pixels      | Where it shows                                           |
 * | -------- | ----------- | -------------------------------------------------------- |
 * | `og`     | 1200 × 630  | X, LinkedIn, Facebook, Slack, iMessage, WhatsApp links    |
 * | `square` | 1200 × 1200 | WhatsApp and iMessage thumbnails, Instagram, a saved card |
 */

export type ShareImageSize = 'og' | 'square';

export const SHARE_IMAGE_SIZES: Record<ShareImageSize, { width: number; height: number }> = {
  og: { width: 1200, height: 630 },
  square: { width: 1200, height: 1200 },
};

/** Every colour and face a share image paints with. Colours are CSS colours Satori can parse. */
export interface ShareImageTheme {
  /** The page colour. */
  background: string;
  /** Body text and the title. */
  foreground: string;
  /** The description, the footer and quiet labels. */
  muted: string;
  /** The one accent: the kicker, the rule, the stat. */
  accent: string;
  /** Text set on the accent. */
  accentForeground: string;
  /** Panels inside the image (the chart, a stat box). */
  surface: string;
  /** Hairlines. */
  border: string;
  /** Chart series, in order. */
  chart: string[];
  /** Font family names as registered with the renderer. */
  fontHeading: string;
  fontBody: string;
}

/** Interlace's neutral look, for an image with no theme of its own. */
export const NEUTRAL_SHARE_THEME: ShareImageTheme = {
  background: oklchToHex(0.985, 0, 0),
  foreground: oklchToHex(0.145, 0, 0),
  muted: oklchToHex(0.44, 0, 0),
  accent: oklchToHex(0.205, 0, 0),
  accentForeground: oklchToHex(0.985, 0, 0),
  surface: oklchToHex(1, 0, 0),
  border: oklchToHex(0.922, 0, 0),
  chart: [
    oklchToHex(0.55, 0.15, 250),
    oklchToHex(0.6, 0.13, 70),
    oklchToHex(0.55, 0.14, 155),
    oklchToHex(0.55, 0.16, 300),
    oklchToHex(0.55, 0, 0),
  ],
  fontHeading: 'serif',
  fontBody: 'sans-serif',
};

// ─── Colour ──────────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function hex2(n: number): string {
  return Math.round(clamp01(n) * 255)
    .toString(16)
    .padStart(2, '0');
}

function gammaEncode(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** OKLCH (lightness 0 to 1, chroma, hue in degrees) to `#rrggbb`, clipped to sRGB. */
export function oklchToHex(l: number, c: number, h: number): string {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = Math.pow(l + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m_ = Math.pow(l - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s_ = Math.pow(l - 0.0894841775 * a - 1.291485548 * b, 3);
  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  return `#${hex2(gammaEncode(r))}${hex2(gammaEncode(g))}${hex2(gammaEncode(bl))}`;
}

const OKLCH_RE = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.%]+\s*)?\)$/i;

/**
 * A theme colour in a form Satori can paint: `oklch()` becomes hex, and hex,
 * `rgb()`, `hsl()` and names pass through. Anything else (`color-mix()`, a
 * leftover `var()`) gives `undefined`, so the caller falls back.
 */
export function toPaintableColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  const m = OKLCH_RE.exec(v);
  if (m) {
    const l = Number(m[1]) / (m[2] ? 100 : 1);
    return oklchToHex(l, Number(m[3]), Number(m[4]));
  }
  if (/^#[\da-f]{3,8}$/i.test(v) || /^(rgb|rgba|hsl|hsla)\(/i.test(v) || /^[a-z]+$/i.test(v)) {
    return v;
  }
  return undefined;
}

// ─── Theme from the consumer's CSS ───────────────────────────────────────────

/** Strip comments, then find each `selector { … }` block that is not inside an at-rule. */
function topLevelBlocks(css: string, selector: string): string[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: string[] = [];
  let depth = 0;
  let start = 0;
  let head = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      if (depth === 0) {
        head = src.slice(start, i).trim();
        start = i + 1;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        if (head.split(',').some((s) => s.trim() === selector)) blocks.push(src.slice(start, i));
        start = i + 1;
      }
    }
  }
  return blocks;
}

/** The index of the `)` that closes the `(` just before `from`, or -1. */
function closingParen(value: string, from: number): number {
  let depth = 1;
  for (let i = from; i < value.length; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

/** Resolve `var(--name)` and `var(--name, fallback)`, a few levels deep. */
function resolveVars(value: string, tokens: Record<string, string>, depth = 0): string {
  const at = value.indexOf('var(');
  if (at === -1 || depth > 8) return value;
  const end = closingParen(value, at + 4);
  if (end === -1) return value;
  const inner = value.slice(at + 4, end);
  const comma = inner.indexOf(',');
  const name = (comma === -1 ? inner : inner.slice(0, comma)).trim().replace(/^--/, '');
  const fallback = comma === -1 ? '' : inner.slice(comma + 1).trim();
  const next = `${value.slice(0, at)}${tokens[name] ?? fallback}${value.slice(end + 1)}`;
  return resolveVars(next, tokens, depth + 1);
}

/**
 * The custom properties a theme file sets on `selector` (default `:root`),
 * outside any media query, keyed without the leading `--`, with `var()`
 * references resolved. Pass `selector: '.dark'` for the dark scheme.
 */
export function readThemeTokens(css: string, selector = ':root'): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const block of topLevelBlocks(css, selector)) {
    for (const decl of block.split(';')) {
      const colon = decl.indexOf(':');
      const name = decl.slice(0, colon).trim();
      if (colon > 0 && name.startsWith('--')) raw[name.slice(2)] = decl.slice(colon + 1).trim();
    }
  }
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) out[name] = resolveVars(value, raw);
  return out;
}

/**
 * A share theme from shadcn token names (`background`, `foreground`,
 * `muted-foreground`, `primary`, `primary-foreground`, `card`, `border`,
 * `chart-1`…`chart-5`). Missing or unpaintable tokens keep the neutral value;
 * `overrides` wins over both (fonts are named here).
 */
export function shareThemeFromTokens(
  tokens: Record<string, string>,
  overrides: Partial<ShareImageTheme> = {},
): ShareImageTheme {
  const pick = (name: string, fallback: string) => toPaintableColor(tokens[name]) ?? fallback;
  const n = NEUTRAL_SHARE_THEME;
  return {
    background: pick('background', n.background),
    foreground: pick('foreground', n.foreground),
    muted: pick('muted-foreground', n.muted),
    accent: pick('primary', n.accent),
    accentForeground: pick('primary-foreground', n.accentForeground),
    surface: pick('card', n.surface),
    border: pick('border', n.border),
    chart: n.chart.map((fallback, i) => pick(`chart-${i + 1}`, fallback)),
    fontHeading: n.fontHeading,
    fontBody: n.fontBody,
    ...overrides,
  };
}

/** `shareThemeFromTokens(readThemeTokens(css, selector), overrides)`. */
export function themeFromCss(
  css: string,
  overrides: Partial<ShareImageTheme> = {},
  selector = ':root',
): ShareImageTheme {
  return shareThemeFromTokens(readThemeTokens(css, selector), overrides);
}

// ─── Text ────────────────────────────────────────────────────────────────────

const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_RE = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

/** The direction of the first strong character, as the Unicode bidi algorithm reads a paragraph. */
export function textDirection(text: string): 'ltr' | 'rtl' {
  for (const ch of text) {
    if (RTL_RE.test(ch)) return 'rtl';
    if (LTR_RE.test(ch)) return 'ltr';
  }
  return 'ltr';
}

/**
 * About how many lines `text` wraps to at `size` pixels in a box `width`
 * wide. Average glyph width is taken as 0.5em (a fair middle for a book serif
 * or a grotesque), and wrapping wastes about a word a line, so each line is
 * planned at 85%.
 */
export function estimateLines(text: string, size: number, width: number): number {
  const chars = Math.max(1, [...text].length);
  return Math.max(1, Math.ceil((chars * 0.5 * size) / (width * 0.85)));
}

/** What `planWords` decided: the title's size and how much description fits. */
export interface WordsPlan {
  titleSize: number;
  /** Characters of description to keep (0 drops it). */
  descriptionChars: number;
}

/**
 * Size a title block to a box: the largest title (from `max` down by 2px,
 * never under `min`, at most `maxLines` lines) that still leaves room for a
 * line of description, and as much description as then fits, up to two
 * lines. Line heights match `ShareImage`: title 1.1, description 28px at 1.4,
 * kicker 34px plus an 18px gap.
 */
export function planWords({
  title,
  kicker,
  description,
  width,
  height,
  max,
  min = 40,
  maxLines = 3,
}: {
  title: string;
  kicker?: string;
  description?: string;
  width: number;
  height: number;
  max: number;
  min?: number;
  maxLines?: number;
}): WordsPlan {
  const kickerH = kicker ? 52 : 0;
  const descLine = 28 * 1.4;
  const perDescLine = Math.floor((width * 0.85) / (28 * 0.5));
  for (let size = max; size >= min; size -= 2) {
    if (estimateLines(title, size, width) > maxLines && size > min) continue;
    const room = height - kickerH - estimateLines(title, size, width) * size * 1.1 - 18;
    const descLines = description ? Math.min(2, Math.floor(room / descLine)) : 0;
    const plan = { titleSize: size, descriptionChars: Math.max(0, descLines) * perDescLine };
    if (!description || descLines >= 1) return plan;
  }
  return { titleSize: min, descriptionChars: 0 };
}

/**
 * `text` broken into lines that fit a box `width` pixels wide at `size`,
 * greedily by word, planning each character at `em` of the size (0.55 by
 * default: on the wide side, so a planned line never wraps again).
 *
 * Satori cannot wrap right-to-left text (see `visualRtlLine`), so
 * `ShareImage` plans the lines here and draws each as its own box.
 */
export function breakLines(text: string, size: number, width: number, em = 0.55): string[] {
  const perLine = Math.max(1, Math.floor(width / (size * em)));
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && [...next].length > perLine) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const HEBREW_RE = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
const LTR_PIECE_RE = /[A-Za-z0-9\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]+/g;
const MIRROR: Record<string, string> = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' };

/**
 * `text` cut into bidi runs, in reading order: each right-to-left word on
 * its own, and each run of left-to-right words and numbers kept together
 * (`World War II`, `+972 3 555`). A word with no strong letters (a dash, a
 * symbol) stays with the left-to-right run it follows.
 */
export function bidiRuns(text: string): string[] {
  const runs: string[] = [];
  let ltr: string[] = [];
  const flush = () => {
    if (ltr.length) runs.push(ltr.join(' '));
    ltr = [];
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const isRtl = RTL_RE.test(word);
    if (!isRtl && (LTR_RE.test(word) || /\d/.test(word) || ltr.length)) {
      ltr.push(word);
    } else {
      flush();
      runs.push(word);
    }
  }
  flush();
  return runs;
}

function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((g) => g.segment);
  }
  return [...text];
}

/** A Hebrew word drawn left to right: letters reversed (points kept on their letter), digits kept, brackets mirrored. */
function hebrewVisual(word: string): string {
  const pieces: string[] = [];
  let last = 0;
  for (const m of word.matchAll(LTR_PIECE_RE)) {
    if (m.index > last) pieces.push(...graphemes(word.slice(last, m.index)).map((g) => MIRROR[g] ?? g));
    pieces.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < word.length) pieces.push(...graphemes(word.slice(last)).map((g) => MIRROR[g] ?? g));
  return pieces.reverse().join('');
}

/** A left-to-right run inside right-to-left text: its closing punctuation belongs to the sentence, on the left. */
function ltrVisual(run: string): string {
  let cut = run.length;
  while (cut > 0 && '.,!?:;'.includes(run[cut - 1])) cut--;
  return `${run.slice(cut)}${run.slice(0, cut)}`;
}

/**
 * One right-to-left line in the order a left-to-right renderer must draw it.
 *
 * Satori, under Next's `ImageResponse`, has no bidi algorithm: it draws text
 * left to right. Its font engine shapes Arabic and orders the letters of an
 * Arabic word itself, but leaves Hebrew letters and the order of words as
 * given. So the runs are reversed, Hebrew words are reversed letter by letter
 * (numbers and brackets kept readable), and Arabic words are left to the
 * engine. Left-to-right runs keep their order.
 */
export function visualRtlLine(line: string): string {
  return bidiRuns(line)
    .reverse()
    .map((run) => {
      if (!RTL_RE.test(run)) return ltrVisual(run);
      return HEBREW_RE.test(run) || !/[\u0600-\u06FF]/.test(run) ? hebrewVisual(run) : run;
    })
    .join(' ');
}

/** Cut `text` at a word boundary to at most `max` characters, with an ellipsis. */
export function clampText(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max - 1).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// ─── Meta tags ───────────────────────────────────────────────────────────────

export interface ShareImageRef {
  /** Absolute, or relative to the site's base URL. */
  url: string;
  size?: ShareImageSize;
  /** What the image shows, for readers who cannot see it. */
  alt: string;
}

export interface ShareMetaInput {
  title: string;
  description?: string;
  /** The page's canonical URL. */
  url?: string;
  siteName?: string;
  /** e.g. `en_US`, `he_IL`. */
  locale?: string;
  type?: 'website' | 'article';
  images: ShareImageRef[];
}

/**
 * The `openGraph` and `twitter` fields of a Next.js `Metadata` object (the
 * shape every framework's head tags follow), with each image's width,
 * height, type and alt written out, so a network never has to fetch the
 * image to lay out the preview. X gets the large card.
 */
export function shareMeta(input: ShareMetaInput) {
  const images = input.images.map((img) => ({
    url: img.url,
    ...SHARE_IMAGE_SIZES[img.size ?? 'og'],
    type: 'image/png',
    alt: img.alt,
  }));
  return {
    openGraph: {
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      ...(input.url ? { url: input.url } : {}),
      ...(input.siteName ? { siteName: input.siteName } : {}),
      ...(input.locale ? { locale: input.locale } : {}),
      type: input.type ?? 'website',
      images,
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      images: images.slice(0, 1).map(({ url, alt }) => ({ url, alt })),
    },
  };
}
