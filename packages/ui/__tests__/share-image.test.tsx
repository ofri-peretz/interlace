/**
 * Share images: the theme read from a consumer's CSS, line planning, the
 * right-to-left drawing order, the meta tags, and the card's layout.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  NEUTRAL_SHARE_THEME,
  SHARE_IMAGE_SIZES,
  bidiRuns,
  breakLines,
  clampText,
  estimateLines,
  oklchToHex,
  planWords,
  readThemeTokens,
  shareMeta,
  shareThemeFromTokens,
  textDirection,
  themeFromCss,
  toPaintableColor,
  visualRtlLine,
} from '../src/patterns/share-image-model.js';
import { ShareImage } from '../src/patterns/share-image.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

const THEME_CSS = `
/* a comment with { braces } */
:root {
  --radius: 0.5rem;
  --brand: #0038b8;
  --background: #f7f4ee;
  --foreground: oklch(0.2 0 0);
  --primary: var(--brand);
  --primary-foreground: var(--missing, #ffffff);
  --muted-foreground: rgb(87 82 74);
  --border: color-mix(in srgb, red 50%, blue);
  --chart-2: var(--brand);
}
@media (prefers-color-scheme: dark) {
  :root { --background: #191814; }
}
.dark, .theme-dark { --background: #000000; }
`;

describe('colour', () => {
  it('turns OKLCH into sRGB hex, clipped', () => {
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff');
    expect(oklchToHex(0, 0, 0)).toBe('#000000');
    expect(oklchToHex(0.628, 0.2577, 29.23)).toBe('#ff0000');
    expect(oklchToHex(0.9, 0.4, 145)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps what Satori paints and converts OKLCH', () => {
    expect(toPaintableColor(undefined)).toBeUndefined();
    expect(toPaintableColor('oklch(62.8% 0.2577 29.23deg)')).toBe('#ff0000');
    expect(toPaintableColor('oklch(1 0 0 / 50%)')).toBe('#ffffff');
    expect(toPaintableColor(' #abc ')).toBe('#abc');
    expect(toPaintableColor('rgb(1 2 3)')).toBe('rgb(1 2 3)');
    expect(toPaintableColor('hsl(10 20% 30%)')).toBe('hsl(10 20% 30%)');
    expect(toPaintableColor('white')).toBe('white');
    expect(toPaintableColor('color-mix(in srgb, red, blue)')).toBeUndefined();
  });
});

describe('theme from CSS', () => {
  it('reads top-level custom properties and resolves var()', () => {
    const tokens = readThemeTokens(THEME_CSS);
    expect(tokens.background).toBe('#f7f4ee');
    expect(tokens.primary).toBe('#0038b8');
    expect(tokens['primary-foreground']).toBe('#ffffff');
    expect(tokens['chart-2']).toBe('#0038b8');
    expect(readThemeTokens(THEME_CSS, '.dark').background).toBe('#000000');
    expect(readThemeTokens(THEME_CSS, '.nothing')).toEqual({});
  });

  it('drops a var() with no value and no fallback, and stops on a cycle', () => {
    const tokens = readThemeTokens(':root { --a: var(--nope); --b: var(--c); --c: var(--b); }');
    expect(tokens.a).toBe('');
    expect(tokens.b).toMatch(/var\(--/);
    expect(readThemeTokens(':root { --open: var(--never-closed }').open).toBe('var(--never-closed');
    expect(readThemeTokens(':root { color: red; --nested: var(--x, rgb(1 2 3)) }').nested).toBe('rgb(1 2 3)');
  });

  it('maps shadcn names onto the theme, keeping neutral values for gaps', () => {
    const theme = themeFromCss(THEME_CSS, { fontHeading: 'Serif Face' });
    expect(theme.background).toBe('#f7f4ee');
    expect(theme.foreground).toMatch(/^#[0-9a-f]{6}$/);
    expect(theme.accent).toBe('#0038b8');
    expect(theme.muted).toBe('rgb(87 82 74)');
    expect(theme.border).toBe(NEUTRAL_SHARE_THEME.border);
    expect(theme.chart[0]).toBe(NEUTRAL_SHARE_THEME.chart[0]);
    expect(theme.chart[1]).toBe('#0038b8');
    expect(theme.fontHeading).toBe('Serif Face');
    expect(theme.fontBody).toBe('sans-serif');
    expect(themeFromCss(THEME_CSS, {}, '.dark').background).toBe('#000000');
    expect(shareThemeFromTokens({})).toEqual(NEUTRAL_SHARE_THEME);
  });
});

describe('text', () => {
  it('finds the direction from the first strong letter', () => {
    expect(textDirection('123 שלום')).toBe('rtl');
    expect(textDirection('مرحبا')).toBe('rtl');
    expect(textDirection('1948 Hello שלום')).toBe('ltr');
    expect(textDirection('— 42')).toBe('ltr');
  });

  it('estimates lines and plans a title against the room left', () => {
    expect(estimateLines('', 40, 1000)).toBe(1);
    expect(estimateLines('x'.repeat(100), 40, 1000)).toBe(3);
    const short = planWords({ title: 'Short', description: 'One line.', width: 1000, height: 340, max: 76 });
    expect(short.titleSize).toBe(76);
    expect(short.descriptionChars).toBeGreaterThan(0);
    const long = planWords({
      title: 'word '.repeat(14),
      kicker: 'Kicker',
      description: 'A description.',
      width: 600,
      height: 340,
      max: 76,
    });
    expect(long.titleSize).toBeLessThan(76);
    expect(long.descriptionChars).toBeGreaterThan(0);
    expect(planWords({ title: 'Plain', width: 600, height: 300, max: 60 })).toEqual({
      titleSize: 60,
      descriptionChars: 0,
    });
    // No room for a description at any size: the smallest title, no description.
    expect(
      planWords({ title: 'word '.repeat(60), description: 'Gone.', width: 400, height: 120, max: 50, min: 40 }),
    ).toEqual({ titleSize: 40, descriptionChars: 0 });
  });

  it('breaks lines by word', () => {
    expect(breakLines('one two three four', 10, 60)).toEqual(['one two', 'three four']);
    expect(breakLines('  ', 10, 60)).toEqual([]);
    expect(breakLines('unbreakableword', 10, 20)).toEqual(['unbreakableword']);
  });

  it('cuts text at a word with an ellipsis', () => {
    expect(clampText('short', 10)).toBe('short');
    expect(clampText('the quick brown fox jumps', 18)).toBe('the quick brown…');
    expect(clampText('abcdefghijklmnopqrstuvwxyz', 10)).toBe('abcdefghi…');
  });
});

describe('right-to-left drawing order', () => {
  it('keeps Latin runs and numbers together', () => {
    expect(bidiRuns('אחת World War II — שתיים 1948 שלוש')).toEqual([
      'אחת',
      'World War II —',
      'שתיים',
      '1948',
      'שלוש',
    ]);
    expect(bidiRuns('— אחת')).toEqual(['—', 'אחת']);
  });

  it('reverses Hebrew letters and words, mirrors brackets, keeps numbers', () => {
    expect(visualRtlLine('למה הגאות')).toBe('תואגה המל');
    expect(visualRtlLine('(מגיעה) ב-1948?')).toBe('?1948-ב (העיגמ)');
    expect(visualRtlLine('מלחמת World War II החלה ב 1939.')).toBe('.1939 ב הלחה World War II תמחלמ');
  });

  it('keeps digits in order at either end of a Hebrew word', () => {
    expect(visualRtlLine('1948ב')).toBe('ב1948');
    expect(visualRtlLine('ב-1948')).toBe('1948-ב');
  });

  it('leaves the letters of an Arabic word to the font engine', () => {
    expect(visualRtlLine('لماذا يأتي المد؟')).toBe('المد؟ يأتي لماذا');
  });

  it('falls back to code points without Intl.Segmenter', () => {
    const { Segmenter: _segmenter, ...noSegmenter } = Intl as unknown as Record<string, unknown>;
    vi.stubGlobal('Intl', noSegmenter);
    expect(visualRtlLine('שלום')).toBe('םולש');
  });
});

describe('shareMeta', () => {
  it('writes sizes, type and alt for every image, and the large card for X', () => {
    const meta = shareMeta({
      title: 'Title',
      description: 'Desc',
      url: 'https://example.com/a/',
      siteName: 'Example',
      locale: 'en_US',
      type: 'article',
      images: [
        { url: '/a/opengraph-image.png', alt: 'A card' },
        { url: '/a/square.png', size: 'square', alt: 'A square card' },
      ],
    });
    expect(meta.openGraph).toEqual({
      title: 'Title',
      description: 'Desc',
      url: 'https://example.com/a/',
      siteName: 'Example',
      locale: 'en_US',
      type: 'article',
      images: [
        { url: '/a/opengraph-image.png', width: 1200, height: 630, type: 'image/png', alt: 'A card' },
        { url: '/a/square.png', width: 1200, height: 1200, type: 'image/png', alt: 'A square card' },
      ],
    });
    expect(meta.twitter).toEqual({
      card: 'summary_large_image',
      title: 'Title',
      description: 'Desc',
      images: [{ url: '/a/opengraph-image.png', alt: 'A card' }],
    });
  });

  it('leaves out what was not given', () => {
    const meta = shareMeta({ title: 'T', images: [] });
    expect(meta.openGraph).toEqual({ title: 'T', type: 'website', images: [] });
    expect(meta.twitter).toEqual({ card: 'summary_large_image', title: 'T', images: [] });
  });
});

describe('ShareImage', () => {
  const html = (el: React.ReactElement) => renderToStaticMarkup(el);

  it('lays out a 1200 by 630 card with the words alone', () => {
    const out = html(
      <ShareImage
        title="A title"
        kicker="Kicker"
        description="One sentence."
        brand="Brand"
        label="Guide"
        site="example.com"
        footnote="4 sources"
      />,
    );
    expect(out).toContain('data-slot="share-image"');
    expect(out).toContain('data-size="og"');
    expect(out).toContain('dir="ltr"');
    expect(out).toContain('width:1200px;height:630px');
    expect(out).toContain('>Kicker<');
    expect(out).toContain('>One sentence.<');
    expect(out).toContain('>Guide<');
    expect(out).toContain('>4 sources<');
    expect(out).not.toContain('share-image-visual');
  });

  it('puts a stat beside the words, and bars under them in a square', () => {
    const stat = html(<ShareImage title="T" stat={{ value: '38%', label: 'of the coast' }} />);
    expect(stat).toContain('share-image-visual');
    expect(stat).toContain('>38%<');
    expect(stat).toContain('flex-direction:row;align-items:center');

    const bars = html(
      <ShareImage
        size="square"
        title="T"
        bars={[
          { label: 'A', value: 50, display: '50%' },
          { label: 'B', value: 0 },
        ]}
      />,
    );
    expect(bars).toContain('width:1200px;height:1200px');
    expect(bars).toContain('data-slot="share-image-bars"');
    expect(bars).toContain('>50%<');
    expect(bars).toContain('width:100%');
    expect(bars).toContain('width:2%');
  });

  it('lets a drawing win over a stat, and ignores empty bars', () => {
    const out = html(<ShareImage title="T" visual={<i>drawn</i>} stat={{ value: '1', label: 'x' }} />);
    expect(out).toContain('<i>drawn</i>');
    expect(out).not.toContain('>1<');
    expect(html(<ShareImage title="T" bars={[]} />)).not.toContain('share-image-visual');
    expect(html(<ShareImage title="T" brand={<b>mark</b>} />)).toContain('<b>mark</b>');
  });

  it('mirrors a right-to-left card and draws its text in order', () => {
    const out = html(
      <ShareImage
        title="למה הגאות"
        kicker="שאלה"
        description="הסבר קצר."
        brand="אטלס"
        label="מדריך"
        site="example.com"
        stat={{ value: '12', label: 'שעות' }}
      />,
    );
    expect(out).toContain('dir="rtl"');
    expect(out).toContain('flex-direction:row-reverse');
    expect(out).toContain('>תואגה המל<');
    expect(out).toContain('>סלטא<');
    expect(out).toContain('>.רצק רבסה<');
    expect(out).toContain('>תועש<');

    const bars = html(<ShareImage dir="rtl" title="Forced" bars={[{ label: 'אחת', value: 1 }]} />);
    expect(bars).toContain('>תחא<');
    expect(html(<ShareImage dir="ltr" title="למה" />)).toContain('>למה<');
  });

  it('sizes a square card with a stat, and one with words alone', () => {
    expect(html(<ShareImage size="square" title="T" stat={{ value: '9', label: 'x' }} />)).toContain(
      'font-size:180px',
    );
    const alone = html(<ShareImage size="square" title="T" description="D" />);
    expect(alone).toContain('font-size:96px');
    expect(alone).toContain('>D<');
  });

  it('exposes the sizes', () => {
    expect(SHARE_IMAGE_SIZES.square).toEqual({ width: 1200, height: 1200 });
  });
});
