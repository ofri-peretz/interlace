/**
 * @interlace/ui — file-model
 *
 * The rules a file picker applies before anything is uploaded: does the file
 * match what the field accepts, is it small enough, and is there room for
 * another. Pure, so a server can apply the same rules to the same files and
 * a reader is never told "yes" in the browser and "no" by the server.
 *
 * ## accept
 *
 * The same string the `accept` attribute takes, so one value serves both the
 * native picker and this check: comma-separated extensions (`.png`), exact
 * types (`image/png`) and wildcards (`image/*`). The native picker only
 * suggests; a drop, or a picker set to "All files", can hand over anything,
 * which is why the check runs again here. An empty `accept` takes every file.
 *
 * ## Sizes
 *
 * `formatBytes` writes a size the way a person reads one (`2.4 MB`), in
 * decimal units like the operating systems' own file browsers, in the
 * reader's locale.
 */

/** What a file has that the rules read. A browser `File` fits. */
export interface FileLike {
  name: string;
  size: number;
  type: string;
}

export type FileRejectionReason = 'type' | 'size' | 'count';

export interface FileRejection<F extends FileLike = FileLike> {
  file: F;
  reason: FileRejectionReason;
}

export interface FileRules {
  /** The `accept` attribute's value. Empty or missing takes every file. */
  accept?: string;
  /** The largest file, in bytes. Missing means no limit. */
  maxSize?: number;
  /** How many files the field holds in all. Missing means no limit. */
  maxFiles?: number;
}

export interface FileCheck<F extends FileLike = FileLike> {
  accepted: F[];
  rejected: FileRejection<F>[];
}

/** Whether `file` matches the `accept` attribute value. */
export function acceptsFile(file: FileLike, accept: string | undefined): boolean {
  const patterns = (accept ?? '')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (patterns.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return patterns.some((pattern) => {
    if (pattern.startsWith('.')) return name.endsWith(pattern);
    if (pattern.endsWith('/*')) return type.startsWith(pattern.slice(0, -1));
    return type === pattern;
  });
}

/**
 * Sorts new files into those the field takes and those it turns away, and
 * why. `held` is how many files the field already holds, so `maxFiles`
 * counts them too. Files are taken in order until the field is full.
 */
export function checkFiles<F extends FileLike>(files: readonly F[], rules: FileRules = {}, held = 0): FileCheck<F> {
  const accepted: F[] = [];
  const rejected: FileRejection<F>[] = [];
  for (const file of files) {
    if (!acceptsFile(file, rules.accept)) rejected.push({ file, reason: 'type' });
    else if (rules.maxSize !== undefined && file.size > rules.maxSize) rejected.push({ file, reason: 'size' });
    else if (rules.maxFiles !== undefined && held + accepted.length >= rules.maxFiles)
      rejected.push({ file, reason: 'count' });
    else accepted.push(file);
  }
  return { accepted, rejected };
}

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

/** A size as a person reads it: `512 bytes`, `2.4 MB`, in decimal units. */
export function formatBytes(bytes: number, locale?: string): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: UNITS[unit],
    unitDisplay: unit === 0 ? 'long' : 'short',
    maximumFractionDigits: unit === 0 || value >= 100 ? 0 : 1,
  }).format(value);
}
