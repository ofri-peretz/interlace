/**
 * @interlace/ui — patterns/update-feed-model
 *
 * The arithmetic under an `UpdateFeed`: newest first, grouped by day or by
 * month, and which entries arrived since the reader last looked. Pure, so a
 * server can build the same groups, an RSS file can use the same order, and
 * an app badge can count the same "new" the page marks.
 *
 * ## Dates
 *
 * An entry's `date` is an ISO calendar date, `"2026-11-24"`, or a full ISO
 * timestamp. Grouping reads the first ten characters, so it never shifts a
 * day with the reader's time zone. Order is by the full string, then by
 * `id`, so two entries on one day keep a stable order on every device.
 *
 * ## New since
 *
 * `since` is the moment the reader last saw the feed, as an ISO string or a
 * day key. An entry is new when its `date` sorts after `since`. With no
 * `since` (a first visit) nothing is marked: everything is new, which says
 * nothing.
 */

export interface UpdateFeedEntry {
  /** Stable id: a key, and the tie-break for entries with the same date. */
  id: string;
  /** ISO date or timestamp. */
  date: string;
}

export interface UpdateGroup<T extends UpdateFeedEntry> {
  /** `YYYY-MM-DD` for a day, `YYYY-MM` for a month. */
  key: string;
  entries: T[];
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/** Newest first, ties by id. Entries without a readable date go last. */
export function sortUpdates<T extends UpdateFeedEntry>(entries: readonly T[]): T[] {
  return entries
    .slice()
    .sort((a, b) => {
      const ra = ISO_DAY.test(a.date);
      const rb = ISO_DAY.test(b.date);
      if (ra !== rb) return ra ? -1 : 1;
      return a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/** Newest group first; inside a group, newest entry first. */
export function groupUpdates<T extends UpdateFeedEntry>(
  entries: readonly T[],
  by: 'day' | 'month' = 'day',
): UpdateGroup<T>[] {
  const groups: UpdateGroup<T>[] = [];
  for (const entry of sortUpdates(entries)) {
    if (!ISO_DAY.test(entry.date)) continue;
    const key = entry.date.slice(0, by === 'day' ? 10 : 7);
    const last = groups.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else groups.push({ key, entries: [entry] });
  }
  return groups;
}

/** True when `entry` arrived after `since`. False on a first visit (no `since`). */
export function isNewSince(entry: UpdateFeedEntry, since: string | null | undefined): boolean {
  if (!since || !ISO_DAY.test(since) || !ISO_DAY.test(entry.date)) return false;
  return entry.date > since;
}

/** How many entries arrived after `since`: the number for a badge. */
export function countNewSince(
  entries: readonly UpdateFeedEntry[],
  since: string | null | undefined,
): number {
  return entries.reduce((n, e) => n + (isNewSince(e, since) ? 1 : 0), 0);
}
