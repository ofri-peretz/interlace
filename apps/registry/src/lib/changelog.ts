import changelogData from '../../public/data/changelog.json';

/**
 * Public release notes — ONE source, TWO views.
 *
 * `scripts/build-changelog.mjs` compiles `packages/ui/CHANGELOG.md` (released)
 * plus the pending `.changeset/*.md` (unreleased) into
 * `public/data/changelog.json`. This module is the only reader, and both views
 * come out of it:
 *
 *   - `/changelog`            → `releases()`             (everything, newest first)
 *   - `/c/<name>` § History   → `historyFor(name)`       (the subset naming it)
 *
 * A second hand-written "what changed in badge" list would be a second source
 * that starts lying the first time someone forgets it, so there isn't one.
 */

export type ChangeKind = 'Breaking' | 'Added' | 'Changed';

export type ChangelogEntry = {
  kind: ChangeKind;
  bump: 'major' | 'minor' | 'patch';
  summary: string;
  /** Registry item names this entry touched — links to `/c/<name>`. */
  components: string[];
  /** Present on every breaking entry; the build refuses to ship one without. */
  migration: string | null;
  /** Where the note was authored — `CHANGELOG.md#1.0.0` or `.changeset/<id>`. */
  source: string;
};

export type ChangelogRelease = {
  /** A semver string, or `Unreleased` for the notes not yet cut into a release. */
  version: string;
  unreleased: boolean;
  entries: ChangelogEntry[];
};

const DATA = changelogData as { releases: ChangelogRelease[] };

/** Every release, newest first — unreleased notes lead when there are any. */
export const releases = (): ChangelogRelease[] => DATA.releases;

/** URL fragment for a release heading, stable enough to link at from anywhere. */
export const releaseAnchor = (version: string): string =>
  version === 'Unreleased' ? 'unreleased' : `v${version}`;

/**
 * The releases that touched one component, newest first, with every entry that
 * does NOT name it filtered out — so a component page shows its own history
 * rather than the DS's.
 */
export const historyFor = (
  name: string,
): { version: string; unreleased: boolean; entries: ChangelogEntry[] }[] =>
  DATA.releases
    .map((release) => ({
      version: release.version,
      unreleased: release.unreleased,
      entries: release.entries.filter((e) => e.components.includes(name)),
    }))
    .filter((release) => release.entries.length > 0);

export const KIND_ORDER: ChangeKind[] = ['Breaking', 'Added', 'Changed'];

/**
 * Kind → brand token pair. Breaking is the only one that gets the destructive
 * token: it is the only kind a reader must act on, and colour is the cheapest
 * way to make "you have work to do" survive a skim. No new colours — these are
 * the theme's own semantic tokens.
 */
export const KIND_CLASS: Record<ChangeKind, string> = {
  Breaking: 'border-destructive/40 bg-destructive/10 text-destructive',
  Added: 'border-primary/40 bg-primary/10 text-primary',
  Changed: 'border-border bg-muted text-muted-foreground',
};
