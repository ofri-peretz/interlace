'use client';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { PlusIcon } from 'lucide-react';

import { buttonVariants, type VariantProps } from '@interlace/ui/button-variants';
import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';

import { withRtl } from '@/decorators';

/**
 * `button-variants` — the catalogue IS the demonstration.
 *
 * `buttonVariants` is a pure CVA function: class strings in, class string
 * out, no React and no client APIs. It ships as its own registry item —
 * separate from `button` — for one concrete reason: `button.tsx` is
 * `'use client'` (Base UI `useRender`), and a server component that wants a
 * link to LOOK like a button must not drag a client component in to get the
 * classes. `<Link className={buttonVariants({ variant: 'outline' })}>` is the
 * whole use case, and it is server-safe.
 *
 * Which makes the full grid the only honest picture of it. A single sample
 * shows one of forty-eight cells; the surface is 6 variants × 8 sizes, and
 * the thing a consumer needs to see is all of it at once — which sizes are
 * icon-only, which variants carry their own surface, which one is a link in
 * disguise.
 *
 * ─── The `outline` note is a bug this repo shipped, twice ─────────
 *
 * `outline` paints an opaque surface (`bg-background`) but was the only such
 * variant that did NOT also set a foreground, so it inherited one. Dropped
 * inside a section that flips the text colour — `<CTASection tone="primary">`
 * is `bg-primary text-primary-foreground` — the button kept the page
 * background and took the section's white text: **1.05:1, invisible.**
 *
 * Adding `text-foreground` fixed the light scheme and left the dark one
 * broken, because declaring a foreground only means something if the surface
 * under it is opaque. `outline` also carried stock shadcn's
 * `dark:bg-input/30`, which overrode `bg-background` with a 30% tint — so on
 * the same branded section the primary colour bled through and
 * `text-foreground` measured **2:1**. `ghost` had the identical defect on
 * hover (`dark:hover:bg-accent/50`, 3.07:1).
 *
 * Both are gone now, and dark simply does what light already did: no fill,
 * the control identified by its border.
 *
 * `link` was the same bug with the alpha taken all the way to zero — a
 * declared `text-primary` over no surface at all, so on the same section it
 * was `#7d350c` on `#7d350c`: **1.00:1**, the button exactly the colour of its
 * own background. It inherits its colour now and underlines at rest.
 *
 * The rule, stated so it is checkable: **a variant either declares an opaque
 * surface AND the foreground on it, or declares neither and inherits both.**
 * Declaring only a foreground is the broken third case, because a button is
 * dropped onto surfaces the design system does not control.
 * `composite-contrast-lock` composites every droppable variant — button,
 * badge, tag, grade badge — over every brandable backdrop and asserts it.
 *
 * The tinted panel below paints all of it for real, in both schemes.
 */

// ── The axes ────────────────────────────────────────────────────────────────
//
// Listed rather than introspected: CVA does not expose its config at
// runtime. Typing them against `VariantProps<typeof buttonVariants>` is what
// keeps the list honest — renaming or removing a variant in the source turns
// these arrays into a compile error rather than a silently short catalogue.

type Variant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
type Size = NonNullable<VariantProps<typeof buttonVariants>['size']>;

const VARIANTS: readonly Variant[] = [
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
];

const SIZES: readonly Size[] = [
  'default',
  'xs',
  'sm',
  'lg',
  'icon',
  'icon-xs',
  'icon-sm',
  'icon-lg',
];

const isIconSize = (size: Size): boolean => String(size).startsWith('icon');

// ── A cell ──────────────────────────────────────────────────────────────────
//
// A real `<button>` with the generated className and nothing else — no
// `Button` component — because what is under test is the class string, not
// the primitive that usually consumes it.

function Cell({ variant, size }: { variant: Variant; size: Size }) {
  const icon = isIconSize(size);
  return (
    <button
      type="button"
      className={buttonVariants({ variant, size })}
      aria-label={icon ? `Add — ${variant} ${size}` : undefined}
      data-slot="variant-cell"
      data-variant={variant}
      data-size={size}
    >
      {icon ? <PlusIcon aria-hidden /> : String(size)}
    </button>
  );
}

// ── The grid ────────────────────────────────────────────────────────────────

function Matrix() {
  return (
    <Stack gap="md" data-slot="button-variants-matrix">
      {VARIANTS.map((variant) => (
        <Box
          key={variant}
          border
          radius="md"
          padding="sm"
          className="bg-background"
          data-slot="variant-row"
        >
          <Stack gap="sm">
            <Typography variant="code" as="code" className="font-semibold">
              variant=&quot;{variant}&quot;
            </Typography>
            <div className="flex flex-wrap items-center gap-sm">
              {SIZES.map((size) => (
                <Cell key={String(size)} variant={variant} size={size} />
              ))}
            </div>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

// ── The server-component case ───────────────────────────────────────────────

function LinkPanel() {
  const className = buttonVariants({ variant: 'outline', size: 'sm' });
  return (
    <Box
      border
      radius="md"
      padding="md"
      className="bg-background"
      data-slot="button-variants-link"
    >
      <Stack gap="sm">
        <Typography variant="h4" as="h3">
          Why it is its own item
        </Typography>
        <Typography variant="ui-sm" tone="muted" className="max-w-prose">
          The <code className="font-mono">Button</code> component is{' '}
          <code className="font-mono">&apos;use client&apos;</code>. This
          function is not — so a server-rendered page can paint an anchor,
          a <code className="font-mono">next/link</code>, or a form submit as
          a button without shipping any component JS for it.
        </Typography>
        <div className="flex flex-wrap items-center gap-sm">
          <a href="#button-variants" className={className}>
            An anchor that looks like a button
          </a>
        </div>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-sm">
          <code
            className="font-mono text-code whitespace-pre-wrap break-all"
            data-slot="button-variants-classes"
          >
            {className}
          </code>
        </pre>
      </Stack>
    </Box>
  );
}

// ── The composition bug ─────────────────────────────────────────────────────

function TintedPanel() {
  return (
    <Box
      border
      radius="md"
      padding="md"
      className="border-warning/40 bg-warning/10"
      data-slot="button-variants-tinted"
    >
      <Stack gap="sm">
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            An opaque surface owns its foreground
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            The block below is{' '}
            <code className="font-mono">bg-primary text-primary-foreground</code>
            , exactly like{' '}
            <code className="font-mono">
              &lt;CTASection tone=&quot;primary&quot;&gt;
            </code>
            . A variant dropped in here inherits that light text unless it
            sets its own — which is how{' '}
            <code className="font-mono">outline</code> once rendered at{' '}
            <strong>1.05:1</strong>: it painted{' '}
            <code className="font-mono">bg-background</code> and never declared
            a foreground. Both buttons below are the composition that broke.
            Switch this story to the dark scheme and they must stay legible.
          </Typography>
        </Stack>

        <div className="rounded-md bg-primary p-md text-primary-foreground">
          <div className="flex flex-wrap items-center gap-sm">
            <span className="text-ui-sm">Ready to install?</span>
            <a
              href="#button-variants"
              className={buttonVariants({ variant: 'secondary' })}
              data-slot="tinted-safe-cta"
            >
              Copy the command
            </a>
            <a
              href="#button-variants"
              className={buttonVariants({ variant: 'outline' })}
              data-slot="tinted-outline-cta"
            >
              Read the docs
            </a>
            <a
              href="#button-variants"
              className={buttonVariants({ variant: 'link' })}
              data-slot="tinted-link-cta"
            >
              Or skip it
            </a>
          </div>
        </div>

        <Typography variant="ui-sm" tone="muted" className="max-w-prose">
          <strong>
            Declaring a foreground was only half the contract.
          </strong>{' '}
          The surface has to be opaque for it to mean anything, and{' '}
          <code className="font-mono">outline</code> also carried stock
          shadcn&rsquo;s <code className="font-mono">dark:bg-input/30</code> —
          30% translucent, so in the dark scheme this section&rsquo;s primary
          colour bled through and{' '}
          <code className="font-mono">text-foreground</code> landed on it at{' '}
          <strong>2:1</strong>. Dropping that tint is a deliberate deviation
          from stock, like the one on{' '}
          <code className="font-mono">destructive</code>: dark now does what
          light always did — no fill, the control read from its{' '}
          <code className="font-mono">dark:border-input</code> boundary at
          3.35:1. <code className="font-mono">ghost</code> lost{' '}
          <code className="font-mono">dark:hover:bg-accent/50</code> for the
          same reason (3.07:1 on hover).
        </Typography>

        <Typography variant="ui-sm" tone="muted" className="max-w-prose">
          <strong>
            The third button is the other legal shape, not a third fix.
          </strong>{' '}
          <code className="font-mono">link</code> paints no surface, so it
          cannot name a colour either — stock&rsquo;s{' '}
          <code className="font-mono">text-primary</code> put{' '}
          <code className="font-mono">#7d350c</code> on{' '}
          <code className="font-mono">#7d350c</code> here, <strong>1.00:1</strong>,
          the button exactly the colour of its own background. It now inherits
          the section&rsquo;s foreground and carries its affordance in a
          persistent underline, which is what{' '}
          <code className="font-mono">Prose</code> already does for links and
          retires a colour-only cue besides. So a variant either declares{' '}
          <em>both</em> an opaque surface and the text on it, or declares{' '}
          <em>neither</em> — declaring only a foreground is the broken third
          case, and it is what every defect on this panel had in common.
        </Typography>
      </Stack>
    </Box>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

type ButtonVariantsArgs = {
  variant: Variant;
  size: Size;
};

function Specimen({ variant, size }: ButtonVariantsArgs) {
  const picked = buttonVariants({ variant, size });

  return (
    <Stack
      gap="lg"
      className="w-full"
      id="button-variants"
      data-slot="button-variants-specimen"
    >
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          buttonVariants — {VARIANTS.length} variants × {SIZES.length} sizes
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          A pure CVA function, so the catalogue is the documentation: every
          cell below is a bare{' '}
          <code className="font-mono">&lt;button&gt;</code> carrying nothing
          but the generated class string.
        </Typography>
      </Stack>

      <Box
        border
        radius="md"
        padding="md"
        className="bg-card"
        data-slot="button-variants-picked"
      >
        <Stack gap="sm">
          <Typography variant="h4" as="h3">
            <code className="font-mono">
              buttonVariants({'{'} variant: &quot;{variant}&quot;, size:
              &quot;{String(size)}&quot; {'}'})
            </code>
          </Typography>
          <div>
            <button
              type="button"
              className={picked}
              aria-label={isIconSize(size) ? 'Add' : undefined}
            >
              {isIconSize(size) ? <PlusIcon aria-hidden /> : 'The picked combo'}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-sm">
            <code className="font-mono text-code whitespace-pre-wrap break-all">
              {picked}
            </code>
          </pre>
        </Stack>
      </Box>

      <Matrix />
      <TintedPanel />
      <LinkPanel />
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Contracts/Button Variants',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The whole 6 × 8 surface at once, because a variant function has no single representative sample. Every cell is a bare `<button>` carrying only the generated class string — no `Button` component — since what is documented is the string. It ships as a registry item separate from `button` because `button.tsx` is `\'use client\'` and a server component must be able to paint `<Link className={buttonVariants(...)}>` without pulling a client component in for it. The "opaque surface owns its foreground" panel reproduces a defect this repo shipped twice: `outline` painted `bg-background` and inherited its text colour, so inside a `bg-primary text-primary-foreground` section it rendered at 1.05:1 — invisible. Adding `text-foreground` fixed light and left dark broken, because `dark:bg-input/30` made the surface 30% translucent and the section bled through at 2:1 (`ghost` had the same defect on hover, 3.07:1). Both `dark:` tints are dropped — a deliberate deviation from stock shadcn, like the one on `destructive` — so the panel now paints the real composition in both schemes instead of describing it.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: VARIANTS,
      description:
        'Surface + intent. `link` is the odd one out — no surface at all, it is a text link wearing the button geometry.',
      table: {
        category: 'Variants',
        type: { summary: VARIANTS.join(' | ') },
        defaultValue: { summary: 'default' },
      },
    },
    size: {
      control: 'select',
      options: SIZES,
      description:
        'Geometry. The four `icon*` sizes are square and expect a lone icon — give them an `aria-label`, since the glyph is the only content.',
      table: {
        category: 'Variants',
        type: { summary: SIZES.map(String).join(' | ') },
        defaultValue: { summary: 'default' },
      },
    },
  },
  args: {
    variant: 'default',
    size: 'default',
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full catalogue — the thumbnail, because no single cell represents it. */
export const Variants: Story = {
  tags: ['preview'],
  play: async ({ canvasElement }) => {
    const cells = canvasElement.querySelectorAll('[data-slot="variant-cell"]');
    await expect(cells.length).toBe(VARIANTS.length * SIZES.length);

    // The defect that shipped: a variant on a branded surface must carry its
    // own foreground, or it inherits the section's. Read the computed colour
    // of the CTA inside the primary block and compare it to the block's own
    // text colour — they must differ, in whichever scheme this story runs.
    const tinted = canvasElement.querySelector(
      '[data-slot="button-variants-tinted"]',
    ) as HTMLElement;
    const surface = tinted.querySelector('.bg-primary') as HTMLElement;

    // Shape 1 — declares BOTH: an opaque surface and the foreground on it.
    // Its colour must differ from the section's (it is not inheriting), and
    // its surface must be fully opaque, which is the half the colour
    // comparison alone cannot see: a translucent variant passes the colour
    // test and still fails contrast because the section shows through.
    // `outline` did exactly that in dark mode at 2:1 — the reason the Dark
    // twin below exists.
    for (const slot of ['tinted-safe-cta', 'tinted-outline-cta']) {
      const cta = tinted.querySelector(`[data-slot="${slot}"]`) as HTMLElement;
      await expect(getComputedStyle(cta).color).not.toBe(
        getComputedStyle(surface).color,
      );
      const bg = getComputedStyle(cta).backgroundColor;
      await expect(bg).not.toContain('rgba');
      await expect(bg).not.toBe('transparent');
    }

    // Shape 2 — declares NEITHER, and the assertions invert accordingly.
    // `link` paints no surface, so the only legible foreground is the one it
    // inherits: its colour must EQUAL the section's, where `text-primary`
    // used to make it 1.00:1 against the very background it sat on.
    const link = tinted.querySelector(
      '[data-slot="tinted-link-cta"]',
    ) as HTMLElement;
    await expect(getComputedStyle(link).color).toBe(
      getComputedStyle(surface).color,
    );
    await expect(getComputedStyle(link).textDecorationLine).toBe('underline');
  },
};

export const Dark: Story = {
  ...Variants,
  tags: [],
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
