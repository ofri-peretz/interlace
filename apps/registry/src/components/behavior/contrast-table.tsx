import type { ContrastRow, ThemeScheme } from '@/lib/behavior';

import { BehaviorSubsection, repoHref } from './section';

/**
 * Measured contrast, per token pair, per theme × scheme.
 *
 * The numbers are not read out of a comment and not eyeballed off a swatch:
 * `scripts/build-behavior-map.mjs` resolves the shipped `--interlace-*` hexes
 * out of the stylesheets and runs the same WCAG relative-luminance maths the
 * theme lock runs. If a brand change drops a pair under its floor, this table
 * says so on the same commit the gate fails on.
 *
 * Rows are ordered tightest-first. A contrast table sorted by anything else is
 * a table whose most important row is at the bottom.
 */

const columnLabel = ({ theme, scheme }: ThemeScheme) => `${theme} · ${scheme}`;

function Ratio({
  value,
  floor,
  worst,
}: {
  value: number;
  floor: number;
  worst: boolean;
}) {
  const passes = value >= floor;
  return (
    <span
      className={
        passes
          ? worst
            ? 'text-foreground font-semibold'
            : 'text-muted-foreground'
          : 'text-destructive font-semibold'
      }
      title={
        worst ? 'The tightest measurement across every theme × scheme' : undefined
      }
    >
      {value.toFixed(2)}
      <span className="text-muted-foreground text-xs">:1</span>
    </span>
  );
}

export function ContrastTableSection({
  rows,
  matrix,
  source,
}: {
  rows: ContrastRow[];
  matrix: ThemeScheme[];
  source: string;
}) {
  const tightest = rows[0];

  return (
    <BehaviorSubsection
      title="Measured contrast"
      source={source}
      sourceHref={repoHref(source)}
      summary={
        <>
          Every semantic colour pair this component&apos;s own source uses,
          measured against the shipped hexes in all {matrix.length} theme ×
          scheme combinations.{' '}
          {tightest ? (
            <>
              The tightest is{' '}
              <code className="text-foreground font-mono">
                {tightest.fg}
              </code>{' '}
              on{' '}
              <code className="text-foreground font-mono">{tightest.bg}</code>{' '}
              at{' '}
              <span className="text-foreground font-semibold">
                {tightest.worst.toFixed(2)}:1
              </span>{' '}
              ({columnLabel(tightest.worstAt)}), against a floor of{' '}
              {tightest.floor}:1.
            </>
          ) : null}
        </>
      }
    >
      <div className="border-border bg-card overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Measured WCAG contrast ratios per token pair and theme
          </caption>
          <thead className="bg-background/60 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              <th
                scope="col"
                className="border-border border-b px-4 py-2 text-left font-semibold"
              >
                Pair
              </th>
              {matrix.map((column) => (
                <th
                  key={columnLabel(column)}
                  scope="col"
                  className="border-border border-b px-3 py-2 text-right font-semibold whitespace-nowrap"
                >
                  {column.theme}
                  <span className="text-muted-foreground/70 block text-[10px] normal-case">
                    {column.scheme}
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className="border-border border-b px-3 py-2 text-right font-semibold whitespace-nowrap"
              >
                Floor
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.fg}+${row.bg}`}
                className="border-border border-b align-top last:border-b-0"
              >
                <th scope="row" className="px-4 py-2 text-left font-normal">
                  {/*
                    Nowrap on the pair itself: at 375px `muted-foreground on
                    background` otherwise wrapped to four lines and the row
                    became a paragraph. The container scrolls — that is what the
                    horizontal scroll is for.
                  */}
                  <span className="font-mono text-xs font-semibold whitespace-nowrap">
                    {row.fg} <span className="text-muted-foreground">on</span>{' '}
                    {row.bg}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {row.why}
                  </span>
                </th>
                {row.ratios.map((value, i) => (
                  <td
                    key={i}
                    className="px-3 py-2 text-right font-mono whitespace-nowrap"
                  >
                    <Ratio
                      value={value}
                      floor={row.floor}
                      worst={value === row.worst}
                    />
                  </td>
                ))}
                <td className="text-muted-foreground px-3 py-2 text-right font-mono text-xs whitespace-nowrap">
                  {row.floor.toFixed(1)}:1
                  <span className="block text-[10px]">
                    {row.kind === 'text' ? 'SC 1.4.3' : 'SC 1.4.11'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Text pairs are held to 4.5:1 (WCAG 2.2 SC 1.4.3); borders, rings and
        chart axes to 3:1 (SC 1.4.11 non-text). Bold is the worst cell in the
        row — the one a brand fork has to keep an eye on.
      </p>
    </BehaviorSubsection>
  );
}
