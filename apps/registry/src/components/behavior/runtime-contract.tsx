import Link from 'next/link';

import { BehaviorSubsection, repoHref } from './section';

/**
 * The three contract facts a consumer has to know BEFORE they paste the
 * component into a page, gathered in one place: where it renders, how narrow it
 * survives, and whether it is inside the coverage gate.
 *
 * The coverage cell is the one worth reading twice. "100%" over a glob that
 * excludes this component is a true number and a false impression, so the glob
 * is printed next to the number and a component outside it says so plainly.
 * The alternative — a green badge on every page — is the thing §5.x rejects.
 */
export function RuntimeContractSection({
  isClient,
  minViewport,
  coverage,
  inCoverageGate,
}: {
  isClient: boolean;
  minViewport: number | null;
  coverage: { file: string; thresholds: Record<string, number>; include: string[] };
  inCoverageGate: boolean;
}) {
  const thresholds = Object.entries(coverage.thresholds);
  const uniform = new Set(thresholds.map(([, v]) => v)).size === 1;

  return (
    <BehaviorSubsection
      title="Runtime contract"
      source={coverage.file}
      sourceHref={repoHref(coverage.file)}
      summary={
        <>
          Where it renders, how narrow it survives, and whether its lines are
          inside the coverage gate — three answers a consumer needs before the
          paste, not after the bug.
        </>
      }
    >
      <dl className="border-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
        <div className="bg-card p-4">
          <dt className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Render boundary
          </dt>
          <dd className="mt-2 text-sm">
            <code className="text-foreground font-mono text-xs font-semibold">
              {isClient ? "'use client'" : 'server component'}
            </code>
            <p className="text-muted-foreground mt-1.5 text-xs">
              {isClient
                ? 'Hydrates. It brings JavaScript to any route that imports it — put the boundary here, not at the page.'
                : 'Renders during SSR / RSC with no hydration cost. It can be imported from a server component without pulling the page into the client.'}
            </p>
          </dd>
        </div>

        <div className="bg-card p-4">
          <dt className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Minimum viewport
          </dt>
          <dd className="mt-2 text-sm">
            {minViewport != null ? (
              <>
                <code className="text-foreground font-mono text-xs font-semibold">
                  MIN_VIEWPORT = {minViewport}
                </code>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  Declared, not assumed. Below {minViewport} CSS px the
                  preflight contract draws a dev-mode outline —{' '}
                  <Link
                    href="#min-viewport"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    how to switch it on
                  </Link>
                  .
                </p>
              </>
            ) : (
              <>
                <code className="text-foreground font-mono text-xs font-semibold">
                  none declared
                </code>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  No width floor: it takes the width it is given. Its container
                  owns the layout question.
                </p>
              </>
            )}
          </dd>
        </div>

        <div className="bg-card p-4">
          <dt className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Coverage gate
          </dt>
          <dd className="mt-2 text-sm">
            {inCoverageGate ? (
              <>
                <code className="text-primary font-mono text-xs font-semibold">
                  {uniform
                    ? `${thresholds[0][1]}% × ${thresholds.length}`
                    : 'thresholds set'}
                </code>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  Inside the v8 gate:{' '}
                  {thresholds.map(([k, v], i) => (
                    <span key={k}>
                      {i > 0 ? ', ' : ''}
                      {k} {v}
                    </span>
                  ))}
                  . A threshold under 100 only records how much you stopped
                  caring, so there isn&apos;t one.
                </p>
              </>
            ) : (
              <>
                <code className="text-muted-foreground font-mono text-xs font-semibold">
                  not in the gate
                </code>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  The 100% gate currently covers{' '}
                  {coverage.include.map((glob, i) => (
                    <span key={glob}>
                      {i > 0 ? ' and ' : ''}
                      <code className="text-foreground font-mono">{glob}</code>
                    </span>
                  ))}
                  . This file is outside it — the glob widens in phase 7.2.
                </p>
              </>
            )}
          </dd>
        </div>
      </dl>
    </BehaviorSubsection>
  );
}
