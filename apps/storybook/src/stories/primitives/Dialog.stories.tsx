import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@interlace/ui/dialog';
import { Button } from '@interlace/ui/button';
import { withDark, withReducedMotion, withRtl } from '@/decorators';

const meta: Meta<typeof Dialog> = {
  title: 'Primitives/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Interrupts the page with a focused task the user must finish or abandon before continuing — a confirmation, a short edit form, a destructive-action check. Because it traps focus and locks page scroll, it costs the user their place: do not use it for content they might want to read alongside the page (use `Popover` or an inline disclosure) or for transient feedback (use `Toast`). The controls below sit on the root, which owns the open state; `showCloseButton` and sizing live on `DialogContent`. Reference implementation — [dialog.tsx](packages/ui/src/primitives/dialog.tsx) maps each R1–R26 component-floor rule to a line of code.',
      },
    },
  },
  argTypes: {
    open: {
      control: 'boolean',
      description:
        'Controlled open state. Setting it at all takes ownership — the trigger and the close button then only report intent through `onOpenChange`.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
    defaultOpen: {
      control: 'boolean',
      description:
        'Open on mount, uncontrolled. Flip it here to see the dialog without clicking the trigger.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    modal: {
      control: 'select',
      options: [true, false, 'trap-focus'],
      description:
        '`true` traps focus, locks page scroll and disables pointer interaction outside. `false` leaves the page fully usable. `trap-focus` keeps the focus trap but allows scrolling and outside pointer interaction — the middle ground for a long dialog over a scrollable page.',
      table: {
        type: { summary: "boolean | 'trap-focus'" },
        defaultValue: { summary: 'true' },
        category: 'Behaviour',
      },
    },
    disablePointerDismissal: {
      control: 'boolean',
      description:
        'Stop an outside click from closing the dialog. Turn it on when losing in-progress input would cost the user work; Escape still closes.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'Behaviour',
      },
    },
    onOpenChange: {
      action: 'openChange',
      description:
        'Fired when the dialog opens or closes. Receives `(open, eventDetails)`; `eventDetails.reason` separates an outside press from Escape from a close-button press.',
      table: {
        type: { summary: '(open: boolean, details) => void' },
        category: 'Events',
      },
    },
    onOpenChangeComplete: {
      action: 'openChangeComplete',
      description:
        'Fired once the open/close animation has settled — the safe point to reset form state without the user watching it happen.',
      table: { type: { summary: '(open: boolean) => void' }, category: 'Events' },
    },
    children: {
      control: false,
      description:
        'A `DialogTrigger` plus a `DialogContent`. `DialogContent` already renders the Portal and the Overlay, so it does not need to be wrapped in `DialogPortal`.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

/**
 * Shown in the situation a dialog actually appears in — a settings row whose
 * action needs a confirmation step — rather than as a lone button on an empty
 * canvas. Click the trigger, or flip `defaultOpen` in the Controls panel, to
 * open it; `modal` and `disablePointerDismissal` change how hard it is to
 * leave.
 */
export const Default: Story = {
  args: {
    defaultOpen: false,
    modal: true,
    disablePointerDismissal: false,
  },
  render: (args) => (
    <div className="border-border bg-card w-[420px] max-w-full rounded-lg border p-6">
      <div className="text-muted-foreground mb-4 text-xs font-mono uppercase tracking-wide">
        Notifications
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Weekly digest</div>
          <div className="text-muted-foreground text-sm">
            One note when we publish a deep dive.
          </div>
        </div>
        <Dialog {...args}>
          <DialogTrigger render={<Button variant="outline" />}>
            Subscribe
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Subscribe to Interlace</DialogTitle>
              <DialogDescription>
                Get a weekly note when we publish a new deep-dive article. One
                email, no tracking pixels, unsubscribe in a click.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <DialogClose render={<Button />}>Subscribe</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  ),
};

/**
 * `Dialog.Compose` — the canonical Root → Trigger → Portal → Overlay → Content
 * tree behind a single-prop API, for the majority of call sites that only need
 * a title, a description and a footer row. Drop back to the compositional API
 * when a part needs customising (overlay opacity, popup positioning, or
 * `showCloseButton={false}` on `DialogContent`).
 */
export const Compose: Story = {
  render: () => (
    <Dialog.Compose
      trigger={<Button variant="outline">Delete rule</Button>}
      title="Delete this rule?"
      description="The rule and its test fixtures are removed from the plugin. This cannot be undone."
      footer={
        <>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button variant="destructive" />}>
            Delete
          </DialogClose>
        </>
      }
    />
  ),
};

/**
 * Interactive test: dialog opens on trigger click, exposes title +
 * description as ARIA, closes on Escape.
 */
export const OpenCloseFlow: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button>Open</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm</DialogTitle>
          <DialogDescription>
            Verifying open/close + focus return.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button>OK</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /open/i });

    await step('Open dialog by clicking trigger', async () => {
      await userEvent.click(trigger);
      await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());
    });

    await step('Dialog has accessible name + description', async () => {
      const dlg = document.querySelector('[role="dialog"]') as HTMLElement;
      expect(dlg.getAttribute('aria-labelledby')).toBeTruthy();
      expect(dlg.getAttribute('aria-describedby')).toBeTruthy();
    });

    await step('Focus moves INTO the dialog (trap entered)', async () => {
      const dlg = document.querySelector('[role="dialog"]') as HTMLElement;
      await waitFor(() =>
        expect(dlg.contains(document.activeElement)).toBe(true),
      );
    });

    await step('Escape closes dialog', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeFalsy());
    });

    await step('Focus is RESTORED to the trigger', async () => {
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  },
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

export const ReducedMotion: Story = {
  ...Default,
  decorators: [withReducedMotion],
};
