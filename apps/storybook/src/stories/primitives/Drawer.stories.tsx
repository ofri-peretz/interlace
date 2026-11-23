import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@interlace/ui/drawer';
import { Button } from '@interlace/ui/button';
import { withReducedMotion, withRtl } from '@/decorators';

const meta: Meta<typeof Drawer> = {
  title: 'Primitives/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    // The panel and its scrim are portalled to <body>; on the autodocs page
    // each story gets its own iframe so one open drawer does not cover the rest.
    docs: {
      story: { inline: false, height: '560px' },
      description: {
        component:
          'A panel that slides in from an edge and follows the finger: drag it back toward its edge to dismiss it, let go early and it settles back, flick it and it leaves faster. The bottom sheet of a phone app, for filter panels, share sheets, action lists and mobile menus. Escape, a tap on the page behind and the close button all dismiss it too, so nobody needs the gesture. Use `Sheet` for a desktop side pane nobody drags, and `Dialog` for a task that must be finished first.',
      },
    },
  },
  argTypes: {
    direction: {
      control: 'inline-radio',
      options: ['bottom', 'top', 'right', 'left'],
      description:
        'The edge the drawer is attached to. Dragging toward that edge dismisses it.',
      table: { type: { summary: "'bottom' | 'top' | 'right' | 'left'" }, defaultValue: { summary: 'bottom' }, category: 'Appearance' },
    },
    snapPoints: {
      control: false,
      description:
        'Resting heights for a bottom drawer: fractions of the viewport (0 to 1), pixels, or `rem` strings. The drawer settles on the nearest one when released.',
      table: { type: { summary: '(number | string)[]' }, category: 'Behavior' },
    },
    modal: {
      control: 'boolean',
      description: 'Trap focus and make the page inert while open.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Behavior' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Drawer>;

const SIZES = ['Small', 'Medium', 'Large'];

function FilterDrawer(props: React.ComponentProps<typeof Drawer>) {
  return (
    <Drawer {...props}>
      <DrawerTrigger render={<Button variant="outline" />}>Open filters</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Filter results</DrawerTitle>
          <DrawerDescription>Drag down, press Escape or tap outside to close.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-wrap gap-2 px-4">
          {SIZES.map((s) => (
            <Button key={s} variant="secondary" size="sm">
              {s}
            </Button>
          ))}
        </div>
        <DrawerFooter>
          <DrawerClose render={<Button />}>Show 24 results</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export const Default: Story = {
  args: { direction: 'bottom', defaultOpen: true },
  render: (args) => <FilterDrawer {...args} />,
};

/**
 * Keyboard-only flow: Enter opens, focus moves into the panel, Escape closes,
 * and focus returns to the trigger. The gesture is an extra, never the only
 * way out.
 */
export const KeyboardFlow: Story = {
  render: () => <FilterDrawer />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /open filters/i });

    await step('Enter on the focused trigger opens the drawer', async () => {
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());
    });

    await step('The panel is named and holds focus', async () => {
      const panel = document.querySelector('[role="dialog"]') as HTMLElement;
      expect(panel.getAttribute('aria-labelledby')).toBeTruthy();
      await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    });

    await step('Escape closes and restores focus to the trigger', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeFalsy());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  },
};

/** Each edge, opened from its own trigger. */
export const Directions: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {(['bottom', 'top', 'right', 'left'] as const).map((direction) => (
        <Drawer key={direction} direction={direction}>
          <DrawerTrigger render={<Button variant="outline" />}>{direction}</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>direction=&quot;{direction}&quot;</DrawerTitle>
              <DrawerDescription>Drag toward the {direction} edge to dismiss.</DrawerDescription>
            </DrawerHeader>
          </DrawerContent>
        </Drawer>
      ))}
    </div>
  ),
};

/**
 * Two resting heights: a peek that shows the first rows, and full height.
 * Drag between them; the list scrolls inside the panel at either one.
 */
export const SnapPoints: Story = {
  args: { snapPoints: ['16rem', 1], defaultOpen: true },
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger render={<Button variant="outline" />}>Open places</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Places nearby</DrawerTitle>
          <DrawerDescription>Pull up for the full list.</DrawerDescription>
        </DrawerHeader>
        <ul className="divide-border divide-y px-4">
          {Array.from({ length: 24 }, (_, i) => (
            <li key={i} className="py-3 text-sm">
              Place {i + 1}
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  ),
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };

export const RTL: Story = { ...Default, decorators: [withRtl] };

export const ReducedMotion: Story = { ...Default, decorators: [withReducedMotion] };
