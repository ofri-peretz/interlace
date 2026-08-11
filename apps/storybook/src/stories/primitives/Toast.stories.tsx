import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Toast,
  ToastProvider,
  ToastTitle,
  ToastDescription,
  ToastTrigger,
  MIN_VIEWPORT,
} from '@interlace/ui/toast';
import { Button } from '@interlace/ui/button';
import { Info, CheckCircle2, AlertTriangle, OctagonAlert } from 'lucide-react';
import { withRtl } from '@/decorators';

/**
 * Transient, dismissible notification surfaced via a portal. Per
 * `ERROR_PHILOSOPHY.md` + `MOTION_PHILOSOPHY.md`, every tone must read
 * without colour alone (paired icon + label) and animate within the
 * reduced-motion budget. MIN_VIEWPORT = 320px — toasts must remain
 * legible on a 320 CSS-px iPhone SE.
 */
const meta = {
  title: 'Primitives/Toast',
  component: Toast,
  tags: ['autodocs'],
  parameters: {
    // NOT `centered`: a toast panel is a width-filling surface, and centered
    // sizes the story root to content, so the 420px stack outgrows a 375px
    // viewport instead of clamping to it.
    layout: 'padded',
    docs: {
      description: {
        component:
          'Confirms that something the user just did completed, without taking over the page. It is transient and portal-mounted, so it must never be the only place a fact appears and must never hold the only way to recover from an error — that belongs in an Alert or a Dialog. The tone is a 4px accent strip only; pass an icon as a child so the meaning survives without colour (`ERROR_PHILOSOPHY.md`). Passing a `toast` object hands lifecycle, focus and `aria-live` to Base UI\'s manager; omitting it renders the same surface statically, which is what these stories do.',
      },
    },
  },
  argTypes: {
    tone: {
      control: 'select',
      options: ['info', 'success', 'warning', 'danger'],
      description:
        'Semantic accent strip down the left edge. The strip is the only tone-coloured channel — the body stays neutral so the tone reads as reinforcement beside the icon, never as the sole carrier of meaning.',
      table: {
        category: 'Appearance',
        type: { summary: "'info' | 'success' | 'warning' | 'danger'" },
        defaultValue: { summary: "'info'" },
      },
    },
    toast: {
      control: false,
      description:
        'The Base UI toast object from `useToastManager().toasts[i]`. With it, Base UI owns the timer, swipe-to-dismiss, focus and `aria-live`; without it the component degrades to a plain styled `<div>` for static rendering.',
      table: { category: 'Data', type: { summary: 'Toast.Root["toast"]' } },
    },
    children: {
      control: false,
      description:
        'An icon, then a column of `ToastTitle` + `ToastDescription`, then an optional `ToastClose`.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description:
        'Merged after the tone and animation classes. The width comes from the viewport container, not from here.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  args: {
    tone: 'info',
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

const TONES = [
  {
    tone: 'info' as const,
    Icon: Info,
    title: 'Sync running',
    description: 'Refreshing the article cache in the background.',
  },
  {
    tone: 'success' as const,
    Icon: CheckCircle2,
    title: 'Saved',
    description: 'Your preferences were updated.',
  },
  {
    tone: 'warning' as const,
    Icon: AlertTriangle,
    title: 'Cache stale',
    description: 'Article counts are more than 7 days old.',
  },
  {
    tone: 'danger' as const,
    Icon: OctagonAlert,
    title: 'Sync failed',
    description: 'Falling back to last successful snapshot.',
  },
];

const TONE_ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
} as const;

/**
 * The surface itself, rendered visible rather than behind a trigger — a
 * toast is the thing worth looking at, and a "Fire toast" button alone in a
 * canvas shows nothing. Static path (no `toast` prop), so the screenshot is
 * deterministic and the `tone` control repaints the accent strip and swaps
 * the paired icon live.
 */
export const Default: Story = {
  args: { tone: 'success' },
  render: (args) => {
    // Static screenshot story — uses ToastTitle / ToastDescription as
    // normal. They detect the absence of a ToastProvider context (via
    // the internal ToastStaticContext set by the Toast root's static
    // path) and render plain <h2> / <p> instead of reaching for Base
    // UI's Title / Description (which would throw #66 without an active
    // toast object). The styling + data-slot stay identical to the
    // imperative path so visual + axe assertions still hold.
    const Icon = TONE_ICON[args.tone ?? 'info'];
    const copy = TONES.find((entry) => entry.tone === (args.tone ?? 'info'))!;
    return (
      <div className="w-full max-w-float">
        <Toast {...args}>
          <Icon className="size-4" aria-hidden />
          <div className="flex flex-col gap-xs">
            <ToastTitle>{copy.title}</ToastTitle>
            <ToastDescription>{copy.description}</ToastDescription>
          </div>
        </Toast>
      </div>
    );
  },
};

/**
 * All four tones side by side — the comparison that shows the accent strip is
 * the only channel carrying the tone, and that each one is paired with an
 * icon so it reads without colour.
 */
export const Tones: Story = {
  render: () => (
    <div className="flex w-full max-w-float flex-col gap-sm">
      {TONES.map(({ tone, Icon, title, description }) => (
        <Toast key={tone} tone={tone}>
          <Icon className="size-4" aria-hidden />
          <div className="flex flex-col gap-xs">
            <ToastTitle>{title}</ToastTitle>
            <ToastDescription>{description}</ToastDescription>
          </div>
        </Toast>
      ))}
    </div>
  ),
};

/**
 * Imperative trigger — wraps the canvas in `ToastProvider`, renders one
 * `ToastTrigger` per tone. Click any trigger to dispatch the matching
 * toast through the provider's portal.
 */
export const Variants: Story = {
  render: () => (
    <ToastProvider>
      <div className="flex flex-wrap gap-sm">
        {TONES.map(({ tone, title, description }) => (
          <ToastTrigger
            key={tone}
            tone={tone}
            title={title}
            description={description}
            render={<Button variant="outline">Fire {tone}</Button>}
          />
        ))}
      </div>
    </ToastProvider>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

/**
 * Below-min-viewport demo — wrap in a (MIN_VIEWPORT - 1)px container
 * with the `data-interlace-dev` flag so preflight's dashed dev-mode
 * warning outline appears. The toast still renders; the outline is the
 * authoring-time signal that we have dropped below the documented
 * minimum.
 */
export const BelowMinViewport: Story = {
  render: () => (
    <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }}>
      <Toast tone="info">
        <Info className="size-4" aria-hidden />
        <div className="flex flex-col gap-xs">
          <ToastTitle>{`< ${MIN_VIEWPORT}px — dev outline`}</ToastTitle>
          <ToastDescription>
            Toast still renders below the documented minimum viewport.
          </ToastDescription>
        </div>
      </Toast>
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
