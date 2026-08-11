'use client';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import * as React from 'react';

import {
  Skeleton,
  SKELETON_VARIANTS,
  type SkeletonVariant,
} from '@interlace/ui/skeleton';
import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';

import { withRtl } from '@/decorators';

/**
 * `skeleton-variants` — the catalogue IS the demonstration.
 *
 * The variant list is a discriminated union and a class map, and it exists
 * so that a loading placeholder reserves the RESTING SILHOUETTE of the thing
 * it replaces. That is a CLS-0 claim (DESIGN_PRINCIPLES #23), and a claim
 * about silhouettes can only be checked by looking at them side by side —
 * which no single-sample story does. Hence every variant, rendered, with the
 * shape classes printed underneath.
 *
 * ─── What "shape-perfect" buys ────────────────────────────────────
 *
 * A centred spinner reserves nothing: the body arrives, the page grows by
 * 300px, and whatever the reader was aiming at moves. Each variant here is
 * dimensioned from the real control — `checkbox` is `size-4` because
 * `checkbox.tsx` is 16px, `switch` is `h-5 w-8` because the track is
 * 1.15rem, `sparkline` is exactly `90×22` so a metric arriving mid-window
 * does not reflow the column around it.
 *
 * ─── Why the list is generated ────────────────────────────────────
 *
 * Every cell below comes from the `SKELETON_VARIANTS` export, and the class
 * list under each one is read back off the rendered element. A variant added
 * to the source appears here on the next reload; a variant whose class entry
 * is missing renders as an unstyled box, visibly. `skeleton-variant-coverage-lock`
 * separately asserts that every `<Skeleton variant="x">` call site in the
 * codebase resolves to a member of this array — so a typo fails CI rather
 * than painting nothing.
 *
 * `label={null}` on every cell: the real component announces itself with a
 * visually-hidden "Loading…", which is correct in a page and would be
 * {SKELETON_VARIANTS.length} redundant live regions in a catalogue. The
 * visible caption is the label here.
 */

// ── Grouping ────────────────────────────────────────────────────────────────
//
// The source file groups the union with comment blocks. Comments do not
// survive the import, so the grouping is restated here as data — the only
// hand-maintained thing on the page. It cannot go stale silently: any
// variant missing from a group falls into "Ungrouped", which is rendered.

const GROUPS: ReadonlyArray<{
  title: string;
  note: string;
  members: readonly string[];
}> = [
  {
    title: 'Generic shapes',
    note: 'No specific primitive — reusable filler when nothing more exact fits.',
    members: ['rect', 'circle', 'text', 'paragraph'],
  },
  {
    title: 'Primitive-shaped',
    note: "Matches a primitive's resting silhouette, so the swap changes the contents of the frame and not the frame.",
    members: [
      'avatar',
      'badge',
      'breadcrumb',
      'button',
      'card',
      'code-block',
      'input',
      'menu',
      'pagination',
      'prose',
      'tabs',
      'tag',
      'toc',
    ],
  },
  {
    title: 'Form family',
    note: 'One per form control, dimensioned from the real control: checkbox size-4, switch h-5 w-8, select / input h-9, slider rail h-2.',
    members: [
      'checkbox',
      'form',
      'label',
      'number-field',
      'radio-group',
      'select',
      'slider',
      'switch',
      'textarea',
    ],
  },
  {
    title: 'Pattern-shaped',
    note: "A whole composed surface. `data-table` is the one most often left as a centred spinner — which reserves nothing and guarantees the shift.",
    members: [
      'article-card',
      'author-byline',
      'data-table',
      'newsletter-form',
      'page-header',
      'prev-next-post',
      'stat-card',
    ],
  },
  {
    title: 'Chart-shaped',
    note: 'A data surface is always in flight on first paint. `chart` matches the 220-unit drawing height; `sparkline` reserves the exact 90×22 inline cell.',
    members: ['chart', 'metric-table', 'sparkline'],
  },
  {
    title: 'Absence vocabulary',
    note: 'Composites whose shape lives entirely in the body — both are transparent at the root, because a filled root would paint a block behind the parts.',
    members: ['meter', 'stat-strip'],
  },
];

const GROUPED = new Set(GROUPS.flatMap((group) => group.members));
const UNGROUPED = SKELETON_VARIANTS.filter((name) => !GROUPED.has(name));

// ── A cell ──────────────────────────────────────────────────────────────────

/**
 * The class list is read back OFF THE RENDERED ROOT rather than imported
 * from `SKELETON_VARIANT_CLASSES`.
 *
 * Two reasons, and the second is the better one. `skeleton.tsx` re-exports
 * the union and the tuple but not the class map, and deep-importing a path
 * a consumer cannot spell would be documenting an API that does not exist.
 * More usefully: what a reader wants to know is what actually landed on the
 * element — base classes, shape classes and any composite handling
 * together — and that is a question only the DOM can answer.
 */
function VariantCell({ name }: { name: SkeletonVariant }) {
  const host = React.useRef<HTMLDivElement>(null);
  const [applied, setApplied] = React.useState('');

  React.useEffect(() => {
    const root = host.current?.firstElementChild;
    setApplied(root ? root.className : '');
  }, []);

  return (
    <div
      className="rounded-md border border-border bg-background p-sm"
      data-slot="skeleton-variant"
      data-variant={name}
    >
      <Stack gap="xs">
        <Typography variant="code" as="code" className="font-semibold">
          {name}
        </Typography>
        <div className="flex min-h-16 items-center" ref={host}>
          <Skeleton variant={name} label={null} />
        </div>
        <Typography
          variant="caption"
          tone="muted"
          as="code"
          className="break-all font-mono"
        >
          {applied || '…'}
        </Typography>
      </Stack>
    </div>
  );
}

function Group({
  title,
  note,
  members,
}: {
  title: string;
  note: string;
  members: readonly string[];
}) {
  return (
    <Box
      border
      radius="md"
      padding="md"
      className="bg-background"
      data-slot="skeleton-group-panel"
    >
      <Stack gap="sm">
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            {title} · {members.length}
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            {note}
          </Typography>
        </Stack>
        <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
          {members.map((name) => (
            <VariantCell key={name} name={name as SkeletonVariant} />
          ))}
        </div>
      </Stack>
    </Box>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

function Specimen() {
  return (
    <Stack gap="lg" className="w-full" data-slot="skeleton-variants-specimen">
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          Skeleton variants — {SKELETON_VARIANTS.length} silhouettes
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          Generated from the <code className="font-mono">
            SKELETON_VARIANTS
          </code>{' '}
          export, with the class list that actually landed on each element
          read back off the DOM underneath it. The point of a variant per
          control is CLS = 0: the
          placeholder reserves the exact resting geometry of the thing that
          replaces it, so nothing on the page moves when the data lands.
        </Typography>
      </Stack>

      {GROUPS.map((group) => (
        <Group key={group.title} {...group} />
      ))}

      {UNGROUPED.length > 0 ? (
        <Group
          title="Ungrouped"
          note="Present in SKELETON_VARIANTS but not in this page's grouping table — add it above."
          members={UNGROUPED}
        />
      ) : null}
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Contracts/Skeleton Variants',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Every skeleton silhouette at once, generated from the `SKELETON_VARIANTS` export with the class list that actually landed on each element read back off the DOM. A variant list only earns its complexity if the placeholders are shape-perfect — `checkbox` is `size-4` because the real checkbox is 16px, `sparkline` is exactly 90×22 so a metric arriving mid-window does not reflow its column — and that is a claim you can only check by seeing them together. `label={null}` throughout: the component announces itself with a visually-hidden "Loading…", which is right in a page and would be forty-seven redundant live regions in a catalogue.',
      },
    },
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  tags: ['preview'],
  play: async ({ canvasElement }) => {
    const cells = canvasElement.querySelectorAll(
      '[data-slot="skeleton-variant"]',
    );
    // Every member of the union is rendered exactly once — the grouping
    // table above cannot silently drop one.
    await expect(cells.length).toBe(SKELETON_VARIANTS.length);
    await expect(
      [...cells].map((cell) => cell.getAttribute('data-variant')).sort(),
    ).toEqual([...SKELETON_VARIANTS].sort());

    // And the classes actually reached the DOM: an unstyled catalogue looks
    // like a design decision rather than a broken CSS build.
    const avatar = canvasElement.querySelector(
      '[data-variant="avatar"] [data-slot="skeleton"]',
    ) as HTMLElement;
    await expect(avatar.getBoundingClientRect().width).toBeGreaterThan(20);
    await expect(avatar.getBoundingClientRect().width).toBeLessThan(100);
  },
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
