import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@interlace/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The element that performs an action. One `default` button per view is the point — everything competing with it should step down to `secondary`/`outline`/`ghost`, per `CTA_PHILOSOPHY.md`. When the thing being done is navigation, keep the visual weight but pass `render` a `<Link>`/`<a>` so it is a real link for middle-click, keyboard, and crawlers.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description:
        'Emphasis ladder. `destructive` is reserved for irreversible actions and should be paired with an `AlertDialog` confirm.',
      table: {
        category: 'Appearance',
        type: {
          summary:
            "'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'",
        },
        defaultValue: { summary: 'default' },
      },
    },
    size: {
      control: 'select',
      options: [
        'default',
        'xs',
        'sm',
        'lg',
        'icon',
        'icon-xs',
        'icon-sm',
        'icon-lg',
      ],
      description:
        'Height ramp; the `icon*` sizes are square. `xs`/`sm` and `icon-xs` fall under WCAG 2.5.8 target size unless neighbours are spaced ≥24px — see the Sizes story.',
      table: {
        category: 'Appearance',
        type: {
          summary:
            "'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'",
        },
        defaultValue: { summary: 'default' },
      },
    },
    disabled: {
      control: 'boolean',
      description:
        'Blocks pointer events and drops to 50% opacity. There is no `loading` variant — see the Loading story for the canon.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    type: {
      control: 'select',
      options: ['button', 'submit', 'reset'],
      description:
        'Native button type. Inside a `<form>` the browser default is `submit` — set it explicitly when the button must not submit.',
      table: { category: 'State', type: { summary: "'button' | 'submit' | 'reset'" } },
    },
    children: {
      control: 'text',
      description:
        'Label, optionally with a lucide icon sibling (auto-sized per `size`). Icon-only buttons need an `aria-label`.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    onClick: {
      action: 'click',
      description:
        'Native click — passed straight through, never wrapped in a bespoke handler name.',
      table: { category: 'Events' },
    },
    render: {
      control: false,
      description:
        "Replace the rendered element (Base UI render prop; shadcn's `asChild` equivalent). Pass `<Link href=\"…\" />` to keep the styling and get real link semantics.",
      table: { category: 'Slots', type: { summary: 'ReactElement | function' } },
    },
    className: {
      control: 'text',
      description: 'Merged after the variant classes, so it wins on conflicts.',
      table: { category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Get started',
    variant: 'default',
    size: 'default',
    disabled: false,
  },
};
export const Variants: Story = {
  // The registry's thumbnail for this component — see the preview policy in
  // apps/registry/scripts/build-story-map.mjs. Default renders too small to
  // read at thumbnail size.
  tags: ['preview'],
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};
export const Sizes: Story = {
  // xs / sm fall below WCAG 2.5.8's 24×24 *target* threshold but qualify
  // for the *spacing* exception when each target's centre has a 24×24
  // bounding circle that doesn't overlap any other target. Using `gap-6`
  // (24px boundary-to-boundary, well above the 24px-circle requirement)
  // satisfies that exception, so the suppression that lived here through
  // 2026-05-17 is no longer needed.
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      <Button size="xs">xs</Button>
      <Button size="sm">sm</Button>
      <Button size="default">default</Button>
      <Button size="lg">lg</Button>
      <Button size="icon" aria-label="Continue">
        <ArrowRight />
      </Button>
    </div>
  ),
};
export const Disabled: Story = { args: { children: 'Disabled', disabled: true } };
export const Dark: Story = {
  ...Variants,
  globals: { theme: 'dark' },
  parameters: { backgrounds: { default: 'dark' } },
  decorators: [(S) => <div className="dark"><S /></div>],
};

/**
 * Composition pattern — Button has no `loading` variant; the canon is
 * `disabled + spinner child + accessible busy label`. The aria-live
 * region announces state change to screen readers per
 * `LOADING_PHILOSOPHY.md`.
 */
export const Loading: Story = {
  render: () => (
    <Button disabled aria-busy="true" aria-live="polite">
      <Loader2 className="animate-spin" aria-hidden />
      <span>Installing…</span>
    </Button>
  ),
};

export const RTL: Story = {
  args: { children: 'ابدأ الآن' },
  decorators: [withRtl],
};
