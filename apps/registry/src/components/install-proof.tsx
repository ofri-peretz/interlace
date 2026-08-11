import Link from 'next/link';

import { Inline } from '@/components/prose/inline';
import type { InstallProof } from '@/lib/install-proof';

/**
 * The install proof: CI creates a brand-new Next.js app, runs the REAL
 * `npx shadcn add` over every item in this registry, wires the stylesheets and
 * type-checks the result — then commits the outcome to
 * `apps/registry/e2e-install-results.json`.
 *
 * None of the nine registries benchmarked in DESIGN-SYSTEM-PLAN.md §5.x
 * publishes anything like it, and this site had it sitting in a JSON file no
 * visitor could reach.
 *
 * Rendered as counts and dates, deliberately not as a badge. A green shield
 * says "trust me"; "120 items, 126 files, type-checked, 8 days ago" is a claim
 * a reader can argue with — including the part where the run is behind the
 * catalogue, which the panel says out loud rather than rounding away.
 */

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const formatRunDate = (iso: string) => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : dateFormat.format(at);
};

function Figure({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="bg-card p-4">
      <div className="text-foreground font-mono text-2xl font-bold tracking-tight">
        {value}
      </div>
      <div className="text-muted-foreground mt-1 text-xs font-semibold tracking-wider uppercase">
        {label}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        <Inline text={detail} />
      </p>
    </div>
  );
}

/** One specific sentence, for a page that is about something else. */
export function InstallProofLine({ proof }: { proof: InstallProof }) {
  if (!proof.ok) return null;
  return (
    <p className="text-muted-foreground text-sm">
      Last verified {formatRunDate(proof.ranAt)}:{' '}
      <span className="text-foreground font-semibold">
        {proof.itemCount} items
      </span>{' '}
      installed into a brand-new Next.js app with the real{' '}
      <code className="text-foreground font-mono">npx shadcn add</code>, writing{' '}
      {proof.fileCount} files
      {proof.typeChecked ? ', and the app type-checked' : ''}.{' '}
      <Link
        href="/getting-started#install-proof"
        className="text-primary underline-offset-4 hover:underline"
      >
        See the run
      </Link>
      .
    </p>
  );
}

export function InstallProofPanel({ proof }: { proof: InstallProof }) {
  return (
    <section id="install-proof" className="mt-12 scroll-mt-20">
      <h2 className="text-2xl font-semibold tracking-tight">
        Proof the install works
      </h2>
      <p className="text-muted-foreground mt-2 max-w-prose">
        Not a claim — a run. CI creates a brand-new Next.js + Tailwind v4 app
        from scratch, runs{' '}
        <code className="text-foreground font-mono">npx shadcn init</code>, adds{' '}
        <span className="text-foreground font-semibold">
          every item in this registry
        </span>{' '}
        through the real CLI, and then builds the result. The outcome is
        committed to{' '}
        <code className="text-foreground font-mono">
          apps/registry/e2e-install-results.json
        </code>{' '}
        — this page reads that file, it does not summarise it by hand.
      </p>

      <dl className="border-border mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        <Figure
          value={String(proof.itemCount)}
          label="items installed"
          detail={
            proof.failed.length === 0
              ? 'Every item the run attempted resolved and wrote its files.'
              : `${proof.failed.length} failed: ${proof.failed.join(', ')}.`
          }
        />
        <Figure
          value={String(proof.fileCount)}
          label="files written"
          detail="Into a tree that had never seen this design system before."
        />
        <Figure
          value={proof.typeChecked ? 'passed' : 'not run'}
          label="type check"
          detail={
            proof.typeChecked
              ? '`next build` compiled and type-checked every installed source — the CLI copying a file is not the same as the file compiling.'
              : 'The build step did not report a TypeScript pass.'
          }
        />
        <Figure
          value={String(proof.sheets.length)}
          label="stylesheets wired"
          detail={proof.sheets.join(' · ')}
        />
      </dl>

      <ol className="mt-6 space-y-3">
        {proof.steps.map((step, i) => (
          <li key={step.id} className="flex gap-3">
            <span
              className={
                step.ok
                  ? 'border-primary/40 bg-primary/10 text-primary mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs'
                  : 'border-destructive/40 bg-destructive/10 text-destructive mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs'
              }
            >
              {step.ok ? '✓' : '✕'}
            </span>
            <span className="min-w-0 flex-1">
              <code className="text-foreground font-mono text-sm font-semibold">
                {step.id}
              </code>
              <span className="text-muted-foreground mt-0.5 block text-sm">
                <Inline text={step.claim} />
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="text-muted-foreground mt-6 text-sm">
        Run {formatRunDate(proof.ranAt)}
        {proof.durationSeconds
          ? `, in ${Math.round(proof.durationSeconds)}s`
          : ''}
        . Reproduce it with{' '}
        <code className="text-foreground font-mono">npm run registry:e2e</code>{' '}
        in the repo.
      </p>

      {proof.notCovered > 0 ? (
        <p className="border-border bg-card text-muted-foreground mt-4 rounded-lg border border-dashed p-4 text-sm">
          <span className="text-foreground font-semibold">
            The proof is {proof.notCovered} items behind the catalogue.
          </span>{' '}
          The registry now publishes {proof.registryItemCount} items; the last
          run covered {proof.itemCount}. The newest items are installable in
          principle — same generator, same schema — but they have not been
          through this run, and saying &ldquo;everything works&rdquo; would be
          claiming a measurement nobody took.
        </p>
      ) : null}
    </section>
  );
}
