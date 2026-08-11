import type { Metadata } from 'next';
import Link from 'next/link';

import { ReleaseNote } from '@/components/release-note';
import { SiteNav } from '@/components/site-nav';
import { KIND_ORDER, releaseAnchor, releases } from '@/lib/changelog';
import { HOMEPAGE } from '../../../registry.config.mjs';

export const metadata: Metadata = {
  title: 'Changelog',
  description:
    'Every release of the Interlace design system: added, changed and breaking, with the components each entry touched and the migration note for every breaking change.',
  openGraph: {
    title: 'Changelog — Interlace DS',
    description:
      'What changed in @interlace/ui, per release, per component — with a migration note on every breaking change.',
    url: 'https://ds.interlace.tools/changelog',
  },
};

export default function ChangelogPage() {
  const all = releases();
  const breakingCount = all.reduce(
    (n, r) => n + r.entries.filter((e) => e.kind === 'Breaking').length,
    0,
  );

  return (
    <div className="bg-background text-foreground min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-content px-6 py-12">
        <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← All components
          </Link>
        </nav>

        <div className="mt-6">
          <h1 className="text-4xl font-bold tracking-tight">Changelog</h1>
          <p className="text-muted-foreground mt-3 max-w-prose text-lg">
            <code className="text-foreground font-mono">shadcn add</code> copies
            source into your tree. From that moment your file and ours have
            unrelated histories — there is no{' '}
            <code className="text-foreground font-mono">npm update</code> to
            carry a fix across. So this page is not a courtesy: it is the
            upgrade path.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="border-border text-muted-foreground rounded-full border px-3 py-1 font-mono text-xs">
              {all.length} release{all.length === 1 ? '' : 's'}
            </span>
            <span className="border-border text-muted-foreground rounded-full border px-3 py-1 font-mono text-xs">
              {breakingCount} breaking
            </span>
          </div>
        </div>

        {/* ─── Which version am I holding? ───────────────────────── */}
        {/*
          The page above tells you what changed. This section answers the
          question that has to come first and had no answer at all: which copy
          do you actually hold?

          Measured 2026-08-11 against our own only real consumer — 50 installed
          items, checked on normalised token streams so formatting did not
          count. Zero matched. Forty were strictly behind and eighteen still
          imported a package name that no longer exists. Nobody had done
          anything wrong; there was simply no command that would have said so.
        */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Which version am I holding?</h2>
          <p className="text-muted-foreground mt-3 max-w-prose">
            Every installed file carries a version banner a few lines in. To
            check a whole project against this registry at once:
          </p>
          <pre className="border-border bg-card mt-4 overflow-x-auto rounded-lg border p-4 font-mono text-sm">
            <code>{`# in your project — every installed file states its own version
grep -h "^// @interlace/" src/components/ui/*.tsx

# what this registry ships right now, per item
curl -s ${HOMEPAGE}/data/agent-index.json | jq -r '.items[] | "\\(.name) \\(.version)"'`}</code>
          </pre>
          <p className="text-muted-foreground mt-3 max-w-prose text-sm">
            A file with no banner was installed before the banner shipped, or
            had its leading comments stripped by an older CLI — in that case we
            genuinely cannot tell which version you hold, and re-adding the item
            is the way to adopt one you can track. Compare{' '}
            <strong>versions</strong>, never content: you are <em>expected</em>{' '}
            to edit your copy, and a check that flagged every deliberate
            customisation as drift would be ignored within a week.
          </p>
          <p className="text-muted-foreground mt-3 max-w-prose text-sm">
            A packaged one-command form of this (
            <code className="text-foreground font-mono">consumer:check</code> in
            the registry repo) reports every file as current, behind,
            unversioned or local and exits non-zero when anything is stale. It
            is not published to npm yet.
          </p>
        </section>

        {/* ─── How to read it ────────────────────────────────────── */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">How to read an entry</h2>
          <dl className="border-border bg-border mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-3">
            {KIND_ORDER.map((kind) => (
              <div key={kind} className="bg-card p-4">
                <dt className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  {kind}
                </dt>
                <dd className="mt-2 text-sm">
                  {kind === 'Breaking'
                    ? 'Your copy will not behave the same. Every breaking entry carries a migration note naming the edit you make in your own file.'
                    : null}
                  {kind === 'Added'
                    ? 'New components, new props, new tokens. Re-run the install for the components you want; nothing you own changes underneath you.'
                    : null}
                  {kind === 'Changed'
                    ? 'A fix or an internal change with the same public surface. Safe to re-install; safe to skip.'
                    : null}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground mt-4 max-w-prose text-sm">
            Each component also carries its own version, stamped into the file
            you install as a banner. The full contract — what counts as
            breaking for source you already own — is in{' '}
            <a
              href="https://github.com/ofri-peretz/interlace/blob/main/docs/philosophies/VERSIONING_PHILOSOPHY.md"
              className="text-primary underline-offset-4 hover:underline"
            >
              VERSIONING_PHILOSOPHY.md
            </a>
            .
          </p>
        </section>

        {/* ─── Releases ──────────────────────────────────────────── */}
        {all.map((release) => (
          <section
            key={release.version}
            id={releaseAnchor(release.version)}
            className="mt-14 scroll-mt-20"
          >
            <div className="border-border flex flex-wrap items-baseline justify-between gap-3 border-b pb-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                {release.unreleased ? 'Unreleased' : `v${release.version}`}
              </h2>
              <span className="text-muted-foreground font-mono text-xs">
                {release.unreleased
                  ? 'pending changesets — not yet cut'
                  : `${release.entries.length} entr${release.entries.length === 1 ? 'y' : 'ies'}`}
              </span>
            </div>
            <ul className="mt-5 space-y-4">
              {release.entries.map((entry, i) => (
                <ReleaseNote key={`${entry.source}-${i}`} entry={entry} />
              ))}
            </ul>
          </section>
        ))}

        <footer className="border-border mt-16 border-t pt-8 text-sm">
          <p className="text-muted-foreground max-w-prose">
            Generated from{' '}
            <code className="text-foreground font-mono">
              packages/ui/CHANGELOG.md
            </code>{' '}
            and the pending{' '}
            <code className="text-foreground font-mono">.changeset/*.md</code>{' '}
            entries. Every pull request that touches the design system has to
            add one, so this page cannot fall behind the code without CI going
            red.
          </p>
        </footer>
      </main>
    </div>
  );
}
