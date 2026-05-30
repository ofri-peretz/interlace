/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Source: apps/interlace-docs-baseline/ in the agents repo.
 * Edit there, then run `npm run sync` to redistribute.
 * Local edits will be overwritten on next sync (or refused without --force).
 */
import * as React from "react";
import { cn } from "../../lib/utils";
import { NumberTicker } from "../ui/number-ticker";
import { Sparkline } from "./sparkline";
import type {
  RatchetBreakdownRow,
  RatchetDeltaRow,
  RatchetTrendRow,
} from "./types";

export interface RatchetCardProps extends React.ComponentProps<"article"> {
  row: RatchetBreakdownRow;
  /** Optional delta row matched by kind. Renders the "+X / 30d" badge. */
  delta?: RatchetDeltaRow | null;
  /** Optional trend row — renders ▲ / ▼ / • signal in the corner. */
  trend?: RatchetTrendRow | null;
  /** Optional sparkline series, oldest first (~30–90 points). */
  history?: ReadonlyArray<number>;
  /** Icon to render inline with the label (consumer passes a lucide-react icon node). */
  icon?: React.ReactNode;
}

// The card value is rendered by `<NumberTicker notation="compact"
// compactThreshold={10_000} />`, which handles formatting internally.
// `formatDelta` below is a server-rendered string and stays inline —
// no RSC boundary issue there.
const numberFormat = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatDelta(n: number): string {
  const abs = Math.abs(n);
  const formatted =
    abs >= 10_000 ? compactFormat.format(abs) : numberFormat.format(abs);
  if (n > 0) return `▲ +${formatted}`;
  if (n < 0) return `▼ -${formatted}`;
  return `• 0`;
}

function deltaToneClass(n: number): string {
  if (n > 0) return "text-emerald-700 dark:text-emerald-400";
  if (n < 0) return "text-amber-800 dark:text-amber-400";
  return "text-muted-foreground";
}

function trendBadge(trend?: RatchetTrendRow | null): React.ReactNode {
  if (!trend || trend.trend === "unknown") return null;
  const tone =
    trend.trend === "rising"
      ? "text-emerald-700 dark:text-emerald-400"
      : trend.trend === "cooling"
        ? "text-amber-800 dark:text-amber-400"
        : "text-muted-foreground";
  const glyph =
    trend.trend === "rising" ? "🔥" : trend.trend === "cooling" ? "💤" : "•";
  const pct =
    trend.momentum_pct != null ? ` ${Math.round(trend.momentum_pct)}%` : "";
  return (
    <span
      data-slot="ratchet-card-trend"
      className={cn("text-xs font-medium", tone)}
      title={`7-day vs 30-day SMA crossover: ${trend.trend}`}
    >
      {glyph}
      {pct}
    </span>
  );
}

/**
 * One card per ratchet kind. Shape: icon + label across the top, big value,
 * delta badge, optional sparkline, description, source link.
 *
 * The whole card is a single <a> link to `row.provenance_url` (the canonical
 * source for that metric — npm, GitHub, Codecov, dev.to). Wrapping the whole
 * card gives a bigger hit area and clearer affordance than the inline-link
 * version. The visible "source ↗" glyph stays as a non-interactive <span>
 * (nested <a>s are invalid HTML).
 *
 * Slot heights are stabilized so cards in the same grid row align visually:
 * the trend-badge slot always exists (placeholder when absent), the delta
 * line always reserves one line of height, and the description is clamped to
 * exactly two lines via `line-clamp-2 min-h-[2.5rem]`. Without these slots
 * the value rows ("830", "64", "216") landed at different y-positions
 * because each card had a different mix of trend / delta / description
 * length.
 *
 * Pure presentational — accepts data via props so it renders identically in
 * Storybook fixtures and Server Component pages.
 */
export function RatchetCard({
  row,
  delta,
  trend,
  history,
  icon,
  className,
  ...rest
}: RatchetCardProps) {
  const containerClasses = cn(
    // Layout
    "group relative flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm",
    // Subtle hover lift — reduced-motion users get no transform.
    "motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200 motion-safe:ease-out",
    "hover:-translate-y-0.5 hover:shadow-lg hover:border-foreground/15 motion-reduce:hover:shadow-md",
    // Keyboard focus ring — applies on the link element when card is the link.
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    className,
  );

  const inner = (
    <>
      <header className="flex items-start justify-between gap-3 min-h-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon ? (
            <span aria-hidden className="text-foreground/80">
              {icon}
            </span>
          ) : null}
          <span className="text-sm font-medium">{row.display_label}</span>
        </div>
        {trendBadge(trend) ?? (
          <span aria-hidden className="text-xs">
            &nbsp;
          </span>
        )}
      </header>

      <div className="flex items-baseline gap-3">
        <NumberTicker
          data-slot="ratchet-card-value"
          value={row.current_value}
          startValue={0}
          notation="compact"
          compactThreshold={10_000}
          duration={1800}
          className={cn(
            "font-mono text-3xl font-semibold tabular-nums tracking-tight",
            "motion-safe:transition-colors motion-safe:duration-200",
            "group-hover:text-foreground",
          )}
        />
        {row.display_unit && (
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {row.display_unit}
          </span>
        )}
      </div>

      <div className="flex min-h-5 items-center gap-2 text-sm">
        {delta ? (
          <>
            <span className={cn("font-medium", deltaToneClass(delta.delta_30d))}>
              {formatDelta(delta.delta_30d)}
            </span>
            {delta.growth_pct_30d != null && (
              <span className="text-muted-foreground">
                ({delta.growth_pct_30d > 0 ? "+" : ""}
                {delta.growth_pct_30d}%)
              </span>
            )}
            <span className="text-xs text-muted-foreground">/ 30d</span>
          </>
        ) : (
          <span aria-hidden>&nbsp;</span>
        )}
      </div>

      {history && history.length >= 2 && (
        <Sparkline
          data={history}
          className="text-foreground/40"
          filled
          aria-label={`${row.display_label} trend`}
        />
      )}

      <p
        className={cn(
          "text-xs leading-relaxed text-muted-foreground",
          "line-clamp-2 min-h-[2.5rem]",
        )}
      >
        {row.description ?? <span aria-hidden>&nbsp;</span>}
      </p>

      {row.provenance_url && (
        <span
          data-slot="ratchet-card-provenance"
          className={cn(
            "mt-auto inline-flex items-center gap-1 self-start text-xs font-medium",
            "text-muted-foreground",
            "motion-safe:transition-colors motion-safe:duration-150",
            "group-hover:text-foreground",
          )}
        >
          <span>source</span>
          <span
            aria-hidden
            className="motion-safe:transition-transform motion-safe:duration-150 group-hover:translate-x-0.5"
          >
            ↗
          </span>
        </span>
      )}
    </>
  );

  // Whole card is the link when provenance_url is present (the normal case).
  // Defensive: when absent (unexpected for a published row), render a plain
  // <article> so the page still functions and the missing-link case is
  // obvious in the DOM (no anchor wrapping the card).
  if (row.provenance_url) {
    return (
      <a
        data-slot="ratchet-card"
        data-kind={row.kind}
        data-bucket={row.bucket}
        href={row.provenance_url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${row.display_label} — open source ↗`}
        className={containerClasses}
      >
        {inner}
      </a>
    );
  }

  return (
    <article
      data-slot="ratchet-card"
      data-kind={row.kind}
      data-bucket={row.bucket}
      className={containerClasses}
      {...rest}
    >
      {inner}
    </article>
  );
}
