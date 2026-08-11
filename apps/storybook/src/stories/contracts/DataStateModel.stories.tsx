'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import {
  DATA_STATES,
  DATA_STATE_PRESENTATION,
  announceDataState,
  replacesBody,
  resolveDataState,
  type DataStateFlags,
  type DataStateName,
} from '@interlace/ui/data-state-model';
import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';
import { Button } from '@interlace/ui/button';

import { withRtl } from '@/decorators';

/**
 * `data-state-model` — the absence vocabulary, as a live table.
 *
 * This is the most differentiated idea in the system and, until now, the one
 * with no picture. The claim is simple and unusual: **absence is a
 * vocabulary, not a placeholder.** A cell that is empty because nobody ran
 * the job is a different fact from a cell that is empty because the job
 * returned zero, which is a different fact again from a cell that is still
 * loading — and rendering any of them as `0` is a lie the reader cannot
 * detect.
 *
 * `charts/scale.ts` already encodes half of this for arithmetic (`null` is
 * unmeasured, never zero, and `numeric()` drops it rather than coercing it).
 * This module is the same statement about pixels.
 *
 * ─── Two kinds of state, which is what makes precedence tractable ─
 *
 * REPLACING states answer "there is nothing here to show" — the body is
 * swapped for the state itself. QUALIFYING states answer "there IS something
 * here, and here is what is wrong with it" — the body renders, annotated.
 *
 * A resolver that returns one winner throws the second fact away. So
 * `resolveDataState` returns the winner AND every other active state as
 * `qualifiers`, and the announcement concatenates them: a partial-coverage
 * result that is also truncated says so twice, because it is wrong twice.
 * The playground below is built to make that visible — tick both flags and
 * watch the sentence grow.
 *
 * ─── Precedence is the array ──────────────────────────────────────
 *
 * `DATA_STATES` IS the order — lowest index wins — so reading down the table
 * is reading the rule, and the two cannot drift apart. Two consequences the
 * audit called out by name are pinned by tests and reproducible here:
 * **error beats empty** (a failed fetch is a different message, not "nothing
 * found"), and **truncated is not empty** (they are separate members, and
 * truncated does not replace the body at all).
 *
 * Every column below is read from the module: the glyph and swatch from
 * `DATA_STATE_PRESENTATION`, the sentence from `announceDataState`, the
 * replaces/qualifies split from `replacesBody`. Nothing is transcribed.
 */

// ── The flag playground ─────────────────────────────────────────────────────

const FLAG_ROWS: ReadonlyArray<{
  key: keyof DataStateFlags;
  label: string;
  note: string;
}> = [
  { key: 'loading', label: 'loading', note: 'Nothing is known yet.' },
  { key: 'error', label: 'error', note: 'The fetch failed.' },
  {
    key: 'notApplicable',
    label: 'notApplicable',
    note: 'The metric has no meaning here. Any number, 0 included, is a category error.',
  },
  {
    key: 'notCounted',
    label: 'notCounted',
    note: 'Measurable in principle, deliberately not tallied. This is the hatch.',
  },
  { key: 'empty', label: 'empty', note: 'A complete result with nothing in it.' },
  {
    key: 'partial',
    label: 'partial',
    note: 'Some sources did not report. Every count below is a FLOOR.',
  },
  {
    key: 'truncated',
    label: 'truncated',
    note: 'The list is cut. It must never become a denominator.',
  },
  {
    key: 'firstMeasurement',
    label: 'firstMeasurement',
    note: 'A reading exists, no prior does. Never render this as +0%.',
  },
];

const ANNOUNCE_OPTIONS = {
  noun: 'articles',
  shown: 25,
  coverage: '4 of 9 sources reported',
  reason: 'the repository has no test suite',
};

// ── The state glyph / swatch ────────────────────────────────────────────────
//
// The presentation table says a state carries EITHER a glyph or a hatch
// swatch, never both — a texture and a character competing for the same 12px
// is two marks saying one thing badly. This renders whichever it has.

function StateMark({ state }: { state: DataStateName }) {
  const presentation = DATA_STATE_PRESENTATION[state];

  if (presentation.swatch) {
    return (
      <span
        aria-hidden
        data-slot="state-swatch"
        className={`block size-5 shrink-0 rounded-sm border ${presentation.swatch}`}
      />
    );
  }

  return (
    <span
      aria-hidden
      data-slot="state-glyph"
      className="inline-flex size-5 shrink-0 items-center justify-center font-mono text-ui text-muted-foreground"
    >
      {presentation.glyph || '·'}
    </span>
  );
}

// ── The nine-state table ────────────────────────────────────────────────────

function StateTable() {
  return (
    <Box
      border
      radius="md"
      padding="md"
      className="bg-background"
      data-slot="data-state-table"
    >
      <Stack gap="sm">
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            The union, in precedence order
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            Lowest index wins. Reading down this table is reading the rule —{' '}
            <code className="font-mono">DATA_STATES</code> is both.
          </Typography>
        </Stack>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <caption className="sr-only">
              The nine data states, their marks, whether they replace or
              qualify the body, and the sentence each announces.
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-sm text-ui-sm font-semibold">
                  #
                </th>
                <th scope="col" className="py-2 pr-sm text-ui-sm font-semibold">
                  Mark
                </th>
                <th scope="col" className="py-2 pr-sm text-ui-sm font-semibold">
                  State
                </th>
                <th scope="col" className="py-2 pr-sm text-ui-sm font-semibold">
                  Body
                </th>
                <th scope="col" className="py-2 pr-sm text-ui-sm font-semibold">
                  Emphasis
                </th>
                <th scope="col" className="py-2 text-ui-sm font-semibold">
                  Announced
                </th>
              </tr>
            </thead>
            <tbody>
              {DATA_STATES.map((state, index) => {
                const presentation = DATA_STATE_PRESENTATION[state];
                const sentence = announceDataState(state, ANNOUNCE_OPTIONS);
                return (
                  <tr
                    key={state}
                    className="border-b border-border last:border-b-0 align-top"
                    data-slot="data-state-row"
                    data-state-name={state}
                  >
                    <td className="py-2 pr-sm font-mono text-caption text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="py-2 pr-sm">
                      <span
                        className={`inline-flex items-center gap-xs rounded-full border px-2 py-0.5 text-caption ${presentation.chip}`}
                      >
                        <StateMark state={state} />
                        {presentation.short || '—'}
                      </span>
                    </td>
                    <td className="py-2 pr-sm">
                      <code className="font-mono text-code">{state}</code>
                    </td>
                    <td className="py-2 pr-sm text-ui-sm">
                      {state === 'idle'
                        ? 'renders (resting)'
                        : replacesBody(state)
                          ? 'replaced'
                          : 'qualified'}
                    </td>
                    <td className="py-2 pr-sm font-mono text-caption text-muted-foreground">
                      {presentation.emphasis}
                    </td>
                    <td className="py-2 text-ui-sm text-muted-foreground">
                      {sentence || <em>(none — idle is the absence of absence)</em>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Typography variant="caption" tone="muted" className="max-w-prose">
          Read the Body and Emphasis columns down and the doctrine is visible:{' '}
          <code className="font-mono">not-counted</code> is the only hatch that
          REPORTS (a run that did not happen),{' '}
          <code className="font-mono">not-applicable</code> hatches faintly and
          recedes (it was never going to happen), and{' '}
          <code className="font-mono">first-measurement</code> is the only
          absence that earns the accent — because it is the only one the
          reader can act on, by measuring again tomorrow.
        </Typography>
      </Stack>
    </Box>
  );
}

// ── The resolver playground ─────────────────────────────────────────────────

function Playground({ initial }: { initial: DataStateFlags }) {
  const [flags, setFlags] = React.useState<DataStateFlags>(initial);
  React.useEffect(() => setFlags(initial), [initial]);

  const resolved = resolveDataState(flags, ANNOUNCE_OPTIONS);

  return (
    <Box
      border
      radius="md"
      padding="md"
      className="bg-card"
      data-slot="data-state-playground"
    >
      <Stack gap="md">
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            The resolver
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            Tick flags and watch{' '}
            <code className="font-mono">resolveDataState</code> pick a winner
            AND keep the rest. Try <code className="font-mono">error</code> +{' '}
            <code className="font-mono">empty</code> (error wins — a failed
            fetch is not &ldquo;nothing found&rdquo;), then{' '}
            <code className="font-mono">partial</code> +{' '}
            <code className="font-mono">truncated</code> (neither replaces the
            body, and the sentence says both).
          </Typography>
        </Stack>

        <fieldset className="rounded-md border border-border p-sm">
          <legend className="px-1 text-ui-sm font-semibold">Flags</legend>
          <div className="grid gap-xs sm:grid-cols-2">
            {FLAG_ROWS.map((row) => (
              <label
                key={row.key}
                className="flex items-start gap-xs rounded-md p-1 text-ui-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-primary"
                  checked={Boolean(flags[row.key])}
                  data-slot="flag-input"
                  data-flag={row.key}
                  onChange={(event) =>
                    setFlags((current) => ({
                      ...current,
                      [row.key]: event.target.checked,
                    }))
                  }
                />
                <span>
                  <code className="font-mono text-code">{row.label}</code>
                  <span className="block text-caption text-muted-foreground">
                    {row.note}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFlags({ error: true, empty: true })}
          >
            error + empty
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFlags({ partial: true, truncated: true })}
          >
            partial + truncated
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setFlags({})}>
            Clear
          </Button>
        </div>

        <div className="grid gap-sm md:grid-cols-2">
          <div className="rounded-md border border-border bg-background p-sm">
            <Stack gap="xs">
              <Typography variant="caption" tone="muted">
                resolved
              </Typography>
              <Typography variant="code" as="code" data-slot="resolved-state">
                state: {resolved.state}
              </Typography>
              <Typography variant="code" as="code" data-slot="resolved-qualifiers">
                qualifiers: [{resolved.qualifiers.join(', ')}]
              </Typography>
              <Typography variant="code" as="code" data-slot="resolved-replaces">
                replaces: {String(resolved.replaces)}
              </Typography>
            </Stack>
          </div>

          <div className="rounded-md border border-border bg-background p-sm">
            <Stack gap="xs">
              <Typography variant="caption" tone="muted">
                announcement — what a screen reader hears
              </Typography>
              <Typography variant="ui-sm" data-slot="resolved-announcement">
                {resolved.announcement || (
                  <em className="text-muted-foreground">
                    (silent — idle announces nothing, because there is nothing
                    wrong to say)
                  </em>
                )}
              </Typography>
            </Stack>
          </div>
        </div>

        <Typography variant="caption" tone="muted" className="max-w-prose">
          A hatch pattern that exists only in pixels is invisible to a screen
          reader, which would leave the distinction between &ldquo;no
          run&rdquo; and &ldquo;zero&rdquo; alive for sighted users and gone
          for everyone else. Every state therefore owes a sentence, and the
          sentence says what the absence MEANS rather than naming the state —{' '}
          <em>&ldquo;this is not a zero&rdquo;</em> is doing real work.
        </Typography>
      </Stack>
    </Box>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

type DataStateModelArgs = {
  flags: DataStateFlags;
};

function Specimen({ flags }: DataStateModelArgs) {
  return (
    <Stack gap="lg" className="w-full" data-slot="data-state-model-specimen">
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          The absence vocabulary — {DATA_STATES.length} states
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          A diagonal hatch means <em>no run happened</em> — a different fact
          from a run that returned zero, and a very different fact from a run
          that is still going. A dashed outline means{' '}
          <em>planned, not yet approached</em>; solid means real. Never render
          a missing prior as <code className="font-mono">0</code>; a truncated
          list must never be a denominator; when coverage is partial, treat
          every count as a floor.
        </Typography>
      </Stack>

      <StateTable />
      <Playground initial={flags} />
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Contracts/Data State Model',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The nine-state absence vocabulary as a live table plus a working resolver. Every column is read from the module — glyph and hatch swatch from `DATA_STATE_PRESENTATION`, sentence from `announceDataState`, the replaces/qualifies split from `replacesBody` — and `DATA_STATES` IS the precedence order, so reading down the table is reading the rule. The playground exists because the interesting behaviour is co-occurrence: `resolveDataState` returns a winner AND keeps every other active state as a qualifier, so a partially-covered list that is also truncated announces both facts. Tick `error` + `empty` (error wins — a failed fetch is not "nothing found") and `partial` + `truncated` (neither replaces the body) to see the two rules the phase-10 audit named.',
      },
    },
  },
  argTypes: {
    flags: {
      control: 'object',
      description:
        'Starting flag bag for the resolver. Deliberately NOT a single `state` enum: the whole point is that these co-occur, and an enum forces the caller to pick one fact and drop the other.',
      table: {
        category: 'Data',
        type: { summary: 'DataStateFlags' },
      },
    },
  },
  args: {
    flags: { partial: true, truncated: true },
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The thumbnail: the whole union plus the resolver, starting on the
 * co-occurrence case that a one-winner resolver would report as half true.
 */
export const Default: Story = {
  tags: ['preview'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const text = (slot: string) =>
      canvasElement.querySelector(`[data-slot="${slot}"]`)?.textContent ?? '';

    // Every member of the union has a row, and the order is the precedence.
    const rows = canvasElement.querySelectorAll('[data-slot="data-state-row"]');
    await expect(
      [...rows].map((row) => row.getAttribute('data-state-name')),
    ).toEqual([...DATA_STATES]);

    // partial + truncated: neither replaces the body, and BOTH are announced.
    await expect(text('resolved-state')).toContain('partial');
    await expect(text('resolved-qualifiers')).toContain('truncated');
    await expect(text('resolved-replaces')).toContain('false');
    await expect(text('resolved-announcement')).toContain('floor');
    await expect(text('resolved-announcement')).toContain('denominator');

    // error beats empty — the rule that stops a failed fetch reading as
    // "nothing found".
    await userEvent.click(canvas.getByRole('button', { name: 'error + empty' }));
    await waitFor(() => expect(text('resolved-state')).toContain('error'));
    await expect(text('resolved-qualifiers')).toContain('empty');
    await expect(text('resolved-replaces')).toContain('true');

    // Back to the resting composition the thumbnail shows.
    await userEvent.click(
      canvas.getByRole('button', { name: 'partial + truncated' }),
    );
    await waitFor(() => expect(text('resolved-state')).toContain('partial'));
  },
};

/** Nothing is wrong. The resolver is silent, and that is the correct output. */
export const Idle: Story = {
  args: { flags: {} },
};

export const Dark: Story = {
  args: { flags: { partial: true, truncated: true } },
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
