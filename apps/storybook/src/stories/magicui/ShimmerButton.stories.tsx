import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ShimmerButton } from '@interlace/ui/magicui/shimmer-button';

/**
 * ShimmerButton stories
 *
 * The component ships TWO independent decorative props:
 *   - `shimmer`   → rotating conic-gradient spark animation
 *   - `highlight` → inset white glow at the bottom edge
 *
 * Each story below either renders a visual permutation of those props OR
 * runs a `play` function that exercises the contract end-to-end (click,
 * keyboard, prop-driven DOM gating). The stories also serve as the visual
 * lock — Chromatic / Storybook test-runner snapshots will catch regressions
 * to layout, color, or animation that the unit tests cannot see.
 */

const meta: Meta<typeof ShimmerButton> = {
  title: 'MagicUI/ShimmerButton',
  component: ShimmerButton,
  tags: ['autodocs'],
  /**
   * The cosmic surface, painted as a REAL ELEMENT rather than via
   * `parameters.backgrounds`.
   *
   * These stories pass translucent fills (`rgba(255,255,255,0.12)`) with
   * `text-white`, which only resolve against something dark. The backgrounds
   * addon used to supply that, but it is disabled repo-wide in
   * `.storybook/preview.ts` (it overrides the token cascade), so the dark
   * surface silently stopped existing — leaving white text composited onto the
   * page background. Under the `harbor` brand palette that is #ffffff on
   * #f8fafb: 1.04:1, invisible, and caught by the theme-matrix a11y gate.
   *
   * A decorator puts the surface in the DOM, so axe scores the contrast the
   * user actually sees, in every theme.
   */
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#0b0418] p-8">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'The hero CTA: a pill that owns its own fill and runs a conic-gradient spark around its border. It is a decoration budget spent in one place — reach for it for the single primary action on a landing surface, and use the plain `Button` everywhere else. Two of these on one screen and neither reads as primary.\n\n' +
          '`shimmer` and `highlight` are gated **independently**, which is the whole reason this fork exists: a secondary CTA can keep the exact pill geometry and drop the animation, or keep the spark and drop the white inset glow that clashes with a non-white fill. Both are removed from the DOM rather than hidden, so `shimmer={false}` costs nothing at runtime.\n\n' +
          'Styling is CSS-variable driven (`--bg`, `--shimmer-color`, `--radius`, `--speed`, `--cut`), so the string props take any valid CSS value — `background` in particular is a full background shorthand, which is how the brand gradient is passed. It is a real `<button>` by default (keyboard, `disabled`, focus all native); `as` swaps the element when the CTA needs to be a link.',
      },
    },
  },
  argTypes: {
    shimmer: {
      control: 'boolean',
      description:
        'Render the rotating spark animation. Independent of `highlight` — when false the spark elements are not mounted at all.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Appearance' },
    },
    highlight: {
      control: 'boolean',
      description:
        'Render the inset bottom-edge glow (`box-shadow: inset 0 -8px 10px var(--shimmer-glow)`). Turn it off for darker or coloured fills, where the inset reads as a smudge rather than a light source.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Appearance' },
    },
    background: {
      control: 'text',
      description:
        'Any CSS background shorthand — a colour, or the brand gradient (`linear-gradient(135deg, #f4794a 0%, #a84c17 100%)`). Piped into `--bg`, which fills both the button and the inner mask, so the spark stays a rim rather than a wash.',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'var(--scrim)' },
        category: 'Appearance',
      },
    },
    shimmerColor: {
      control: 'color',
      description:
        'Colour of the sweeping spark. Keep it a tint of the fill rather than pure white on a coloured background — `#fbb99a` on the orange gradient, `#ffffff` on black.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'var(--scrim-foreground)' }, category: 'Appearance' },
    },
    shimmerSize: {
      control: 'select',
      options: ['0.02em', '0.05em', '0.1em', '0.15em', '0.25em'],
      description:
        'Rim thickness — the inset of the inner mask (`--cut`). Any CSS length works; `em` keeps the rim proportional to the label so it does not thicken when the button is used at a larger font size.',
      table: { type: { summary: 'string' }, defaultValue: { summary: '0.05em' }, category: 'Appearance' },
    },
    shimmerDuration: {
      control: 'select',
      options: ['1s', '2s', '3s', '5s', '8s'],
      description:
        'One full rotation of the spark (`--speed`). Slower is calmer; below ~1.5s the motion competes with the label for attention. All of it is killed by `prefers-reduced-motion` in the global preview CSS.',
      table: { type: { summary: 'string' }, defaultValue: { summary: '3s' }, category: 'Appearance' },
    },
    borderRadius: {
      control: 'select',
      options: ['0px', '6px', '12px', '24px', '100px'],
      description:
        'Fed to `--radius` and used by both the outer shape and the inner mask, so they can never disagree. `100px` is the pill; anything smaller makes the rotating spark visibly corner.',
      table: { type: { summary: 'string' }, defaultValue: { summary: '100px' }, category: 'Appearance' },
    },
    disabled: {
      control: 'boolean',
      description:
        'Native button disabled state — blocks activation by click and by keyboard. Note the decoration keeps animating: if a CTA can be disabled for a meaningful stretch, dim it via `className` too.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
    as: {
      control: 'select',
      options: ['button', 'a'],
      description:
        'Element to render. Use `a` when the CTA navigates — a click handler on a button is not a link, and readers lose middle-click, open-in-new-tab and the status bar. Pass `href` alongside it (untyped here, since the props extend `<button>`).',
      table: { type: { summary: 'React.ElementType' }, defaultValue: { summary: 'button' }, category: 'Appearance' },
    },
    onClick: {
      action: 'click',
      description: 'Native click handler. Does not fire while `disabled`.',
      table: { type: { summary: '(event: MouseEvent) => void' }, category: 'Events' },
    },
    children: {
      control: 'text',
      description:
        'The label. Keep it short — the pill is `whitespace-nowrap`, so a sentence widens the button instead of wrapping.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    className: {
      control: 'text',
      description:
        'Merged last, so it wins over the built-in padding and geometry. This is the seam for sizing (`px-8 py-4`) and for a disabled-state dim.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ShimmerButton>;

export const Default: Story = {
  args: {
    children: 'Get Started',
    shimmer: true,
    highlight: true,
    background: 'rgba(0, 0, 0, 1)',
    shimmerColor: '#ffffff',
    shimmerSize: '0.05em',
    shimmerDuration: '3s',
    borderRadius: '100px',
    disabled: false,
    as: 'button',
  },
};

export const StaticPill: Story = {
  name: 'Static pill (shimmer={false} highlight={false})',
  args: {
    children: 'GitHub',
    shimmer: false,
    highlight: false,
    background: 'rgba(255, 255, 255, 0.12)',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Hero secondary pattern: same pill geometry as the animated primary, no decoration. Pair with the Default story to verify sibling parity by eye.',
      },
    },
  },
};

export const SparkOnly: Story = {
  name: 'Spark on, highlight off',
  args: {
    children: 'Animated, no glow',
    shimmer: true,
    highlight: false,
    background: 'linear-gradient(135deg, #f4794a 0%, #a84c17 100%)',
  },
};

export const HighlightOnly: Story = {
  name: 'Spark off, highlight on',
  args: {
    children: 'Glow, no spin',
    shimmer: false,
    highlight: true,
  },
};

export const BrandPrimary: Story = {
  name: 'Brand primary (orange gradient)',
  args: {
    children: 'Get Started',
    shimmerColor: '#fbb99a',
    shimmerSize: '0.15em',
    background: 'linear-gradient(135deg, #f4794a 0%, #a84c17 100%)',
  },
};

export const Gallery: Story = {
  name: 'Gallery — all four shimmer/highlight combos',
  parameters: { controls: { hideNoControlsWarning: true } },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <ShimmerButton shimmer highlight>
        On / On
      </ShimmerButton>
      <ShimmerButton shimmer highlight={false}>
        On / Off
      </ShimmerButton>
      <ShimmerButton shimmer={false} highlight>
        Off / On
      </ShimmerButton>
      <ShimmerButton
        shimmer={false}
        highlight={false}
        background="rgba(255, 255, 255, 0.12)"
      >
        Off / Off
      </ShimmerButton>
    </div>
  ),
};

export const ClickInteraction: Story = {
  name: 'Interaction — fires onClick',
  args: {
    children: 'Click me',
    onClick: fn(),
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /click me/i });

    await step('Button is in the document and enabled', async () => {
      await expect(button).toBeInTheDocument();
      await expect(button).toBeEnabled();
    });

    await step('Click triggers the onClick handler', async () => {
      await userEvent.click(button);
      await expect(args.onClick).toHaveBeenCalledTimes(1);
    });

    await step('Subsequent click increments the call count', async () => {
      await userEvent.click(button);
      await expect(args.onClick).toHaveBeenCalledTimes(2);
    });
  },
};

export const KeyboardActivation: Story = {
  name: 'Interaction — keyboard Enter / Space activate',
  args: {
    children: 'Press me',
    onClick: fn(),
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /press me/i });

    await step('Tab focuses the button', async () => {
      await userEvent.tab();
      await expect(button).toHaveFocus();
    });

    await step('Enter activates the button', async () => {
      await userEvent.keyboard('{Enter}');
      await expect(args.onClick).toHaveBeenCalledTimes(1);
    });

    await step('Space activates the button', async () => {
      await userEvent.keyboard(' ');
      await expect(args.onClick).toHaveBeenCalledTimes(2);
    });
  },
};

export const ShimmerPropGatesSpark: Story = {
  name: 'Interaction — `shimmer={false}` removes the spark from the DOM',
  args: {
    children: 'No spark',
    shimmer: false,
    highlight: true,
  },
  play: async ({ canvasElement, step }) => {
    await step(
      'No `.animate-shimmer-slide` (spark) element is mounted',
      async () => {
        await expect(
          canvasElement.querySelector('.animate-shimmer-slide'),
        ).toBeNull();
      },
    );

    await step(
      'No `.animate-spin-around` (inner conic-gradient) element is mounted',
      async () => {
        await expect(
          canvasElement.querySelector('.animate-spin-around'),
        ).toBeNull();
      },
    );

    await step(
      '`highlight` is independent — the white inset shadow IS still in the DOM',
      async () => {
        await expect(canvasElement.innerHTML).toContain(
          'shadow-[inset_0_-8px_10px_var(--shimmer-glow)]',
        );
      },
    );
  },
};

export const HighlightPropGatesGlow: Story = {
  name: 'Interaction — `highlight={false}` removes the white inset glow',
  args: {
    children: 'No glow',
    shimmer: true,
    highlight: false,
  },
  play: async ({ canvasElement, step }) => {
    await step('No inset white shadow class is in the rendered HTML', async () => {
      await expect(canvasElement.innerHTML).not.toContain(
        'shadow-[inset_0_-8px_10px_var(--shimmer-glow)]',
      );
    });

    await step(
      '`shimmer` is independent — the spark IS still in the DOM',
      async () => {
        await expect(
          canvasElement.querySelector('.animate-shimmer-slide'),
        ).not.toBeNull();
      },
    );
  },
};

export const StaticPillHasNoEffects: Story = {
  name: 'Interaction — both off → clean ShimmerButton-shaped pill, no decoration',
  args: {
    children: 'Geometry only',
    shimmer: false,
    highlight: false,
    background: 'rgba(255, 255, 255, 0.12)',
  },
  play: async ({ canvasElement, step }) => {
    await step('Neither decorative effect is in the DOM', async () => {
      await expect(
        canvasElement.querySelector('.animate-shimmer-slide'),
      ).toBeNull();
      await expect(
        canvasElement.querySelector('.animate-spin-around'),
      ).toBeNull();
      await expect(canvasElement.innerHTML).not.toContain(
        'shadow-[inset_0_-8px_10px_var(--shimmer-glow)]',
      );
    });

    await step('Pill geometry survives — px-6 py-3 + border-radius var', async () => {
      await expect(canvasElement.innerHTML).toContain('px-6');
      await expect(canvasElement.innerHTML).toContain('py-3');
      await expect(canvasElement.innerHTML).toContain(
        '[border-radius:var(--radius)]',
      );
    });

    await step('--bg CSS variable carries the consumer background', async () => {
      const root = canvasElement.querySelector(
        '[style*="--bg"]',
      ) as HTMLElement | null;
      await expect(root).not.toBeNull();
      await expect(root!.style.getPropertyValue('--bg')).toBe(
        'rgba(255, 255, 255, 0.12)',
      );
    });
  },
};

export const DisabledIsNotClickable: Story = {
  name: 'Interaction — `disabled` blocks click activation',
  args: {
    children: 'Disabled',
    disabled: true,
    onClick: fn(),
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /disabled/i });

    await step('Button reports disabled state', async () => {
      await expect(button).toBeDisabled();
    });

    await step('Click does NOT fire onClick', async () => {
      await userEvent.click(button);
      await expect(args.onClick).not.toHaveBeenCalled();
    });
  },
};
