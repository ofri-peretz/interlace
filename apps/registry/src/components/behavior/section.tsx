import type { ReactNode } from 'react';

/**
 * The shell every Behavior subsection shares: a heading, one sentence of what
 * the reader is looking at, and — the part that makes the section worth
 * anything — a citation of the file that ENFORCES the claim.
 *
 * `source` is a required prop, not an optional one. A behaviour claim without
 * the gate that keeps it true is marketing, and the whole point of this
 * section is that we are the registry that does not do that.
 */
export function BehaviorSubsection({
  title,
  summary,
  source,
  sourceHref,
  children,
}: {
  title: string;
  /** One line: what this block proves. */
  summary: ReactNode;
  /** Repo-relative path of the test or source that enforces it. */
  source: string;
  /** Link target for `source`, when it is browsable. */
  sourceHref?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-card/40 mt-6 rounded-lg border p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {sourceHref ? (
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground font-mono text-xs break-all transition-colors"
          >
            {source} ↗
          </a>
        ) : (
          <span className="text-muted-foreground font-mono text-xs break-all">
            {source}
          </span>
        )}
      </div>
      <p className="text-muted-foreground mt-2 max-w-prose text-sm">{summary}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const REPO_BLOB = 'https://github.com/ofri-peretz/interlace/blob/main/';

/** A repo-relative path → its GitHub blob URL. */
export const repoHref = (path: string) => `${REPO_BLOB}${path}`;
