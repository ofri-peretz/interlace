'use client';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import {
  compactMagnitude,
  describeMeter,
  fillWidthClass,
  meterDomainMax,
  meterFraction,
  rankByValue,
  type MeterScaleKind,
} from '@interlace/ui/meter-scale';
import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';

import { withRtl } from '@/decorators';

/**
 * `meter-scale` — the arithmetic behind every bar, drawn twice.
 *
 * A bar that draws a beautiful wrong length is worse than one that fails to
 * render, and the length is the part that can be PROVED rather than
 * reviewed. So the maths lives in a pure module with no React and no DOM,
 * and this page runs it on one dataset through both scales at once.
 *
 * ─── The case `log` exists for ────────────────────────────────────
 *
 * Reach spans orders of magnitude. A row at 10,000 and a row at 10,000,000
 * cannot share a linear axis: the first becomes a hairline that reads as
 * zero, and the ORDERING — the only thing a ranked list is actually for —
 * stops being legible. Switch the scale control and watch the bottom rows
 * come back.
 *
 * `log` is opt-in and must stay opt-in: a log axis flatters small numbers,
 * so defaulting to it would make every list look healthier than it is. The
 * scale in force is printed on the panel for the same reason.
 *
 * ─── `null` is unmeasured, and it stays that way ──────────────────
 *
 * `meterFraction(null, …)` returns `null`, never `0`. A bar of length zero
 * and a bar that was never run look identical once the number is gone, and
 * the hatch variant exists precisely so they do not. The same rule runs
 * through the rest of the module: `meterDomainMax` skips nulls rather than
 * counting them (so an all-unmeasured list yields `null` and the caller
 * renders hatches instead of a row of empty bars implying every value was
 * zero), and `rankByValue` sinks unmeasured rows to the bottom **without**
 * claiming they are the smallest.
 *
 * ─── Length and number, never hue ─────────────────────────────────
 *
 * Nothing in the module returns a colour. Magnitude is carried by the
 * fraction (length) and by the formatted value (number), so a bar survives
 * greyscale, a screenshot at 40% width, and red-green colour vision
 * deficiency. `describeMeter` is the third carrier — the sentence a screen
 * reader gets, holding the ACTUAL value rather than "62 percent", which is
 * the projection and not the measurement.
 */

// ── Dataset ─────────────────────────────────────────────────────────────────
//
// Four orders of magnitude plus one genuinely unmeasured row. Chosen so the
// linear panel is visibly unusable and the log panel is visibly fine — the
// comparison is the documentation.

type Row = { label: string; value: number | null };

const ROWS: readonly Row[] = [
  { label: 'npm — @interlace/eslint-plugin', value: 10_400_000 },
  { label: 'GitHub — repository views', value: 1_240_000 },
  { label: 'Dev.to — article reads', value: 96_400 },
  { label: 'Docs site — unique visitors', value: 10_200 },
  { label: 'Conference talk — attendees', value: 320 },
  { label: 'Newsletter — forwards', value: null },
];

// ── One bar ─────────────────────────────────────────────────────────────────
//
// `fillWidthClass` returns a literal Tailwind class from a 101-entry table
// rather than an inline style, because Tailwind v4 scans source as raw TEXT:
// a template-built `w-[${n}%]` is never emitted. The hatch is the same class
// the DataState vocabulary uses for "no run happened".

const HATCH =
  'bg-[image:repeating-linear-gradient(45deg,var(--viz-axis)_0,var(--viz-axis)_1px,transparent_1px,transparent_5px)]';

function Bar({
  row,
  max,
  kind,
}: {
  row: Row;
  max: number | null;
  kind: MeterScaleKind;
}) {
  const fraction = meterFraction(row.value, max, kind);
  const sentence = describeMeter(row.label, row.value, max, 'events');

  return (
    <div
      className="grid gap-xs"
      data-slot="meter-row"
      data-label={row.label}
      data-fraction={fraction === null ? 'null' : fraction.toFixed(4)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-xs">
        <Typography variant="ui-sm">{row.label}</Typography>
        <Typography
          variant="code"
          as="code"
          tone={row.value === null ? 'muted' : 'default'}
        >
          {row.value === null ? 'not measured' : compactMagnitude(row.value)}
        </Typography>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-full border border-border bg-muted/40"
        aria-hidden
      >
        {fraction === null ? (
          <div className={`h-full w-[100%] ${HATCH}`} />
        ) : (
          <div
            className={`h-full rounded-full bg-primary ${fillWidthClass(fraction)}`}
            data-slot="meter-fill"
          />
        )}
      </div>

      {/* The text equivalent WCAG 1.1.1 asks for — the bar geometry above is
          aria-hidden, so this sentence is the value for a screen reader. */}
      <span className="sr-only">{sentence}</span>
    </div>
  );
}

// ── A scale panel ───────────────────────────────────────────────────────────

function ScalePanel({
  kind,
  rows,
  max,
  verdict,
  highlight,
}: {
  kind: MeterScaleKind;
  rows: readonly Row[];
  max: number | null;
  verdict: string;
  highlight: boolean;
}) {
  return (
    <Box
      border
      radius="md"
      padding="md"
      className={highlight ? 'border-warning/40 bg-warning/10' : 'bg-background'}
      data-slot="meter-scale-panel"
      data-kind={kind}
    >
      <Stack gap="sm">
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            <code className="font-mono">kind=&quot;{kind}&quot;</code>
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            {verdict}
          </Typography>
        </Stack>
        <Stack gap="sm">
          {rows.map((row) => (
            <Bar key={row.label} row={row} max={max} kind={kind} />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

type MeterScaleArgs = {
  /** Scale used by the single-axis panel at the top. */
  kind: MeterScaleKind;
};

function Specimen({ kind }: MeterScaleArgs) {
  // Ranked, and the unmeasured row sinks WITHOUT becoming zero.
  const ranked = rankByValue([...ROWS]);
  const max = meterDomainMax(ranked.map((row) => row.value));

  const smallest = ranked.filter((row) => row.value !== null).at(-1);
  const linearFraction = meterFraction(smallest?.value ?? null, max, 'linear');
  const logFraction = meterFraction(smallest?.value ?? null, max, 'log');

  return (
    <Stack gap="lg" className="w-full" data-slot="meter-scale-specimen">
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          meterFraction — the same rows on two axes
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          One dataset spanning four orders of magnitude, plus one row nobody
          measured. <code className="font-mono">meterDomainMax</code> put the
          denominator at{' '}
          <code className="font-mono">{max?.toLocaleString() ?? 'null'}</code>{' '}
          by skipping the null rather than counting it as zero.
        </Typography>
      </Stack>

      <Box
        border
        radius="md"
        padding="md"
        className="bg-card"
        data-slot="meter-scale-readout"
      >
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            The row that decides the argument
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            <strong>{smallest?.label}</strong> at{' '}
            {smallest?.value?.toLocaleString()} against a maximum of{' '}
            {max?.toLocaleString()}:
          </Typography>
          <div>
            <Typography variant="code" as="code" data-slot="linear-fraction">
              linear → {((linearFraction ?? 0) * 100).toFixed(3)}% (
              {fillWidthClass(linearFraction ?? 0)})
            </Typography>
          </div>
          <div>
            <Typography variant="code" as="code" data-slot="log-fraction">
              log → {((logFraction ?? 0) * 100).toFixed(1)}% (
              {fillWidthClass(logFraction ?? 0)})
            </Typography>
          </div>
          <Typography variant="caption" tone="muted" className="max-w-prose">
            One percent is about 3px on a 300px track — narrower than the rule
            that separates two rows. On the linear axis this row rounds to a
            width that reads as &ldquo;none&rdquo;, which is a measurement
            nobody took. The printed number is never optional for exactly this
            reason.
          </Typography>
        </Stack>
      </Box>

      <div className="grid gap-md lg:grid-cols-2">
        <ScalePanel
          kind="linear"
          rows={ranked}
          max={max}
          highlight
          verdict="Honest about proportion and useless about ordering: everything below the leader collapses into the axis. Correct arithmetic, unreadable chart."
        />
        <ScalePanel
          kind="log"
          rows={ranked}
          max={max}
          highlight={false}
          verdict="Every row is legible and the ordering survives — which is what a ranked list is for. Opt-in only: a log axis flatters small numbers, so a silent default would make every list look healthier than it is."
        />
      </div>

      <Box
        border
        radius="md"
        padding="md"
        className="bg-background"
        data-slot="meter-scale-rules"
      >
        <Stack gap="sm">
          <Typography variant="h4" as="h3">
            The rules that are not obvious
          </Typography>
          <dl className="grid gap-sm">
            {[
              [
                'meterFraction(null, max)  →  null',
                'Unmeasured is not zero. The caller renders the hatch, not an empty bar. The last row above is the hatch.',
              ],
              [
                'meterFraction(v, 0)  →  null',
                'No denominator means no fraction. Inventing 1 would report every row as complete.',
              ],
              [
                'meterDomainMax  skips nulls',
                'An all-unmeasured list yields null, so the caller draws hatches instead of a row of empty bars implying every value was zero.',
              ],
              [
                'rankByValue  is stable',
                'Unmeasured rows sink to the bottom without becoming zero, and ties keep the caller’s order — an alphabetical input stays alphabetical where the data does not separate it.',
              ],
              [
                'fillWidthClass  rounds, never floors',
                'At 0.999 a floor paints 99% and leaves a hairline of track visible on the row that IS the maximum — “almost”, on the one row where the answer is yes.',
              ],
            ].map(([term, detail]) => (
              <div key={term}>
                <dt>
                  <Typography variant="code" as="code">
                    {term}
                  </Typography>
                </dt>
                <dd>
                  <Typography variant="ui-sm" tone="muted" className="max-w-prose">
                    {detail}
                  </Typography>
                </dd>
              </div>
            ))}
          </dl>
        </Stack>
      </Box>

      <Box
        border
        radius="md"
        padding="md"
        className="bg-background"
        data-slot="meter-scale-single"
      >
        <Stack gap="sm">
          <Typography variant="h4" as="h3">
            Single axis — <code className="font-mono">kind={kind}</code>
          </Typography>
          <Typography variant="ui-sm" tone="muted">
            Driven by the Controls panel, for reading one scale at a time.
          </Typography>
          <Stack gap="sm">
            {ranked.map((row) => (
              <Bar key={row.label} row={row} max={max} kind={kind} />
            ))}
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Contracts/Meter Scale',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The meter arithmetic run on one dataset through both scales at once — the comparison IS the documentation. A row at 10k and a row at 10M cannot share a linear axis: the smaller one rounds to a width that reads as "none", which is a measurement nobody took, and the ordering a ranked list exists to show stops being legible. `log` fixes that and is deliberately opt-in, because a log axis flatters small numbers. The last row is `null` — unmeasured, never zero — so it draws the hatch rather than an empty bar, and `meterDomainMax` skipped it when picking the denominator. Nothing in the module returns a colour: magnitude is carried by length, by the printed number, and by `describeMeter`’s sr-only sentence.',
      },
    },
  },
  argTypes: {
    kind: {
      control: 'inline-radio',
      options: ['linear', 'log'],
      description:
        'Scale for the single-axis panel at the bottom. The two-panel comparison above always shows both.',
      table: {
        category: 'Scale',
        type: { summary: "'linear' | 'log'" },
        defaultValue: { summary: "'linear'" },
      },
    },
  },
  args: {
    kind: 'log',
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  tags: ['preview'],
  play: async ({ canvasElement }) => {
    const panel = (kind: string) =>
      canvasElement.querySelector(
        `[data-slot="meter-scale-panel"][data-kind="${kind}"]`,
      ) as HTMLElement;

    const fractionIn = (kind: string, label: string) =>
      panel(kind).querySelector(`[data-label="${label}"]`)?.getAttribute(
        'data-fraction',
      ) ?? '';

    const smallLabel = 'Conference talk — attendees';

    // The claim: on a linear axis the small row is a hairline; on a log axis
    // it is legible. Asserted as numbers, because "looks fine" is how a
    // broken scale ships.
    const linear = Number.parseFloat(fractionIn('linear', smallLabel));
    const log = Number.parseFloat(fractionIn('log', smallLabel));
    // 320 / 10,400,000 ≈ 0.00003 linear; log10(320)/log10(10.4M) ≈ 0.36.
    // Four orders of magnitude between the two renderings of one row.
    await expect(linear).toBeLessThan(0.001);
    await expect(log).toBeGreaterThan(0.3);
    await expect(log / linear).toBeGreaterThan(1000);

    // Unmeasured stays unmeasured on BOTH axes — it never becomes a zero.
    await expect(fractionIn('linear', 'Newsletter — forwards')).toBe('null');
    await expect(fractionIn('log', 'Newsletter — forwards')).toBe('null');

    // …and it sorts last without claiming to be the smallest.
    const labels = [
      ...panel('log').querySelectorAll('[data-slot="meter-row"]'),
    ].map((row) => row.getAttribute('data-label'));
    await expect(labels.at(-1)).toBe('Newsletter — forwards');
  },
};

export const Linear: Story = {
  args: { kind: 'linear' },
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
