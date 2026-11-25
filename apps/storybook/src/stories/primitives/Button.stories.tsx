import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from '@interlace/ui/button';
import { Input } from '@interlace/ui/input';
import { ArrowRight } from 'lucide-react';
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
      options: ['default', 'highlight', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description:
        'Emphasis ladder. `destructive` is reserved for irreversible actions and should be paired with an `AlertDialog` confirm.',
      table: {
        category: 'Appearance',
        type: {
          summary:
            "'default' | 'highlight' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'",
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
        'Blocks pointer events and drops to 50% opacity. For work in progress use `loading` instead, which keeps focus and size: see the Loading story.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    type: {
      control: 'select',
      options: ['button', 'submit', 'reset'],
      description:
        'Native button type. Button defaults to `button`, so it never submits a form by accident; pass `submit` for the form\'s submit action.',
      table: { category: 'State', type: { summary: "'button' | 'submit' | 'reset'" }, defaultValue: { summary: 'button' } },
    },
    fullWidth: {
      control: 'boolean',
      description: 'Stretch to the container width (form actions, mobile CTAs). Use this, not `className="w-full"`.',
      table: { category: 'Layout', defaultValue: { summary: 'false' } },
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
    loading: {
      control: 'boolean',
      description:
        'Busy: a spinner over the label, the same size and focus, `aria-busy` and `aria-disabled`, and clicks ignored until it is false again. Use it for the reader\'s own action (a submit, a save), per `LOADING_PHILOSOPHY.md`.',
      table: { category: 'State', type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
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
      <Button variant="highlight">Highlight</Button>
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
export const FullWidth: Story = {
  render: () => (
    <form className="flex max-w-96 flex-col gap-2" onSubmit={(e) => e.preventDefault()}>
      <Button type="submit" fullWidth>Create account</Button>
      <Button variant="outline" fullWidth>Cancel</Button>
    </form>
  ),
};
export const Dark: Story = {
  ...Variants,
  globals: { theme: 'dark' },
  parameters: { backgrounds: { default: 'dark' } },
  decorators: [(S) => <div className="dark"><S /></div>],
};

/**
 * `loading` keeps the button's size and focus and says it is busy. Every
 * variant keeps its own colours: the spinner takes the label's colour.
 */
export const Loading: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button loading>Saving changes</Button>
      <Button variant="highlight" loading>
        Highlight
      </Button>
      <Button variant="outline" loading>
        <ArrowRight /> Outline
      </Button>
      <Button variant="secondary" size="sm" loading>
        Small
      </Button>
      <Button size="icon" aria-label="Continue" loading>
        <ArrowRight />
      </Button>
    </div>
  ),
};

/**
 * Press Save: the button goes busy without moving, keeps keyboard focus,
 * and ignores a second press until the work is done.
 */
export const LoadingFlow: Story = {
  args: { onClick: fn() },
  render: function Render({ onClick }) {
    const [saving, setSaving] = React.useState(false);
    return (
      <Button
        loading={saving}
        onClick={(event) => {
          onClick?.(event);
          setSaving(true);
        }}
      >
        Save
      </Button>
    );
  },
  play: async ({ args, canvasElement, step }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Save' });
    const width = button.getBoundingClientRect().width;

    await step('Enter starts the save', async () => {
      button.focus();
      await userEvent.keyboard('{Enter}');
      expect(args.onClick).toHaveBeenCalledOnce();
    });

    await step('Busy, same width, still focused', async () => {
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.getBoundingClientRect().width).toBe(width);
      expect(document.activeElement).toBe(button);
    });

    await step('A second press does nothing', async () => {
      await userEvent.click(button);
      expect(args.onClick).toHaveBeenCalledOnce();
    });
  },
};

export const RTL: Story = {
  args: { children: 'ابدأ الآن' },
  decorators: [withRtl],
};

/**
 * `data-density="comfortable"` on any ancestor re-points the control-height
 * tokens, so every Button, Input, Select and Toggle inside grows to a touch
 * size: the default control is 44px. Put it on `<html>` for a whole site.
 */
export const ComfortableDensity: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {(['compact', 'comfortable'] as const).map((density) => (
        <div
          key={density}
          data-density={density === 'comfortable' ? 'comfortable' : undefined}
          className="flex flex-wrap items-center gap-3"
        >
          <span className="text-muted-foreground w-28 text-sm">{density}</span>
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Input aria-label={`${density} field`} placeholder="Search" className="w-48" />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [compact, comfortable] = within(canvasElement).getAllByRole('button', {
      name: 'Default',
    });
    await expect(compact!.getBoundingClientRect().height).toBe(36);
    await expect(comfortable!.getBoundingClientRect().height).toBe(44);
  },
};
