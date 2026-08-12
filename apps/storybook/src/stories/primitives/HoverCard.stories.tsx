import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardPortal,
  HoverCardPositioner,
  HoverCardPopup,
  MIN_VIEWPORT,
} from '@interlace/ui/hover-card';
import { Avatar, AvatarFallback, AvatarImage } from '@interlace/ui/avatar';
import { withRtl } from '@/decorators';

/**
 * `HoverCard` is Base UI's `PreviewCard.Root` — a logical container that
 * renders no DOM, so its own API is just the open state. `side` / `align` /
 * `sideOffset` belong to `HoverCardPositioner` and are surfaced here as story
 * args because placement is the decision a consumer actually makes.
 */
type HoverCardStoryArgs = React.ComponentProps<typeof HoverCard> & {
  side: 'top' | 'right' | 'bottom' | 'left' | 'inline-start' | 'inline-end';
  align: 'start' | 'center' | 'end';
  sideOffset: number;
};

const meta: Meta<HoverCardStoryArgs> = {
  title: 'Primitives/HoverCard',
  component: HoverCard,
  subcomponents: { HoverCardPositioner, HoverCardPopup },
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A non-modal preview of what sits behind a link — an author card, a repo summary — opened by hovering or focusing the anchor. It sits between `Tooltip` (one short non-interactive line) and `Popover` (deliberate, click-driven, can hold a form). Hover is a desktop input, so this primitive declares `MIN_VIEWPORT = 768` and preflight flags it below that; on touch widths substitute Popover or Tooltip rather than shrinking this one.',
      },
    },
  },
  argTypes: {
    open: {
      control: 'boolean',
      description:
        'Controlled open state. The stories force it `true` so the popup is visible in autodocs and screenshots — note that while it is set, hover and focus can no longer close the card. Set it to `undefined` for the real uncontrolled behaviour (see `KeyboardFlow`).',
      table: { category: 'State' },
    },
    defaultOpen: {
      control: 'boolean',
      description:
        'Uncontrolled initial state. Ignored while `open` is set.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    onOpenChange: {
      action: 'openChange',
      description:
        'Fires with `(open, eventDetails)`; `eventDetails.reason` distinguishes `trigger-hover` from `trigger-focus`, `escape-key` and `outside-press`.',
      table: { category: 'Events' },
    },
    onOpenChangeComplete: {
      action: 'openChangeComplete',
      description: 'Fires after the open/close animation has finished.',
      table: { category: 'Events' },
    },
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left', 'inline-start', 'inline-end'],
      description:
        'Preferred edge of the anchor to open against — a `HoverCardPositioner` prop. Flips automatically on collision.',
      table: {
        category: 'Positioner',
        type: { summary: "'top' | 'right' | 'bottom' | 'left' | …" },
        defaultValue: { summary: 'bottom' },
      },
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
      description: 'Alignment along the chosen side — a `HoverCardPositioner` prop.',
      table: { category: 'Positioner', defaultValue: { summary: 'center' } },
    },
    sideOffset: {
      control: { type: 'range', min: 0, max: 32, step: 1 },
      description:
        'Gap in pixels between anchor and popup — a `HoverCardPositioner` prop.',
      table: { category: 'Positioner', defaultValue: { summary: '0' } },
    },
    children: {
      control: false,
      description:
        'The Trigger → Portal → Positioner → Popup tree. All four are required: a Popup without the Portal+Positioner middle has no anchor and Base UI throws error #49.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
  },
  args: {
    open: true,
    side: 'bottom',
    align: 'center',
    sideOffset: 8,
    onOpenChange: fn(),
    onOpenChangeComplete: fn(),
  },
};

export default meta;
type Story = StoryObj<HoverCardStoryArgs>;

// ─────────────────────────────────────────────────────────────────
// Shared fixture — a username link + the bio card it opens.
// Kept inline so each story stays self-contained and the structure
// is obvious at a glance.
// ─────────────────────────────────────────────────────────────────
const BioCard = () => (
  <div className="flex gap-md">
    <Avatar className="size-12">
      <AvatarImage src="https://github.com/shadcn.png" alt="" />
      <AvatarFallback>OP</AvatarFallback>
    </Avatar>
    <div className="flex flex-col gap-xs">
      <p className="text-ui-sm font-semibold text-foreground">@ofriperetz</p>
      <p className="text-ui-sm text-muted-foreground">
        Builds the Interlace design system and the ESLint plugin ecosystem
        around it. Lives in tokens, sleeps in flat-config.
      </p>
      <p className="text-ui-xs text-muted-foreground">Joined December 2023</p>
    </div>
  </div>
);

// MUST spread `...props`. Base UI's `render` prop merges the trigger's
// handlers, ARIA wiring, and `data-slot` onto whatever element you hand it —
// a component that ignores its props silently drops all of them, leaving an
// inert trigger. The `open`-forced stories still LOOK right, which is exactly
// why the KeyboardFlow story below is the thing that catches it.
const UsernameLink = (props: React.ComponentProps<'a'>) => (
  <a
    href="#ofriperetz"
    className="text-primary underline-offset-4 hover:underline"
    {...props}
  >
    @ofriperetz
  </a>
);

/**
 * Default story — opens with `open={true}` (Base UI controlled prop) so the
 * popup is visible without hover, which is essential for visual review and
 * for the autodocs page where pointer interaction isn't available.
 *
 * Callout: Tablet-and-up only; reach for Popover on touch devices.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Tablet-and-up only; reach for Popover on touch devices. Rendered with `open={true}` so the popup is visible in autodocs.',
      },
    },
  },
  render: ({ side, align, sideOffset, ...rootProps }) => (
    <HoverCard {...rootProps}>
      <HoverCardTrigger render={<UsernameLink />} />
      <HoverCardPortal>
        <HoverCardPositioner side={side} align={align} sideOffset={sideOffset}>
          <HoverCardPopup className="w-80">
            <BioCard />
          </HoverCardPopup>
        </HoverCardPositioner>
      </HoverCardPortal>
    </HoverCard>
  ),
};

// ─────────────────────────────────────────────────────────────────
// Variants — the single layout axis is `side`; sample the four
// edges rather than enumerating every option. All forced open so
// the placement is visible at a glance.
// ─────────────────────────────────────────────────────────────────
export const Variants: Story = {
  // The registry's thumbnail for this component — see the preview policy in
  // apps/registry/scripts/build-story-map.mjs. Default renders too small to
  // read at thumbnail size.
  tags: ['preview'],
  render: () => (
    <div className="grid grid-cols-1 gap-2xl p-2xl md:grid-cols-2">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <div key={side} className="flex items-center justify-center">
          <HoverCard open>
            <HoverCardTrigger render={<UsernameLink />} />
            <HoverCardPortal>
              <HoverCardPositioner side={side}>
                <HoverCardPopup className="w-80">
                  <BioCard />
                </HoverCardPopup>
              </HoverCardPositioner>
            </HoverCardPortal>
          </HoverCard>
        </div>
      ))}
    </div>
  ),
};

/**
 * Keyboard-only flow: a hover card that ONLY opens on pointer hover is
 * unreachable without a mouse. Focusing the trigger must reveal it, and
 * Escape must dismiss it (WCAG 2.2 §1.4.13).
 */
export const KeyboardFlow: Story = {
  // Uncontrolled — this is the story that proves the real open/close path.
  args: { open: undefined },
  render: () => (
    <HoverCard>
      <HoverCardTrigger render={<UsernameLink />} />
      <HoverCardPortal>
        <HoverCardPositioner>
          <HoverCardPopup className="w-80">
            <BioCard />
          </HoverCardPopup>
        </HoverCardPositioner>
      </HoverCardPortal>
    </HoverCard>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('link', { name: /ofriperetz/i });
    const popup = () =>
      document.querySelector('[data-slot="hover-card-popup"]');

    await step('Focus alone reveals the card', async () => {
      trigger.focus();
      await waitFor(() => expect(popup()).toBeTruthy());
    });

    await step('Escape dismisses it and focus stays on the trigger', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(popup()).toBeFalsy());
      expect(document.activeElement).toBe(trigger);
    });
  },
};

export const Dark: Story = {
  ...Variants,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

/**
 * Below-min-viewport demo — wrap in a `(MIN_VIEWPORT - 1)`px container with
 * the `data-interlace-dev` flag so preflight's dashed warning outline
 * appears. Storybook renders both the warning and the still-functional
 * card; on real touch devices the consumer should switch to Popover.
 */
export const BelowMinViewport: Story = {
  // NOT the meta-level `centered`: centered sizes the story root to its content,
  // so the overflow-x-auto scroller below inherits the 767px frame width instead
  // of the viewport and the whole page scrolls sideways at 375px.
  parameters: { layout: 'padded' },
  render: () => (
    <div className="overflow-x-auto">
      {/* overflow-x-auto: this frame is pinned to a fixed pixel width to trip the
        min-viewport contract, so without an inner scroller it pushes the whole
        page sideways on a 375px phone. */}
      <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }}>
        <HoverCard open>
          <HoverCardTrigger render={<UsernameLink />} />
          <HoverCardPortal>
            <HoverCardPositioner>
              <HoverCardPopup className="w-72">
                <BioCard />
              </HoverCardPopup>
            </HoverCardPositioner>
          </HoverCardPortal>
        </HoverCard>
      </div>
    </div>
  ),
  decorators: [
    (Story) => (
      // Promote the body flag for this story so the preflight selector matches.
      <div
        ref={(node) => {
          if (node && typeof document !== 'undefined') {
            document.body.setAttribute('data-interlace-dev', '');
          }
        }}
      >
        <Story />
      </div>
    ),
  ],
};
