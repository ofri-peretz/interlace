import type { DataStateFacet } from '@/lib/behavior';

import { BehaviorSubsection, repoHref } from './section';

/**
 * The lifecycle state union, and — the part that is actually differentiated —
 * what each state is allowed to LOOK like.
 *
 * §5.x took the union idea from AI SDK Elements; Phase 10 found the thing none
 * of them ship: absence as a design vocabulary. `not-counted` is not zero,
 * `truncated` is not a total, and the two are drawn differently on purpose.
 * The table below is read out of `DATA_STATE_PRESENTATION`, so the glyph a
 * consumer sees here is the glyph the component renders.
 */

const ROLE_COPY: Record<DataStateFacet['role'], string> = {
  replaces: 'Stands instead of the body',
  qualifies: 'Stands next to the body and changes how to read it',
  none: 'The absence of absence',
};

export function StateUnionSection({
  states,
  facets,
  source,
}: {
  /** The union members this component handles. */
  states: string[];
  /** Presentation facts for every member, from the model. */
  facets: DataStateFacet[];
  source: string;
}) {
  const rows = facets.filter((f) => states.includes(f.name));
  if (rows.length === 0) return null;

  return (
    <BehaviorSubsection
      title="State union"
      source={source}
      sourceHref={repoHref(source)}
      summary={
        <>
          {rows.length} states, one closed union — not a{' '}
          <code className="text-foreground font-mono">boolean</code> per
          condition. Partial is a <em>state</em>, not an absence: a spinner that
          hides progress, or a missing prior rendered as{' '}
          <code className="text-foreground font-mono">0</code>, is the failure
          this model exists to make impossible.
        </>
      }
    >
      <div className="border-border bg-card overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-background/60 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              <th
                scope="col"
                className="border-border border-b px-4 py-2 text-left font-semibold"
              >
                State
              </th>
              <th
                scope="col"
                className="border-border border-b px-4 py-2 text-left font-semibold"
              >
                Reads as
              </th>
              <th
                scope="col"
                className="border-border border-b px-4 py-2 text-left font-semibold"
              >
                Role
              </th>
              <th
                scope="col"
                className="border-border border-b px-4 py-2 text-left font-semibold"
              >
                Encoding
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((facet) => (
              <tr
                key={facet.name}
                className="border-border border-b align-top last:border-b-0"
              >
                <td className="px-4 py-2 font-mono text-xs font-semibold whitespace-nowrap">
                  {facet.name}
                </td>
                <td className="px-4 py-2 text-sm">
                  {facet.short ? (
                    <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 font-mono text-xs">
                      {facet.glyph ? `${facet.glyph} ` : ''}
                      {facet.short}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-muted-foreground px-4 py-2 text-sm">
                  {ROLE_COPY[facet.role]}
                </td>
                <td className="px-4 py-2">
                  <span className="flex flex-wrap gap-1.5">
                    {facet.hatch ? (
                      <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 font-mono text-xs">
                        hatched
                      </span>
                    ) : null}
                    {facet.dashed ? (
                      <span className="border-border text-muted-foreground rounded-md border border-dashed px-2 py-0.5 font-mono text-xs">
                        dashed
                      </span>
                    ) : null}
                    <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 font-mono text-xs">
                      {facet.emphasis}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Hatched and dashed are the two absences drawn apart on purpose:{' '}
        <code className="text-foreground font-mono">not-counted</code> means no
        measurement was taken and is never a zero;{' '}
        <code className="text-foreground font-mono">truncated</code> means the
        total is unknown and must never be used as a denominator. Each state
        also carries a spoken announcement — transitions, never ticks.
      </p>
    </BehaviorSubsection>
  );
}
