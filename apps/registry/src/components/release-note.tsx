import Link from 'next/link';

import { Callout } from '@interlace/ui/callout';

import {
  type ChangelogEntry,
  KIND_CLASS,
} from '@/lib/changelog';

/**
 * Rendering for one release-note entry, shared by BOTH views of the changelog
 * (`/changelog` and the History section of `/c/<name>`).
 *
 * The data is single-sourced in `lib/changelog.ts`; this keeps the PRESENTATION
 * single-sourced too, so the two surfaces cannot drift into showing the same
 * entry differently — e.g. one of them quietly dropping the migration note,
 * which is the one part a reader cannot do without.
 */

/**
 * Release notes are prose with inline code spans, not full markdown. A markdown
 * renderer here would be a dependency, a sanitiser decision and a styling
 * surface for one feature: `` `backticks` ``. Split on them instead.
 */
export function InlineText({ children }: { children: string }) {
  const parts = children.split('`');
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="text-foreground font-mono text-[0.9em]">
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function KindPill({ kind }: { kind: ChangelogEntry['kind'] }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold ${KIND_CLASS[kind]}`}
    >
      {kind}
    </span>
  );
}

interface ReleaseNoteProps {
  entry: ChangelogEntry;
  /**
   * On a component page the entry is already scoped to that component, so
   * repeating its own name in the touched-components row is noise.
   */
  omitComponent?: string;
}

export function ReleaseNote({ entry, omitComponent }: ReleaseNoteProps) {
  const components = entry.components.filter((c) => c !== omitComponent);
  return (
    <li className="border-border bg-card rounded-lg border p-5">
      <div className="flex flex-wrap items-center gap-2">
        <KindPill kind={entry.kind} />
        <span className="text-muted-foreground font-mono text-xs">
          {entry.bump}
        </span>
      </div>

      <p className="mt-3 max-w-prose text-sm leading-relaxed whitespace-pre-line">
        <InlineText>{entry.summary}</InlineText>
      </p>

      {components.length > 0 ? (
        <div className="mt-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Components
          </div>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {components.map((name) => (
              <li key={name}>
                <Link
                  href={`/c/${name}`}
                  className="bg-background border-border hover:border-primary/60 rounded-md border px-2 py-0.5 font-mono text-xs transition-colors"
                >
                  @interlace/{name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {entry.migration ? (
        <Callout
          tone={entry.kind === 'Breaking' ? 'danger' : 'note'}
          title="Migration"
          className="mt-4"
        >
          <span className="text-sm whitespace-pre-line">
            <InlineText>{entry.migration}</InlineText>
          </span>
        </Callout>
      ) : null}
    </li>
  );
}
