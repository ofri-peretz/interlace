/**
 * @interlace/ui — Timeline
 *
 * A short record in date order: each event has a date, a title, what was
 * said or done, and where that comes from. In a wide column the events sit
 * side by side on a horizontal rule; in a narrow one they stack down a
 * vertical rule. The switch keys on the timeline's own width (a container
 * query), not the viewport, so it is right in a sidebar too.
 *
 * For a dense, filterable map of many dated items, use `TimelineMap`. This
 * one is for a handful of events a reader reads in full.
 *
 * ## Orientation
 *
 * | `orientation` | Layout                                                 |
 * | ------------- | ------------------------------------------------------ |
 * | `responsive`  | Vertical, then rows once the timeline is 48rem wide    |
 * | `vertical`    | Always vertical                                         |
 *
 * There is no always-horizontal option: six columns at 320px cannot be read.
 * Nor does a wide timeline squeeze every event into one row: each column is
 * at least 13rem, so seven events in a 64rem column sit four and three, each
 * row on its own rule, instead of seven cramped strips.
 *
 * ## Markers
 *
 * `marker="accent"` fills one event's dot in the highlight colour. The dot is
 * decoration: say in the title or the text why that event stands out.
 *
 * ## Anatomy
 *
 *   Timeline                    (div — data-slot="timeline", the size container)
 *     └─ ol                     (data-slot="timeline-list", data-orientation; the vertical rule is its ::before)
 *         └─ TimelineItem × n   (li — data-marker; in rows, each draws its stretch of rule as ::after)
 *             ├─ dot            (span, aria-hidden)
 *             ├─ date           (p — large, in the heading font)
 *             ├─ title          (p — bold)
 *             ├─ children       (div — the quote or the event in words)
 *             └─ source         (p — small, muted)
 *
 * ## MIN_VIEWPORT — 320
 *
 * Vertical below 48rem of its own width; text wraps.
 *
 * | Rule | Concept                 | Where in this file                                          |
 * | ---- | ----------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el       | `ol` / `li` props                                           |
 * | R6   | data-slot per part      | timeline / -list / -item / -dot / -date / -title / -body / -source |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                           |
 * | R8   | Enums, not booleans     | `orientation`, `marker`                                     |
 * | R14  | Declares min viewport   | `data-min-viewport` on the root + exported const            |
 * | R19  | Tokens only             | `border-primary`, `bg-background`, `bg-highlight`           |
 * | R25  | Server component        | No hooks; the layout is container queries in CSS            |
 * | R26  | A11y from native el     | An ordered list in date order; the dot is hidden            |
 */

import * as React from "react";

import { cn } from "../lib/cn.js";

export const MIN_VIEWPORT = 320 as const;

export type TimelineOrientation = "responsive" | "vertical";
export type TimelineMarker = "default" | "accent";

type TimelineProps = React.ComponentProps<"ol"> & {
  /** Rows in a wide column (each column at least 13rem), or always stacked. @default 'responsive' */
  orientation?: TimelineOrientation;
};

/*
 * Every horizontal rule below is `@3xl/timeline:`. Only a responsive
 * timeline names its wrapper `timeline` as a container, so a vertical one
 * never matches them and needs no classes of its own.
 */
function Timeline({
  orientation = "responsive",
  className,
  ...props
}: TimelineProps) {
  return (
    <div
      data-slot="timeline"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(orientation === "responsive" && "@container/timeline")}
    >
      <ol
        data-slot="timeline-list"
        data-orientation={orientation}
        className={cn(
          "relative grid gap-1.5",
          // The rule: down the dots' centre line, then across it.
          "before:border-primary before:absolute before:inset-y-0 before:start-2 before:border-s-[3px] before:content-['']",
          // Rows of columns at least 13rem wide, wrapping when more do not fit.
          // Each item draws its own stretch of the rule, so a wrapped row has
          // one too; the stretch into the gap is clipped at the row's edge.
          "@3xl/timeline:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] @3xl/timeline:gap-x-4 @3xl/timeline:gap-y-8",
          "@3xl/timeline:overflow-x-clip @3xl/timeline:before:hidden",
          className,
        )}
        {...props}
      />
    </div>
  );
}

const DOT: Record<TimelineMarker, string> = {
  default: "border-primary bg-background",
  accent: "border-highlight bg-highlight",
};

type TimelineItemProps = Omit<React.ComponentProps<"li">, "title"> & {
  /** When it happened: "1968", or a `<time>`. Always shown. */
  date: React.ReactNode;
  /** Who or what: "Council vote". */
  title?: React.ReactNode;
  /** Where the words come from: "City archive, minutes". */
  source?: React.ReactNode;
  /** The dot. `accent` marks the one event the page is about. @default 'default' */
  marker?: TimelineMarker;
};

function TimelineItem({
  date,
  title,
  source,
  marker = "default",
  className,
  children,
  ...props
}: TimelineItemProps) {
  return (
    <li
      data-slot="timeline-item"
      data-marker={marker}
      className={cn(
        "relative min-w-0 ps-9 pb-5",
        "@3xl/timeline:ps-0 @3xl/timeline:pt-10 @3xl/timeline:pb-0",
        // This item's stretch of the rule, reaching across the gap to the next.
        "@3xl/timeline:after:border-primary @3xl/timeline:after:absolute @3xl/timeline:after:start-0 @3xl/timeline:after:-end-4 @3xl/timeline:after:top-[0.9375rem] @3xl/timeline:after:border-t-[3px] @3xl/timeline:after:content-['']",
        "@3xl/timeline:last:after:end-0",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        data-slot="timeline-dot"
        className={cn(
          "absolute start-px top-1 z-raised size-[1.125rem] rounded-full border-4",
          "@3xl/timeline:top-[0.4375rem] @3xl/timeline:start-0",
          DOT[marker],
        )}
      />
      <p
        data-slot="timeline-date"
        className="font-heading text-primary text-2xl leading-none font-extrabold"
      >
        {date}
      </p>
      {title ? (
        <p data-slot="timeline-title" className="mt-1.5 text-sm font-bold">
          {title}
        </p>
      ) : null}
      {children ? (
        <div
          data-slot="timeline-body"
          className="text-foreground mt-2 text-sm leading-relaxed"
        >
          {children}
        </div>
      ) : null}
      {source ? (
        <p
          data-slot="timeline-source"
          className="text-muted-foreground mt-2 text-xs"
        >
          {source}
        </p>
      ) : null}
    </li>
  );
}

const TimelineWithItem = Object.assign(Timeline, { Item: TimelineItem });

export { TimelineWithItem as Timeline, TimelineItem };
export type { TimelineProps, TimelineItemProps };
