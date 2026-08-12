import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogBackdrop,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
  MIN_VIEWPORT,
} from '@interlace/ui/alert-dialog';
import { Button } from '@interlace/ui/button';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/AlertDialog',
  component: AlertDialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Destructive-confirm surface. Unlike `Dialog`, an `AlertDialog` interrupts the user with a decision they cannot dismiss by clicking outside — Cancel + Confirm are the only exits. Use for irreversible actions (delete a rule, revoke a key); if the action is undoable, prefer an inline control plus a toast with Undo. A11y, focus trap, and Escape-to-cancel are inherited from `@base-ui/react/alert-dialog`.',
      },
    },
  },
  // The root renders no element of its own — its whole API is open-state
  // orchestration, and react-docgen cannot follow it through
  // `@base-ui/react/alert-dialog`. Declared by hand.
  argTypes: {
    defaultOpen: {
      control: 'boolean',
      description:
        'Uncontrolled initial open state. Use this when the trigger is the only thing that opens the dialog.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    open: {
      control: 'boolean',
      description:
        'Controlled open state. Supply together with `onOpenChange` — on its own it pins the dialog and Cancel/Escape stop working.',
      table: { category: 'State' },
    },
    onOpenChange: {
      action: 'openChange',
      description:
        'Fires with the next open state plus an event-details object carrying the dismissal reason.',
      table: { category: 'Events' },
    },
    onOpenChangeComplete: {
      action: 'openChangeComplete',
      description: 'Fires after the open/close animation settles.',
      table: { category: 'Events' },
    },
    children: {
      control: false,
      description:
        '`AlertDialogTrigger` + `AlertDialogPortal` > `AlertDialogBackdrop` + `AlertDialogPopup`.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
  },
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default — destructive confirm opened on mount (`defaultOpen`) so reviewers
 * see the surface without driving the trigger, while Cancel and Escape still
 * work because the state stays uncontrolled.
 */
export const Default: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <AlertDialog {...args}>
      <AlertDialogTrigger render={<Button variant="outline">Delete rule</Button>} />
      <AlertDialogPortal>
        <AlertDialogBackdrop />
        <AlertDialogPopup>
          <div className="space-y-2">
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the rule from your config. Existing
              violations will no longer be flagged. This action cannot be undone.
            </AlertDialogDescription>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive">Confirm Delete</Button>
          </div>
        </AlertDialogPopup>
      </AlertDialogPortal>
    </AlertDialog>
  ),
};

/**
 * Variants — AlertDialog is structurally fixed (one title, one description,
 * cancel + action). The meaningful axis is the tone of the action button.
 * We walk the two real-world tones a confirm can take: destructive (delete)
 * and primary (irreversible-but-affirmative, e.g. publish).
 */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <AlertDialog open={true}>
        <AlertDialogPortal>
          <AlertDialogBackdrop />
          <AlertDialogPopup>
            <div className="space-y-2">
              <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
              <AlertDialogDescription>
                Destructive tone — removes the rule from your config permanently.
              </AlertDialogDescription>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button variant="destructive">Confirm Delete</Button>
            </div>
          </AlertDialogPopup>
        </AlertDialogPortal>
      </AlertDialog>

      <AlertDialog open={true}>
        <AlertDialogPortal>
          <AlertDialogBackdrop />
          <AlertDialogPopup>
            <div className="space-y-2">
              <AlertDialogTitle>Publish this article?</AlertDialogTitle>
              <AlertDialogDescription>
                Primary tone — publishes to all subscribers. Cannot be undone
                once the syndication fan-out completes.
              </AlertDialogDescription>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button>Confirm Publish</Button>
            </div>
          </AlertDialogPopup>
        </AlertDialogPortal>
      </AlertDialog>
    </div>
  ),
};

/**
 * Keyboard-only flow: the surface announces itself as `alertdialog`, traps
 * focus, and Escape routes to Cancel (the safe exit) rather than confirming
 * the destructive action.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">Delete rule</Button>} />
      <AlertDialogPortal>
        <AlertDialogBackdrop />
        <AlertDialogPopup>
          <div className="space-y-2">
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive">Confirm Delete</Button>
          </div>
        </AlertDialogPopup>
      </AlertDialogPortal>
    </AlertDialog>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /delete rule/i });

    await step('Enter on the trigger opens the alert dialog', async () => {
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(document.querySelector('[role="alertdialog"]')).toBeTruthy(),
      );
    });

    await step('It is labelled + described and traps focus', async () => {
      const dlg = document.querySelector('[role="alertdialog"]') as HTMLElement;
      expect(dlg.getAttribute('aria-labelledby')).toBeTruthy();
      expect(dlg.getAttribute('aria-describedby')).toBeTruthy();
      await waitFor(() =>
        expect(dlg.contains(document.activeElement)).toBe(true),
      );
    });

    await step('Escape cancels — nothing is confirmed', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() =>
        expect(document.querySelector('[role="alertdialog"]')).toBeFalsy(),
      );
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  },
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
 * Below-min-viewport demo — wrap the trigger surface in a sub-MIN_VIEWPORT
 * container with the `data-interlace-dev` flag so preflight's dashed warning
 * outline appears. The AlertDialog itself portals out to the body and so is
 * not constrained by the wrapper — what we're verifying here is that the
 * primitive *advertises* its MIN_VIEWPORT correctly and that the dev-mode
 * outline contract still fires for its trigger seam.
 */
export const BelowMinViewport: Story = {
  render: () => (
    <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }}>
      <AlertDialog open={true}>
        <AlertDialogTrigger
          render={<Button variant="outline">{`< ${MIN_VIEWPORT}px — dev outline`}</Button>}
        />
        <AlertDialogPortal>
          <AlertDialogBackdrop />
          <AlertDialogPopup>
            <div className="space-y-2">
              <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
              <AlertDialogDescription>
                Rendered inside a sub-min-viewport container — the dashed
                preflight outline should mark this surface in dev mode.
              </AlertDialogDescription>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button variant="destructive">Confirm Delete</Button>
            </div>
          </AlertDialogPopup>
        </AlertDialogPortal>
      </AlertDialog>
    </div>
  ),
  decorators: [
    (Story) => (
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
