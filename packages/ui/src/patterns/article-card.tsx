'use client';

import * as React from 'react';
import { Heart, MessageCircle, Clock, ExternalLink, Eye, Sparkles } from 'lucide-react';

function formatViews(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

import { cn } from '../lib/cn.js';
import { Skeleton } from '../primitives/skeleton.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../primitives/card.js';
import { Badge } from '../primitives/badge.js';

export interface ArticleCardAuthor {
  name: string;
  imageUrl?: string;
}

export interface ArticleCardMeta {
  /** Reaction / like count. */
  reactions?: number;
  /** Comment count. */
  comments?: number;
  /** Reading time in minutes. */
  readingTimeMinutes?: number;
  /** Page-view count. Rendered abbreviated (e.g., `1.2k`) when ≥ 1000. */
  views?: number;
}

/**
 * @deprecated The layout is no longer a prop — it is the component you pick.
 * Use `<ArticleCard>` for the stacked grid tile and `<FeaturedArticleCard>`
 * for the full-bleed hero tile. Kept only so `variant` keeps type-checking
 * during the deprecation window; removed in the next minor.
 */
export type ArticleCardVariant = 'stack' | 'overlay';

/** Fields both card shapes read. Neither adds a prop the other ignores. */
export interface ArticleCardBaseProps {
  /** Card title (article headline). Optional when `loading={true}`. */
  title?: string;
  /** Optional short description / excerpt. */
  description?: string;
  /** Destination URL. The whole card becomes a link to it. Optional when `loading={true}`. */
  href?: string;
  /** Cover image URL. If omitted, a gradient with the title is shown. */
  imageUrl?: string;
  /** Tags / topics — first 3 rendered as filled badges, the rest as a "+N" overflow chip. */
  tags?: string[];
  /** Author block. */
  author?: ArticleCardAuthor;
  /** Publication date (any value `Date` constructor accepts). Rendered short-form: `Mar 5, 2026`. */
  publishedAt?: string | number | Date;
  /** Reactions / comments / reading-time chips on the footer. */
  meta?: ArticleCardMeta;
  /** Small uppercase label shown over the cover (e.g., source attribution like "Dev.to"). */
  sourceLabel?: string;
  /** Open in a new tab. @default true */
  external?: boolean;
  /**
   * Hint the cover image is the LCP element on this route. Eager-loads it
   * with `fetchpriority="high"`. Set on the single featured card above the
   * fold; leave default on every grid tile. @default false
   */
  priority?: boolean;
  /** Class on the outer anchor wrapper. */
  className?: string;
  /**
   * When true, render a `<Skeleton variant="article-card" />` composite
   * (image + title lines + meta row silhouette) instead of the card.
   * Shape-matched so card grids don't shift on data arrival. @default false
   */
  loading?: boolean;
  /**
   * Stable selector hook for E2E tests. Sub-parts derive from it
   * (`{value}-title`, `{value}-tags`, `{value}-meta-views`, …). Required —
   * no runtime default, so an omission surfaces at the call site (R5).
   */
  'data-testid': string;
}

export interface ArticleCardProps extends ArticleCardBaseProps {
  /**
   * @deprecated Pass no `variant` for the stacked tile; render
   * `<FeaturedArticleCard>` instead of `variant="overlay"`. A kind-prop that
   * switches the whole rendered tree hides two components inside one type
   * (R11). Still honoured for one minor, with a dev-mode warning.
   */
  variant?: ArticleCardVariant;
}

/** `<FeaturedArticleCard>` takes the same data, minus the retired knob. */
export type FeaturedArticleCardProps = ArticleCardBaseProps;

function formatDate(value: ArticleCardProps['publishedAt']): string {
  if (value === undefined) return '';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Shared chrome: the focusable anchor + Card surface both shapes sit in. */
function CardShell({
  href,
  external,
  testId,
  className,
  surfaceClassName,
  children,
}: {
  href?: string;
  external: boolean;
  testId: string;
  className?: string;
  surfaceClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      data-slot="article-card"
      data-testid={testId}
      className={cn(
        'group focus-visible:ring-ring block h-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        className,
      )}
    >
      {/* `py-0 gap-0` overrides Card's default `py-6 gap-6`. */}
      <Card
        className={cn(
          'flex h-full flex-col overflow-hidden gap-0 py-0 transition-all duration-300',
          'hover:border-primary/50 hover:shadow-primary/5 hover:shadow-xl',
          'group-focus-visible:border-primary/50',
          surfaceClassName,
        )}
      >
        {children}
      </Card>
    </a>
  );
}

/**
 * Article grid tile: cover image on top, then author / title / description /
 * tags / meta stacked on the card surface. The default shape — use it for
 * "from the blog" grids, external content lists, feed aggregations.
 *
 * For the full-bleed hero tile that usually sits above such a grid, render
 * {@link FeaturedArticleCard} instead. They are two components rather than
 * one `variant` prop because the rendered tree differs entirely (R11).
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                     | Where in this file                                    |
 * | ---- | --------------------------- | ----------------------------------------------------- |
 * | R5   | testid required, no default | `'data-testid': string` → `{value}-title` etc.        |
 * | R6   | data-slot on every part     | `article-card` / `-title` / `-tags` / `-meta`         |
 * | R11  | No kind-prop                | `variant` deprecated; layouts are separate components |
 * | R19  | Tokens only                 | scrim + semantic status tokens, no palette escapes    |
 * | R23  | CLS=0                       | cover reserves `h-44`; `loading` paints a shape-match |
 * | R25  | Deprecation                 | `variant` warns in dev before it is removed           |
 */
export function ArticleCard({
  variant,
  className,
  loading,
  'data-testid': testId,
  ...rest
}: ArticleCardProps) {
  useDeprecatedVariantWarning(variant);

  // Honour the retired knob for one minor so consumers upgrade on their own
  // schedule rather than on ours.
  if (variant === 'overlay') {
    return (
      <FeaturedArticleCard
        className={className}
        loading={loading}
        data-testid={testId}
        {...rest}
      />
    );
  }

  if (loading) {
    return (
      <Skeleton
        variant="article-card"
        data-slot="article-card"
        data-testid={testId}
        className={className}
      />
    );
  }

  const { title, external = true, priority = false, tags, href } = rest;
  const [visibleTags, overflowTags] = splitTags(tags);

  return (
    <CardShell
      href={href}
      external={external}
      testId={testId}
      className={className}
      surfaceClassName="pb-sm"
    >
      <StackBody
        {...rest}
        title={title ?? ''}
        visibleTags={visibleTags}
        overflowTags={overflowTags}
        priority={priority}
        testId={testId}
      />
    </CardShell>
  );
}

/**
 * Full-bleed hero tile: the cover fills the card and the copy sits on a dark
 * gradient scrim, which is what guarantees legible contrast over an
 * arbitrary image. Carries a "Featured" chip and a fixed height so it reads
 * as a hero above a grid of {@link ArticleCard}s.
 */
export function FeaturedArticleCard({
  className,
  loading,
  'data-testid': testId,
  ...rest
}: FeaturedArticleCardProps) {
  if (loading) {
    return (
      <Skeleton
        variant="article-card"
        data-slot="article-card"
        data-testid={testId}
        className={className}
      />
    );
  }

  const { title, external = true, priority = false, tags, href } = rest;
  const [visibleTags, overflowTags] = splitTags(tags);

  return (
    <CardShell
      href={href}
      external={external}
      testId={testId}
      className={className}
      // Fixed height so the hero holds its shape before the cover decodes
      // (R23). Numeric spacing-scale steps, not arbitrary px: h-105 = 420px,
      // h-95 = 380px. The DESKTOP value is the shorter one — a hero that
      // keeps its portrait height on a wide viewport crowds the grid below
      // it. That is a viewport-aspect decision, not a density one, so it
      // doesn't contradict the mobile-first ladder (R22).
      surfaceClassName="relative h-105 md:h-95"
    >
      <OverlayBody
        {...rest}
        title={title ?? ''}
        visibleTags={visibleTags}
        overflowTags={overflowTags}
        priority={priority}
        testId={testId}
      />
    </CardShell>
  );
}

/** First three tags render as chips; the rest collapse into a `+N` pill. */
function splitTags(tags: string[] | undefined): [string[], number] {
  const visible = tags?.slice(0, 3) ?? [];
  return [visible, tags && tags.length > 3 ? tags.length - 3 : 0];
}

/**
 * Dev-only nudge toward the split components (R25). Fires once per mount
 * with a `variant` present; silent in production builds because the bundler
 * strips the branch.
 */
function useDeprecatedVariantWarning(variant: ArticleCardVariant | undefined) {
  React.useEffect(() => {
    if (variant === undefined) return;
    const replacement =
      variant === 'overlay' ? '<FeaturedArticleCard>' : '<ArticleCard> with no variant';
    // eslint-disable-next-line no-console -- deprecation channel; dev only.
    console.warn(
      `[@interlace/ui] ArticleCard: the \`variant\` prop is deprecated and will be removed in the next minor. Render ${replacement} instead.`,
    );
  }, [variant]);
}

interface BodyProps extends Omit<ArticleCardBaseProps, 'title' | 'data-testid'> {
  title: string;
  visibleTags: string[];
  overflowTags: number;
  /** Root test id — every part derives its own id from this. */
  testId: string;
}

/**
 * Chip chrome shared by the source + featured pills. Both float over the
 * cover, so both ride the scrim tokens rather than `bg-black/70 text-white`
 * palette escapes (R19), and both sit at `text-caption` (13px) — the DS type
 * scale's floor. The old `text-[10px]` was below every readable minimum.
 */
const OVER_COVER_CHIP =
  'absolute top-3 z-10 flex items-center gap-1 rounded-md bg-scrim/70 px-2 py-1 text-caption font-bold tracking-wider text-scrim-foreground uppercase backdrop-blur-sm';

/** Top-right chip used to attribute the source of the article (e.g., "Dev.to"). */
function SourceChip({ label, testId }: { label: string; testId: string }) {
  return (
    <div
      data-slot="article-card-source"
      data-testid={`${testId}-source`}
      className={cn(OVER_COVER_CHIP, 'right-3')}
    >
      {label}
    </div>
  );
}

/** Top-left chip shown only on the featured card. */
function FeaturedChip({ testId }: { testId: string }) {
  return (
    <div
      data-slot="article-card-featured-chip"
      data-testid={`${testId}-featured-chip`}
      className={cn(OVER_COVER_CHIP, 'left-3')}
    >
      <Sparkles className="h-3 w-3" aria-hidden />
      Featured
    </div>
  );
}

function CoverImage({
  imageUrl,
  title,
  className,
  fallbackTextClassName,
  priority = false,
}: {
  imageUrl?: string;
  title: string;
  className?: string;
  fallbackTextClassName?: string;
  /**
   * When true, eager-load the cover image and hint the browser to fetch
   * it with high priority. Use on the LCP element of a route — typically
   * the featured/overlay slot on the articles index. Default: false
   * (lazy-loaded, fine for grid tiles below the fold).
   */
  priority?: boolean;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        width={1000}
        height={420}
        loading={priority ? 'eager' : 'lazy'}
        // `fetchpriority` is the lowercase DOM attr name; React 19 normalizes
        // either casing, but lowercase is the canonical HTML form and avoids
        // hydration mismatches across SSR/CSR.
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={cn(
          'h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105',
          className,
        )}
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/25 via-scrim to-chart-2/25 p-md">
      <span
        className={cn(
          'line-clamp-3 text-center leading-snug font-semibold text-scrim-foreground/80',
          fallbackTextClassName ?? 'text-base',
        )}
      >
        {title}
      </span>
    </div>
  );
}

/**
 * Reactions / comments / reading-time / views row.
 *
 * `tone` is a styling switch, not a kind-prop: both tones render the exact
 * same tree and differ only in which foreground token the chips inherit
 * (R11 draws the line at the rendered tree, not at class names).
 *
 * The per-icon hover recolour this used to carry (red / blue / amber-400)
 * was four palette escapes AND a contrast hazard on the scrim tone, where a
 * mid-weight red lands on near-black. Chips now inherit one foreground per
 * tone; only the views chip stays accented, because it is the one number
 * the card is usually sorted by.
 */
function MetaChips({
  meta,
  tone,
  testId,
}: {
  meta: ArticleCardMeta;
  tone: 'muted' | 'scrim';
  testId: string;
}) {
  const baseChip = 'flex items-center gap-1.5 text-caption tabular-nums';
  const onScrim = tone === 'scrim';
  const colorClass = onScrim
    ? 'text-scrim-foreground/90'
    : 'text-muted-foreground';
  const accentClass = onScrim ? 'text-scrim-foreground' : 'text-primary';

  return (
    <>
      {meta.reactions !== undefined ? (
        <span
          data-slot="article-card-meta-reactions"
          data-testid={`${testId}-meta-reactions`}
          className={cn(baseChip, colorClass)}
          title="Reactions"
        >
          <Heart className="h-3.5 w-3.5" aria-hidden />
          {meta.reactions}
        </span>
      ) : null}
      {meta.comments !== undefined ? (
        <span
          data-slot="article-card-meta-comments"
          data-testid={`${testId}-meta-comments`}
          className={cn(baseChip, colorClass)}
          title="Comments"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          {meta.comments}
        </span>
      ) : null}
      {meta.readingTimeMinutes !== undefined ? (
        <span
          data-slot="article-card-meta-reading-time"
          data-testid={`${testId}-meta-reading-time`}
          className={cn(baseChip, colorClass)}
          title="Reading time"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {meta.readingTimeMinutes} min
        </span>
      ) : null}
      {meta.views !== undefined ? (
        <span
          data-slot="article-card-meta-views"
          data-testid={`${testId}-meta-views`}
          className={cn(baseChip, 'font-medium', accentClass)}
          title="Views"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {formatViews(meta.views)}
        </span>
      ) : null}
    </>
  );
}

function StackBody({
  title,
  description,
  imageUrl,
  visibleTags,
  overflowTags,
  author,
  publishedAt,
  meta,
  sourceLabel,
  priority = false,
  testId,
}: BodyProps) {
  return (
    <>
      {/* Cover (or gradient title fallback) — edge-to-edge top of the card.
          The fixed `h-44` is the CLS reservation: the tile holds its shape
          before the image decodes (R23). */}
      <div className="relative h-44 w-full shrink-0 overflow-hidden">
        <CoverImage imageUrl={imageUrl} title={title} priority={priority} />
        {sourceLabel ? <SourceChip label={sourceLabel} testId={testId} /> : null}
      </div>

      {(author || publishedAt) && (
        <CardHeader data-slot="article-card-byline" className="pt-4 pb-3">
          <div className="flex w-full items-center justify-between gap-2 min-w-0">
            {author ? (
              <div className="flex items-center gap-2 min-w-0">
                {author.imageUrl ? (
                  <img
                    src={author.imageUrl}
                    alt={author.name}
                    width={24}
                    height={24}
                    loading="lazy"
                    decoding="async"
                    className="border-border h-6 w-6 shrink-0 rounded-full border"
                  />
                ) : null}
                <span className="text-foreground truncate text-sm font-medium">
                  {author.name}
                </span>
              </div>
            ) : (
              <span />
            )}
            {publishedAt ? (
              <span className="text-muted-foreground text-xs whitespace-nowrap shrink-0">
                {formatDate(publishedAt)}
              </span>
            ) : null}
          </div>
        </CardHeader>
      )}

      {/* Content order (top → bottom): title, description, tags.
          Tags after description per top-1% blog-card convention — the
          reader's eye lands on the headline first, not on metadata. */}
      <CardContent className="flex grow flex-col gap-2 pt-0">
        <CardTitle
          data-slot="article-card-title"
          data-testid={`${testId}-title`}
          className="group-hover:text-primary line-clamp-2 text-base font-semibold leading-snug transition-colors"
        >
          {title}
        </CardTitle>

        {description ? (
          <CardDescription
            data-slot="article-card-description"
            data-testid={`${testId}-description`}
            className="line-clamp-2 text-ui leading-relaxed"
          >
            {description}
          </CardDescription>
        ) : null}

        {visibleTags.length > 0 ? (
          <div
            data-slot="article-card-tags"
            data-testid={`${testId}-tags`}
            className="mt-auto flex flex-wrap gap-1.5 pt-2"
          >
            {visibleTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="px-2 py-0.5 text-caption font-medium tracking-normal whitespace-nowrap"
              >
                #{tag}
              </Badge>
            ))}
            {overflowTags > 0 ? (
              <Badge
                variant="outline"
                className="px-1.5 py-0.5 text-caption font-medium whitespace-nowrap"
              >
                +{overflowTags}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      {meta ? (
        <CardFooter
          data-slot="article-card-meta"
          className="text-muted-foreground mt-2 gap-4 border-t border-border pt-3"
        >
          <MetaChips meta={meta} tone="muted" testId={testId} />
          <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
            <ExternalLink className="text-primary h-4 w-4" aria-hidden />
          </span>
        </CardFooter>
      ) : null}
    </>
  );
}

function OverlayBody({
  title,
  description,
  imageUrl,
  visibleTags,
  overflowTags,
  author,
  publishedAt,
  meta,
  sourceLabel,
  priority = false,
  testId,
}: BodyProps) {
  return (
    <>
      {/* Cover fills the entire card. Image lives in an absolute layer so a
          dark gradient scrim can sit between it and the text — that scrim is
          what guarantees WCAG-AA contrast over arbitrary covers. */}
      <div className="absolute inset-0 overflow-hidden">
        <CoverImage
          imageUrl={imageUrl}
          title={title}
          fallbackTextClassName="text-2xl"
          priority={priority}
        />
      </div>
      {/* Scrim — opacity stack tuned so titles + meta on top read clean over
          any cover, including light or busy images. Rides `--scrim` so the
          wash is a brand-forkable token, not a `bg-black/85` escape. */}
      <div
        aria-hidden
        data-slot="article-card-scrim"
        className="absolute inset-0 bg-linear-to-t from-scrim/85 via-scrim/55 to-scrim/15"
      />

      <FeaturedChip testId={testId} />
      {sourceLabel ? <SourceChip label={sourceLabel} testId={testId} /> : null}

      <div className="absolute inset-x-0 bottom-0 z-10 p-md md:p-lg">
        {visibleTags.length > 0 ? (
          <div
            data-slot="article-card-tags"
            data-testid={`${testId}-tags`}
            className="mb-4 flex flex-wrap gap-1.5"
          >
            {visibleTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-scrim-foreground/15 text-scrim-foreground border border-scrim-foreground/30 backdrop-blur-sm px-2.5 py-0.5 text-caption font-medium tracking-normal whitespace-nowrap hover:bg-scrim-foreground/25"
              >
                #{tag}
              </Badge>
            ))}
            {overflowTags > 0 ? (
              <Badge
                variant="outline"
                className="bg-scrim-foreground/10 text-scrim-foreground border-scrim-foreground/30 backdrop-blur-sm px-1.5 py-0.5 text-caption font-medium whitespace-nowrap"
              >
                +{overflowTags}
              </Badge>
            ) : null}
          </div>
        ) : null}

        {/* h2 (not h3) so the heading hierarchy from a page-level h1 →
            article card title increases by exactly one level. axe's
            `heading-order` rule flags h1→h3 jumps on the /articles route
            and in isolated Storybook scans. The visual size (text-2xl/3xl)
            is preserved via class names, decoupled from semantic level. */}
        <h2
          data-slot="article-card-title"
          data-testid={`${testId}-title`}
          className="line-clamp-2 text-2xl md:text-3xl font-bold leading-tight text-scrim-foreground mb-2 drop-shadow"
        >
          {title}
        </h2>

        {description ? (
          <p
            data-slot="article-card-description"
            data-testid={`${testId}-description`}
            className="line-clamp-2 text-ui md:text-base text-scrim-foreground/90 mb-4 max-w-prose drop-shadow"
          >
            {description}
          </p>
        ) : null}

        <div
          data-slot="article-card-meta"
          className="flex flex-wrap items-center gap-3 md:gap-4 text-scrim-foreground/90 text-ui"
        >
          {author ? (
            <div className="flex items-center gap-2 min-w-0">
              {author.imageUrl ? (
                <img
                  src={author.imageUrl}
                  alt={author.name}
                  width={32}
                  height={32}
                  loading="lazy"
                  decoding="async"
                  className="h-8 w-8 shrink-0 rounded-full border-2 border-scrim-foreground/60"
                />
              ) : null}
              <span className="truncate font-medium text-scrim-foreground">
                {author.name}
              </span>
            </div>
          ) : null}
          {publishedAt ? (
            <>
              <span aria-hidden className="hidden sm:inline text-scrim-foreground/40">•</span>
              <span className="hidden sm:inline whitespace-nowrap text-scrim-foreground/80">
                {formatDate(publishedAt)}
              </span>
            </>
          ) : null}
          {meta ? (
            <>
              <span aria-hidden className="hidden sm:inline text-scrim-foreground/40">•</span>
              <div className="hidden sm:flex items-center gap-3 md:gap-4">
                <MetaChips meta={meta} tone="scrim" testId={testId} />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <span className="absolute top-3 right-14 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <ExternalLink className="h-5 w-5 text-scrim-foreground drop-shadow" aria-hidden />
      </span>
    </>
  );
}
