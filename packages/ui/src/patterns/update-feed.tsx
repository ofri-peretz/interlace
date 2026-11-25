/**
 * @interlace/ui — UpdateFeed
 *
 * What is new, newest first: a product's changelog, a publication's latest
 * pieces, a team's releases. Entries are grouped under their day or month,
 * each with a kind ("Release", "Article"), a title that links to the thing
 * itself and a line on what it is. Pass `since`, the moment the reader last
 * looked, and the entries that arrived after it carry a "New" tag and the
 * feed opens with how many there are: a reason to come back, said once.
 *
 * ## Anatomy
 *
 *   UpdateFeed                      (div — data-slot="update-feed", @container)
 *     ├─ p                          (data-slot="update-feed-summary": "3 new since your last visit", only with new entries)
 *     ├─ section × groups           (data-slot="update-feed-group", labelled by its heading)
 *     │   ├─ h2                     (data-slot="update-feed-date": a real <time>)
 *     │   └─ ol                     (data-slot="update-feed-list")
 *     │       └─ li                 (data-slot="update-feed-entry", data-new when new)
 *     │           ├─ p              (data-slot="update-feed-kind": kind + "New" tag)
 *     │           ├─ h3 > a         (data-slot="update-feed-title")
 *     │           └─ p              (data-slot="update-feed-description")
 *     └─ p                          (data-slot="update-feed-empty", only with no entries)
 *
 * ## Layout
 *
 * In a narrow column the date heads its group. Once the feed itself is
 * 42rem wide (a container query, so it works in a sidebar too) the date
 * moves to a rail on the start side and the entries read beside it.
 *
 * ## Links
 *
 * Titles are plain `<a href>`. A framework router passes `renderLink`, which
 * gets the href, the class and the children, and returns its own link.
 *
 * ## Dates and the server
 *
 * Dates format through `Intl.DateTimeFormat` in UTC, so a day key reads as
 * the same day on the server and in every time zone. `since` usually lives
 * in the browser (local storage), so a server render passes none and the
 * client adds the tags after it reads it: the entries never move, only the
 * tags appear.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                     |
 * | ---- | ------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                          |
 * | R6   | data-slot per part        | update-feed / -summary / -group / -date / -list / -entry / -kind / -title / -description / -empty |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                      |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                   |
 * | R19  | Tokens only               | primary, border, muted-foreground, foreground, ring    |
 * | R26  | A11y                      | groups labelled by real <time> headings; "New" in words, not colour |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { groupUpdates, isNewSince, type UpdateFeedEntry } from './update-feed-model.js';

export const MIN_VIEWPORT = 320 as const;

interface UpdateFeedItem extends UpdateFeedEntry {
  title: React.ReactNode;
  href?: string;
  /** A short label for what kind of update it is. */
  kind?: React.ReactNode;
  description?: React.ReactNode;
}

interface UpdateFeedLinkProps {
  href: string;
  className: string;
  children: React.ReactNode;
  'data-slot': string;
}

interface UpdateFeedLabels {
  /** @default 'New' */
  new?: string;
  /** @default n => `${n} new since your last visit` (n is formatted) */
  newSince?: (n: string, count: number) => string;
  /** @default 'Nothing here yet.' */
  empty?: string;
}

type UpdateFeedProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  entries: readonly UpdateFeedItem[];
  /** Group under each day or each month. @default 'day' */
  groupBy?: 'day' | 'month';
  /** When the reader last looked (ISO string or day key). Entries after it are tagged new. */
  since?: string | null;
  /** The level of the date headings; entry titles sit one below. @default 2 */
  headingLevel?: 2 | 3;
  renderLink?: (props: UpdateFeedLinkProps) => React.ReactNode;
  locale?: string;
  labels?: UpdateFeedLabels;
};

const toDate = (key: string) => new Date(`${key.length === 7 ? `${key}-01` : key}T00:00:00Z`);

function UpdateFeed({
  entries,
  groupBy = 'day',
  since,
  headingLevel = 2,
  renderLink,
  locale,
  labels,
  className,
  ...props
}: UpdateFeedProps) {
  const groups = React.useMemo(() => groupUpdates(entries, groupBy), [entries, groupBy]);
  const baseId = React.useId();
  const nf = new Intl.NumberFormat(locale);
  const dateFormat = new Intl.DateTimeFormat(
    locale,
    groupBy === 'day'
      ? { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }
      : { year: 'numeric', month: 'long', timeZone: 'UTC' },
  );
  const newCount = entries.reduce((n, e) => n + (isNewSince(e, since) ? 1 : 0), 0);
  const words = {
    new: labels?.new ?? 'New',
    newSince: labels?.newSince ?? ((n: string) => `${n} new since your last visit`),
    empty: labels?.empty ?? 'Nothing here yet.',
  };
  const GroupHeading = `h${headingLevel}` as 'h2' | 'h3';
  const EntryHeading = `h${headingLevel + 1}` as 'h3' | 'h4';
  const titleClass =
    'focus-visible:outline-ring rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2';

  return (
    <div
      data-slot="update-feed"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container grid gap-10', className)}
      {...props}
    >
      {newCount > 0 ? (
        <p data-slot="update-feed-summary" className="text-primary text-sm font-semibold">
          {words.newSince(nf.format(newCount), newCount)}
        </p>
      ) : null}
      {groups.map((group) => {
        const headingId = `${baseId}-${group.key}`;
        return (
          <section
            key={group.key}
            data-slot="update-feed-group"
            aria-labelledby={headingId}
            className="grid gap-4 @2xl:grid-cols-[11rem_1fr] @2xl:gap-8"
          >
            <GroupHeading
              id={headingId}
              data-slot="update-feed-date"
              className="text-muted-foreground text-sm font-medium @2xl:pt-1"
            >
              <time dateTime={group.key}>{dateFormat.format(toDate(group.key))}</time>
            </GroupHeading>
            <ol data-slot="update-feed-list" className="divide-border grid divide-y">
              {group.entries.map((entry) => {
                const isNew = isNewSince(entry, since);
                return (
                  <li
                    key={entry.id}
                    data-slot="update-feed-entry"
                    data-new={isNew ? '' : undefined}
                    className="grid gap-1 py-4 first:pt-0 last:pb-0"
                  >
                    {entry.kind || isNew ? (
                      <p
                        data-slot="update-feed-kind"
                        className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium"
                      >
                        {entry.kind ? <span>{entry.kind}</span> : null}
                        {isNew ? (
                          <span className="text-primary inline-flex items-center gap-1 font-semibold">
                            <span aria-hidden className="bg-primary size-1.5 rounded-full" />
                            {words.new}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    <EntryHeading className="font-heading text-lg leading-snug font-semibold text-balance">
                      {entry.href ? (
                        renderLink ? (
                          renderLink({
                            href: entry.href,
                            className: titleClass,
                            children: entry.title,
                            'data-slot': 'update-feed-title',
                          })
                        ) : (
                          <a href={entry.href} data-slot="update-feed-title" className={titleClass}>
                            {entry.title}
                          </a>
                        )
                      ) : (
                        <span data-slot="update-feed-title">{entry.title}</span>
                      )}
                    </EntryHeading>
                    {entry.description ? (
                      <p data-slot="update-feed-description" className="text-muted-foreground text-sm leading-relaxed">
                        {entry.description}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      {groups.length === 0 ? (
        <p data-slot="update-feed-empty" className="text-muted-foreground text-sm">
          {words.empty}
        </p>
      ) : null}
    </div>
  );
}
UpdateFeed.displayName = 'UpdateFeed';

export { UpdateFeed };
export type { UpdateFeedProps, UpdateFeedItem, UpdateFeedLabels, UpdateFeedLinkProps };
