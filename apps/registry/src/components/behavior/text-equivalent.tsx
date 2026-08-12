import type { TextAlternative } from '@/lib/behavior';

import { BehaviorSubsection, repoHref } from './section';

/**
 * How a non-visual reader gets the DATA — not a description of the picture.
 *
 * Four descending strengths, detected from the shipped source rather than
 * asserted: shipping a real `<table>` of every plotted value and shipping an
 * `aria-label` are not the same promise, and rendering them as the same
 * sentence is precisely the claim inflation §5.x catalogues in the market.
 */

const STRENGTH: Record<
  NonNullable<TextAlternative['kind']>,
  { label: string; rank: string; strong: boolean }
> = {
  'series-table': {
    label: 'Is the sr-only data table',
    rank: 'Full data equivalent',
    strong: true,
  },
  'series-table-consumer': {
    label: 'Ships a real <table> of every value',
    rank: 'Full data equivalent',
    strong: true,
  },
  'sr-only-table': {
    label: 'Ships an sr-only <table>',
    rank: 'Full data equivalent',
    strong: true,
  },
  'sr-only-copy': {
    label: 'Ships sr-only copy',
    rank: 'Label, not a data equivalent',
    strong: false,
  },
};

export function TextEquivalentSection({
  alternative,
  sourcePath,
}: {
  alternative: TextAlternative;
  /** The component file the claim was read out of. */
  sourcePath: string;
}) {
  if (!alternative.kind) return null;
  const strength = STRENGTH[alternative.kind];

  return (
    <BehaviorSubsection
      title="Text equivalent"
      source={sourcePath}
      sourceHref={repoHref(sourcePath)}
      summary={
        <>
          A chart&apos;s alt text is not a sentence about the chart — the
          equivalent of the data <em>is</em> the data. This is what a screen
          reader gets, read out of the source the install writes into your tree.
        </>
      }
    >
      <div
        className={
          strength.strong
            ? 'border-primary/40 bg-primary/5 rounded-lg border p-4'
            : 'border-border bg-background rounded-lg border border-dashed p-4'
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              strength.strong
                ? 'border-primary/40 bg-primary/10 text-primary rounded-full border px-3 py-1 font-mono text-xs font-semibold'
                : 'border-border text-muted-foreground rounded-full border px-3 py-1 font-mono text-xs'
            }
          >
            {strength.rank}
          </span>
          <span className="text-sm font-semibold">{strength.label}</span>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          {alternative.detail}
        </p>
      </div>
    </BehaviorSubsection>
  );
}
