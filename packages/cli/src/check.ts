/**
 * `interlace-ui check` — decide whether the components you copied still match a release.
 * Pure; no I/O, no process, no network. `index.ts` reads the files and fetches the registry,
 * and hands both to the functions here.
 *
 * ─── What "match" means ───────────────────────────────────────────────────
 *
 * A registry item ships files with a `target` (`components/ui/button.tsx`) and the exact
 * bytes to write there. A file in your project is checked against its item by bytes, after
 * line endings are made the same and nothing else: no trimming, no re-formatting. A file
 * you reformatted is a file you changed.
 *
 * The registry publishes its current release only, so a file that differs is told apart by the
 * version banner every item carries on its first lines (`// @interlace/button v3.4.0 — …`):
 *
 *   match      the bytes equal the current release
 *   behind     the banner names an older release: not checkable byte for byte (only the
 *              current release is published), so it is reported but is not drift
 *   modified   the banner names the current release, or there is none, and the bytes differ:
 *              the file was edited after it was copied
 *   ahead      the banner names a release newer than the registry has: copied from a branch
 *              or a pull request that is not released
 *   missing    the item is installed (one of its files is here) and this file is not
 *
 * Drift is `modified`, `ahead` and `missing`. `behind` is drift only under `--strict`. A file
 * you know is different on purpose goes in the allow list; it is then reported but never fails,
 * and the check says so when an allowed file starts matching a release again.
 */

export type Status = 'match' | 'behind' | 'modified' | 'ahead' | 'missing';

/** One file of a registry item, as the registry publishes it. */
export type ItemFile = { path?: string; target?: string; content?: string };

/** The part of a registry item the check reads. */
export type CheckItem = {
  name: string;
  meta?: { version?: string };
  files?: ItemFile[];
};

/** The `aliases` of a consumer's components.json. */
export type Aliases = Partial<Record<'components' | 'ui' | 'lib' | 'hooks' | 'utils', string>>;

export type Result = {
  /** The path in the project, relative, with forward slashes. */
  file: string;
  /** The registry item that ships it. */
  item: string;
  status: Status;
  /** The version in the file's banner, when it has one. */
  localVersion?: string;
  /** The current release of the item. */
  releasedVersion?: string;
  /** In the allow list. */
  allowed: boolean;
  /** Why it is allowed, when the list says. */
  reason?: string;
};

/** Line endings made the same, nothing else. */
export const normalizeEol = (text: string): string => text.split('\r\n').join('\n').split('\r').join('\n');

const BANNER_LINES = 8;

/**
 * The item name and version in a file's banner: `// @interlace/<name> v<x.y.z> …` on one of the
 * first lines. null for a file without one.
 */
export const parseBanner = (content: string): { name: string; version: string } | null => {
  const lines = content.split('\n', BANNER_LINES);
  for (const line of lines) {
    const at = line.indexOf('@interlace/');
    if (at === -1 || !line.trimStart().startsWith('//')) continue;
    const rest = line.slice(at + '@interlace/'.length).split(' ');
    const name = rest[0] as string;
    const version = (rest[1] ?? '').replace(/^v/, '');
    if (name && /^\d+\.\d+\.\d+$/.test(version)) return { name, version };
  }
  return null;
};

/** -1, 0 or 1 for `a` against `b` as x.y.z. A version that is not x.y.z counts as 0.0.0. */
export const compareVersions = (a: string, b: string): -1 | 0 | 1 => {
  const parts = (v: string) => (/^\d+\.\d+\.\d+$/.test(v) ? v.split('.').map(Number) : [0, 0, 0]);
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i += 1) {
    if (x[i] !== y[i]) return (x[i] as number) < (y[i] as number) ? -1 : 1;
  }
  return 0;
};

/**
 * Which status a file has, given what is there and what the release ships. `local` null: the
 * file is not there. Bytes are compared after `normalizeEol`.
 */
export const classify = (
  local: string | null,
  remote: string,
  releasedVersion: string | undefined,
): { status: Status; localVersion?: string } => {
  if (local === null) return { status: 'missing' };
  if (normalizeEol(local) === normalizeEol(remote)) return { status: 'match' };
  const banner = parseBanner(normalizeEol(local));
  if (!banner || !releasedVersion) return { status: 'modified' };
  const order = compareVersions(banner.version, releasedVersion);
  if (order > 0) return { status: 'ahead', localVersion: banner.version };
  if (order < 0) return { status: 'behind', localVersion: banner.version };
  return { status: 'modified', localVersion: banner.version };
};

/**
 * Turn an alias from components.json (`@/components/ui`, `~/lib`) into the folder it names,
 * relative to the project (`components/ui`). null when it is not in a form we can read.
 */
export const aliasDir = (alias: string | undefined): string | null => {
  if (!alias) return null;
  for (const prefix of ['@/', '~/']) {
    if (alias.startsWith(prefix)) return alias.slice(prefix.length).split('/').filter(Boolean).join('/') || null;
  }
  return null;
};

/** Where in the registry's layout each alias lives. A longer prefix is tried first. */
const LAYOUT: ReadonlyArray<readonly [prefix: string, alias: keyof Aliases]> = [
  ['components/ui/', 'ui'],
  ['components/', 'components'],
  ['hooks/', 'hooks'],
  ['lib/', 'lib'],
];

/**
 * The places a file with this registry `target` can be in a project: where its alias says, then
 * where the registry says; each under the project root and under `src/`.
 */
export const candidatePaths = (target: string, aliases: Aliases = {}): string[] => {
  const mapped: string[] = [];
  for (const [prefix, key] of LAYOUT) {
    if (!target.startsWith(prefix)) continue;
    const dir = aliasDir(aliases[key]);
    if (dir) mapped.push(`${dir}/${target.slice(prefix.length)}`);
    break;
  }
  const bases = [...mapped, target];
  const out: string[] = [];
  for (const base of bases) for (const path of [base, `src/${base}`]) if (!out.includes(path)) out.push(path);
  return out;
};

/** What a project holds at a path: its text, or null when there is no such file. */
export type Reader = (candidates: readonly string[]) => { file: string; content: string } | null;

/**
 * Check every file of every item. An item counts as installed when any of its files is in the
 * project; only then are its other files held to be there (`missing`). A file two items both
 * ship is checked once, against the first item that ships it.
 */
export const checkItems = (items: readonly CheckItem[], aliases: Aliases, read: Reader): Result[] => {
  const results: Result[] = [];
  const done = new Set<string>();
  for (const item of items) {
    const files = (item.files ?? []).filter(
      (f): f is ItemFile & { target: string; content: string } => !!f.target && typeof f.content === 'string',
    );
    const found = files.map((f) => ({ f, hit: read(candidatePaths(f.target, aliases)) }));
    if (!found.some((x) => x.hit)) continue;
    for (const { f, hit } of found) {
      if (done.has(f.target)) continue;
      done.add(f.target);
      const { status, localVersion } = classify(hit ? hit.content : null, f.content, item.meta?.version);
      results.push({
        file: hit ? hit.file : f.target,
        item: item.name,
        status,
        ...(localVersion ? { localVersion } : {}),
        ...(item.meta?.version ? { releasedVersion: item.meta.version } : {}),
        allowed: false,
      });
    }
  }
  return results.sort((a, b) => a.file.localeCompare(b.file));
};

export type Summary = {
  counts: Record<Status, number>;
  /** Files that make the check fail. */
  failing: Result[];
  /** Allowed files that now match a release: delete them from the list. */
  stale: string[];
  ok: boolean;
};

const key = (file: string) => file.split('\\').join('/').replace(/^\.\//, '');

/**
 * Mark allowed files, and decide what fails: `modified`, `ahead` and `missing`, and `behind` too
 * under `strict`. An allowed file never fails. Allowed paths that match no checked file are
 * ignored, so one list can serve several projects.
 */
export const summarize = (
  results: readonly Result[],
  allow: Readonly<Record<string, string>>,
  strict: boolean,
): { results: Result[]; summary: Summary } => {
  const list = Object.fromEntries(Object.entries(allow).map(([file, why]) => [key(file), why]));
  const marked = results.map((r): Result => {
    const reason = Object.hasOwn(list, r.file) ? list[r.file] : undefined;
    return reason === undefined ? r : { ...r, allowed: true, ...(reason ? { reason } : {}) };
  });
  const counts: Record<Status, number> = { match: 0, behind: 0, modified: 0, ahead: 0, missing: 0 };
  for (const r of marked) counts[r.status] += 1;
  const drift: Status[] = strict ? ['behind', 'modified', 'ahead', 'missing'] : ['modified', 'ahead', 'missing'];
  const failing = marked.filter((r) => !r.allowed && drift.includes(r.status));
  const stale = marked.filter((r) => r.allowed && r.status === 'match').map((r) => r.file);
  return { results: marked, summary: { counts, failing, stale, ok: failing.length === 0 } };
};

/** The allow list from a config file's text: `{ "allow": { "<file>": "<why>" } }` or `{ "allow": ["<file>"] }`. */
export const parseAllowConfig = (text: string): Record<string, string> | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const allow = (parsed as { allow?: unknown } | null)?.allow;
  if (Array.isArray(allow)) return Object.fromEntries(allow.filter((f): f is string => typeof f === 'string').map((f) => [f, '']));
  if (allow && typeof allow === 'object') {
    return Object.fromEntries(Object.entries(allow).map(([file, why]) => [file, typeof why === 'string' ? why : '']));
  }
  return {};
};
