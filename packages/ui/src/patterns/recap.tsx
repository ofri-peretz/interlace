/**
 * @interlace/ui — Recap
 *
 * What one person takes home from a session: what it covered, how they did,
 * the one thing they picked for this week, what they asked to hear more
 * about, and where to go next. Every section is optional and shows only
 * when it has something in it, in the order a person reads a recap: what
 * happened, what it means for them, what to do now.
 *
 * Pair it with `patterns/recap-model` to put the per-person part in the
 * link itself (`encodeRecap` / `decodeRecap`), so a recap page needs no
 * account and stores nothing.
 *
 * ## Anatomy
 *
 *   Recap                          (article — data-slot="recap")
 *     ├─ header                    (data-slot="recap-header": title as h1|h2, meta line)
 *     ├─ section?                  (data-slot="recap-covered": a checked list)
 *     ├─ section?                  (data-slot="recap-stats": dl of label and value)
 *     ├─ section?                  (data-slot="recap-commitment": the pick, as a quote)
 *     ├─ section?                  (data-slot="recap-interests": a list of topics)
 *     ├─ section?                  (data-slot="recap-next": links, each with a line)
 *     └─ footer?                   (data-slot="recap-footer")
 *
 * ## Motion
 *
 * None. A recap is read, often later, often on a phone.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Stats sit two to a row, four from 36rem of the recap's own width.
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'article'>`                    |
 * | R6   | data-slot per part        | recap-*                                              |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | one heading per section, in order; real lists        |
 */

import * as React from 'react';
import { ArrowRight, Check } from 'lucide-react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

interface RecapStat {
  label: React.ReactNode;
  value: React.ReactNode;
}

interface RecapLink {
  label: React.ReactNode;
  href: string;
  /** One line on what is there. */
  description?: React.ReactNode;
}

interface RecapLabels {
  /** @default 'What we covered' */
  covered?: string;
  /** @default 'Your session' */
  stats?: string;
  /** @default 'Your one thing this week' */
  commitment?: string;
  /** @default 'You asked for more on' */
  interests?: string;
  /** @default 'Keep going' */
  next?: string;
}

type RecapProps = Omit<React.ComponentProps<'article'>, 'children' | 'title'> & {
  title: React.ReactNode;
  /** Under the title: the date, the place, who ran it. */
  meta?: React.ReactNode;
  covered?: readonly React.ReactNode[];
  stats?: readonly RecapStat[];
  commitment?: React.ReactNode;
  interests?: readonly React.ReactNode[];
  next?: readonly RecapLink[];
  footer?: React.ReactNode;
  /** The title's level; sections take the next one down. @default 'h1' */
  titleAs?: 'h1' | 'h2';
  labels?: RecapLabels;
};

function RecapSection({
  slot,
  title,
  as: Heading,
  children,
}: {
  slot: string;
  title: string;
  as: 'h2' | 'h3';
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <section data-slot={slot} aria-labelledby={id} className="grid gap-3 border-t pt-6">
      <Heading id={id} className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
        {title}
      </Heading>
      {children}
    </section>
  );
}

function Recap({
  title,
  meta,
  covered,
  stats,
  commitment,
  interests,
  next,
  footer,
  titleAs: Title = 'h1',
  labels,
  className,
  ...props
}: RecapProps) {
  const section = Title === 'h1' ? 'h2' : 'h3';
  return (
    <article
      data-slot="recap"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container grid gap-6', className)}
      {...props}
    >
      <header data-slot="recap-header" className="grid gap-2">
        <Title className="font-heading text-h2 font-semibold text-balance">{title}</Title>
        {meta ? <p className="text-muted-foreground">{meta}</p> : null}
      </header>

      {covered?.length ? (
        <RecapSection slot="recap-covered" title={labels?.covered ?? 'What we covered'} as={section}>
          <ul className="grid gap-2">
            {covered.map((c, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check aria-hidden="true" className="text-primary mt-1 size-4 shrink-0" />
                <span className="text-pretty">{c}</span>
              </li>
            ))}
          </ul>
        </RecapSection>
      ) : null}

      {stats?.length ? (
        <RecapSection slot="recap-stats" title={labels?.stats ?? 'Your session'} as={section}>
          <dl className="grid grid-cols-2 gap-4 @xl:grid-cols-4">
            {stats.map((s, i) => (
              <div key={i} className="grid gap-1">
                <dt className="text-muted-foreground text-sm">{s.label}</dt>
                <dd className="font-heading text-2xl font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </RecapSection>
      ) : null}

      {commitment ? (
        <RecapSection slot="recap-commitment" title={labels?.commitment ?? 'Your one thing this week'} as={section}>
          <p className="border-primary border-s-2 ps-4 text-lg font-medium text-pretty">{commitment}</p>
        </RecapSection>
      ) : null}

      {interests?.length ? (
        <RecapSection slot="recap-interests" title={labels?.interests ?? 'You asked for more on'} as={section}>
          <ul className="flex flex-wrap gap-2">
            {interests.map((t, i) => (
              <li key={i} className="bg-muted rounded-full px-3 py-1 text-sm">
                {t}
              </li>
            ))}
          </ul>
        </RecapSection>
      ) : null}

      {next?.length ? (
        <RecapSection slot="recap-next" title={labels?.next ?? 'Keep going'} as={section}>
          <ul className="grid gap-3">
            {next.map((l, i) => (
              <li key={i}>
                <a
                  href={l.href}
                  className="group focus-visible:outline-ring grid gap-0.5 rounded-sm outline-offset-4 focus-visible:outline-2"
                >
                  <span className="text-primary inline-flex items-center gap-1.5 font-medium underline-offset-4 group-hover:underline">
                    {l.label}
                    <ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                  </span>
                  {l.description ? <span className="text-muted-foreground text-sm">{l.description}</span> : null}
                </a>
              </li>
            ))}
          </ul>
        </RecapSection>
      ) : null}

      {footer ? (
        <footer data-slot="recap-footer" className="text-muted-foreground border-t pt-6 text-sm">
          {footer}
        </footer>
      ) : null}
    </article>
  );
}
Recap.displayName = 'Recap';

export { Recap };
export type { RecapProps, RecapStat, RecapLink, RecapLabels };
