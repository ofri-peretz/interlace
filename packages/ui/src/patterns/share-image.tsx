/**
 * @interlace/ui — ShareImage
 *
 * The picture a link unfurls into on X, LinkedIn, Facebook, WhatsApp,
 * iMessage and Slack: a kicker, the page's title, a line of description, and
 * one optional piece of evidence (a big number, a few bars, or anything you
 * draw), with your mark at the top and your address at the foot.
 *
 * ## Painted by an image renderer
 *
 * The tree uses only what Satori (Next's `ImageResponse`, `@vercel/og`)
 * paints: flex boxes and inline styles, no classes and no CSS variables. So
 * the theme arrives as a value, built once from your own theme file:
 *
 *   ```tsx
 *   // app/opengraph-image.tsx
 *   import { ImageResponse } from 'next/og';
 *   import { ShareImage } from '@/components/ui/patterns/share-image';
 *   import { SHARE_IMAGE_SIZES, themeFromCss } from '@/components/ui/patterns/share-image-model';
 *
 *   const theme = themeFromCss(await readFile('app/theme.css', 'utf8'), {
 *     fontHeading: 'Newsreader',
 *     fontBody: 'Inter',
 *   });
 *   export const size = SHARE_IMAGE_SIZES.og;
 *   export default function Image() {
 *     return new ImageResponse(
 *       <ShareImage theme={theme} kicker="Guide" title="How the tide tables work" site="example.com" />,
 *       { ...size, fonts },
 *     );
 *   }
 *   ```
 *
 * It renders in a browser too, which is how Storybook shows it.
 *
 * ## Two sizes
 *
 * `size="og"` (1200 × 630) puts the evidence beside the words; `size="square"`
 * (1200 × 1200) stacks it below them. The title's size steps down with its
 * length and the room left (`planWords`), and the description is cut at a word.
 *
 * ## Right to left
 *
 * `dir="auto"` (the default) reads the title's first strong letter. In a
 * right-to-left image the rows mirror and the text sets from the right.
 * Satori has no bidi algorithm: it draws every line left to right. So
 * right-to-left text is broken into lines here (`breakLines`, planned wide so
 * none wraps again), each line is put in drawing order (`visualRtlLine`:
 * words reversed, Hebrew letters reversed, Arabic left to the font engine,
 * which orders an Arabic word's letters itself, Latin runs and numbers kept),
 * and each is set as its own box against the right edge.
 *
 * Satori shapes Arabic, but reads only some fonts' Arabic tables: Cairo
 * works; Noto Naskh Arabic, Noto Sans Arabic, Noto Kufi Arabic and Amiri
 * throw. Register an Arabic face that renders after your Latin faces, and
 * the renderer falls back to it glyph by glyph.
 *
 * ## No motion
 *
 * A share image is a still: nothing here animates.
 *
 * ## MIN_VIEWPORT — 1200
 *
 * ## Anatomy
 *
 *   <div data-slot="share-image" data-size="og|square" dir>
 *     <div data-slot="share-image-edge" />                         (the accent rule)
 *     <div data-slot="share-image-head"> {brand} {label} </div>
 *     <div data-slot="share-image-body">
 *       <div data-slot="share-image-words"> kicker · title · description </div>
 *       <div data-slot="share-image-visual"> {stat | bars | visual} </div>
 *     </div>
 *     <div data-slot="share-image-foot"> {site} {footnote} </div>
 *   </div>
 */

import type { CSSProperties, ReactNode } from 'react';
import {
  NEUTRAL_SHARE_THEME,
  SHARE_IMAGE_SIZES,
  breakLines,
  visualRtlLine,
  clampText,
  planWords,
  textDirection,
  type ShareImageSize,
  type ShareImageTheme,
} from './share-image-model.js';

export interface ShareImageBar {
  label: string;
  /** Any number: bars are scaled to the largest. */
  value: number;
  /** What is printed at the bar's end; defaults to the value. */
  display?: string;
}

export interface ShareImageProps {
  /** The page's title, the one thing everyone reads. */
  title: string;
  /** A word or two above the title: the section, the kind of page. */
  kicker?: string;
  /** One sentence under the title. Cut at a word to fit. */
  description?: string;
  /** Your mark, top start. A string is set in the heading face. */
  brand?: ReactNode;
  /** A quiet tag, top end: "Answer", "Dataset", "Daily game". */
  label?: string;
  /** The address readers will see, foot start. */
  site?: string;
  /** Foot end: "6 sources", "Updated 24 Nov 2026". */
  footnote?: string;
  /** A big number and what it counts. */
  stat?: { value: string; label: string };
  /** Up to five bars; largest first reads best. */
  bars?: ShareImageBar[];
  /** Your own drawing in the evidence slot. Wins over `stat` and `bars`. */
  visual?: ReactNode;
  size?: ShareImageSize;
  theme?: ShareImageTheme;
  dir?: 'ltr' | 'rtl' | 'auto';
}

const flex = (style: CSSProperties): CSSProperties => ({ display: 'flex', ...style });

/** A one-line string in drawing order. */
const line = (text: string, rtl: boolean) => (rtl ? visualRtlLine(text) : text);

/**
 * A run of text. Left to right it is one box that wraps. Right to left it is
 * one box per planned line (`breakLines`), each already in drawing order
 * (`visualRtlLine`), set against the right edge.
 */
function Words({ text, rtl, width, style }: { text: string; rtl: boolean; width: number; style: CSSProperties }) {
  if (!rtl) return <div style={style}>{text}</div>;
  const fontSize = Number(style.fontSize);
  return (
    <div style={{ ...style, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      {breakLines(text, fontSize, width).map((line, i) => (
        <div key={`${i}-${line}`} style={{ letterSpacing: 0, textTransform: 'none' }}>
          {visualRtlLine(line)}
        </div>
      ))}
    </div>
  );
}

function Bars({
  bars,
  theme,
  rtl,
  width,
  compact,
}: {
  bars: ShareImageBar[];
  theme: ShareImageTheme;
  rtl: boolean;
  width: number;
  /** Beside the words in a wide image: smaller type, tighter rows. */
  compact: boolean;
}) {
  const top = Math.max(...bars.map((b) => b.value), 1e-9);
  const row = rtl ? 'row-reverse' : 'row';
  const fontSize = compact ? 22 : 26;
  const thick = compact ? 14 : 18;
  // One line per label, leaving room for the value at its end.
  const labelChars = Math.floor((width - 4 * fontSize) / (fontSize * 0.5));
  return (
    <div data-slot="share-image-bars" style={flex({ flexDirection: 'column', gap: compact ? 16 : 22, width: '100%' })}>
      {bars.slice(0, 5).map((bar, i) => (
        <div key={bar.label} style={flex({ flexDirection: 'column', gap: compact ? 6 : 8 })}>
          <div style={flex({ flexDirection: row, justifyContent: 'space-between', gap: 16, fontSize })}>
            <span style={{ color: theme.foreground }}>{line(clampText(bar.label, labelChars), rtl)}</span>
            <span style={{ fontWeight: 700, color: theme.foreground }}>
              {line(bar.display ?? String(bar.value), rtl)}
            </span>
          </div>
          <div style={flex({ flexDirection: row, height: thick, borderRadius: thick / 2, background: theme.border })}>
            <div
              style={{
                width: `${Math.max(2, (bar.value / top) * 100)}%`,
                height: thick,
                borderRadius: thick / 2,
                background: theme.chart[i % theme.chart.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const PAD = 72;

/** Where things go and how big, from the size and whether there is evidence. */
function geometry(size: ShareImageSize, hasEvidence: boolean) {
  const { width, height } = SHARE_IMAGE_SIZES[size];
  const beside = size === 'og' && hasEvidence;
  const inner = width - PAD * 2;
  const wordsWidth = beside ? Math.round(inner * 0.56) : inner;
  return {
    width,
    height,
    beside,
    wordsWidth,
    // The evidence panel's content box: beside the words, or the full width under them.
    panelWidth: (beside ? inner - wordsWidth - 56 : inner) - 84,
    // The height the words may take: the image less its padding, head, foot and,
    // in a square image with evidence, the evidence under them.
    wordsHeight: size === 'og' ? 340 : hasEvidence ? 470 : 880,
    titleMax: size === 'square' ? 96 : beside ? 64 : 76,
    titleLines: beside || size === 'square' ? 4 : 3,
  };
}

interface Frame {
  theme: ShareImageTheme;
  rtl: boolean;
}

function Stat({
  stat,
  theme,
  rtl,
  big,
  width,
}: Frame & { stat: NonNullable<ShareImageProps['stat']>; big: boolean; width: number }) {
  return (
    <div style={flex({ flexDirection: 'column', alignItems: rtl ? 'flex-end' : 'flex-start', gap: 12 })}>
      <span
        style={{
          fontFamily: theme.fontHeading,
          fontSize: big ? 180 : 132,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          color: theme.accent,
        }}
      >
        {line(stat.value, rtl)}
      </span>
      <Words
        text={stat.label}
        rtl={rtl}
        width={width}
        style={{ fontSize: 28, color: theme.muted, textAlign: rtl ? 'right' : 'left' }}
      />
    </div>
  );
}

function Head({ brand, label, theme, rtl }: Frame & Pick<ShareImageProps, 'brand' | 'label'>) {
  return (
    <div
      data-slot="share-image-head"
      style={flex({
        flexDirection: rtl ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      })}
    >
      <div style={flex({ alignItems: 'center', fontFamily: theme.fontHeading, fontSize: 34, fontWeight: 600 })}>
        {typeof brand === 'string' ? line(brand, rtl) : brand}
      </div>
      {label ? (
        <div
          style={flex({
            padding: '6px 20px',
            borderRadius: 999,
            border: `2px solid ${theme.border}`,
            fontSize: 24,
            color: theme.muted,
          })}
        >
          {line(label, rtl)}
        </div>
      ) : null}
    </div>
  );
}

function Foot({ site, footnote, theme, rtl }: Frame & Pick<ShareImageProps, 'site' | 'footnote'>) {
  return (
    <div
      data-slot="share-image-foot"
      style={flex({
        flexDirection: rtl ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 22,
        borderTop: `2px solid ${theme.border}`,
        fontSize: 24,
        color: theme.muted,
      })}
    >
      <span>{line(site ?? '', rtl)}</span>
      <span>{line(footnote ?? '', rtl)}</span>
    </div>
  );
}

function WordsBlock({
  kicker,
  title,
  description,
  theme,
  rtl,
  width,
  titleSize,
  descriptionChars,
}: Frame &
  Pick<ShareImageProps, 'kicker' | 'title' | 'description'> & {
    width: number;
    titleSize: number;
    descriptionChars: number;
  }) {
  const textAlign = rtl ? 'right' : 'left';
  return (
    <div
      data-slot="share-image-words"
      style={flex({ flexDirection: 'column', alignItems: rtl ? 'flex-end' : 'flex-start', width, gap: 18 })}
    >
      {kicker ? (
        <Words
          text={kicker}
          rtl={rtl}
          width={width}
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.accent,
            textAlign,
          }}
        />
      ) : null}
      <Words
        text={title}
        rtl={rtl}
        width={width}
        style={{
          fontFamily: theme.fontHeading,
          fontSize: titleSize,
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: '-0.015em',
          textAlign,
        }}
      />
      {description && descriptionChars > 0 ? (
        <Words
          text={clampText(description, descriptionChars)}
          rtl={rtl}
          width={width}
          style={{ fontSize: 28, lineHeight: 1.4, color: theme.muted, textAlign }}
        />
      ) : null}
    </div>
  );
}

/** The one piece of evidence: your drawing, else the stat, else the bars, else nothing. */
function pickEvidence({
  visual,
  stat,
  bars,
  big,
  width,
  ...frame
}: Frame & Pick<ShareImageProps, 'visual' | 'stat' | 'bars'> & { big: boolean; width: number }): ReactNode {
  if (visual) return visual;
  if (stat) return <Stat {...frame} stat={stat} big={big} width={width} />;
  if (bars && bars.length > 0) return <Bars {...frame} bars={bars} width={width} compact={!big} />;
  return null;
}

export function ShareImage({
  title,
  kicker,
  description,
  brand,
  label,
  site,
  footnote,
  stat,
  bars,
  visual,
  size = 'og',
  theme = NEUTRAL_SHARE_THEME,
  dir = 'auto',
}: ShareImageProps) {
  const rtl = (dir === 'auto' ? textDirection(title) : dir) === 'rtl';
  const frame = { theme, rtl };
  const g = geometry(size, Boolean(visual ?? stat ?? bars?.length));
  const plan = planWords({
    title,
    kicker,
    description,
    width: g.wordsWidth,
    height: g.wordsHeight,
    max: g.titleMax,
    maxLines: g.titleLines,
  });
  const evidence = pickEvidence({ ...frame, visual, stat, bars, big: size === 'square', width: g.panelWidth });

  return (
    <div
      data-slot="share-image"
      data-size={size}
      dir={rtl ? 'rtl' : 'ltr'}
      style={flex({
        position: 'relative',
        flexDirection: 'column',
        width: g.width,
        height: g.height,
        padding: `${PAD + 4}px ${PAD}px ${PAD - 12}px`,
        background: theme.background,
        color: theme.foreground,
        fontFamily: theme.fontBody,
      })}
    >
      <div
        data-slot="share-image-edge"
        style={{ position: 'absolute', top: 0, left: 0, width: g.width, height: 10, background: theme.accent }}
      />
      <Head {...frame} brand={brand} label={label} />
      <div
        data-slot="share-image-body"
        style={flex({
          flex: 1,
          flexDirection: g.beside ? (rtl ? 'row-reverse' : 'row') : 'column',
          alignItems: g.beside ? 'center' : 'stretch',
          justifyContent: g.beside ? 'space-between' : 'center',
          gap: 56,
          padding: '24px 0',
        })}
      >
        <WordsBlock
          {...frame}
          kicker={kicker}
          title={title}
          description={description}
          width={g.wordsWidth}
          titleSize={plan.titleSize}
          descriptionChars={plan.descriptionChars}
        />
        {evidence !== null ? (
          <div
            data-slot="share-image-visual"
            style={flex({
              ...(g.beside ? { flex: 1 } : {}),
              justifyContent: rtl ? 'flex-end' : 'flex-start',
              padding: 40,
              borderRadius: 24,
              background: theme.surface,
              border: `2px solid ${theme.border}`,
            })}
          >
            {evidence}
          </div>
        ) : null}
      </div>
      <Foot {...frame} site={site} footnote={footnote} />
    </div>
  );
}
