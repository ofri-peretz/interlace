import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
  MIN_VIEWPORT,
} from '@interlace/ui/collapsible';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/Collapsible',
  component: Collapsible,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One trigger toggles one panel. Reach for it for "Show more" reveals, advanced-settings drawers, and footnotes — anywhere a single region of content is optional. For several sections where opening one should close the others, use `Accordion` instead; for content that overlays the page rather than pushing it down, use `Popover` or `Dialog`. The controls below sit on the root (`Collapsible`), which owns the open state; `CollapsibleTrigger` and `CollapsiblePanel` are styling-only wrappers over the Base UI parts. Per `MOTION_PHILOSOPHY.md` the height transition is killed under `prefers-reduced-motion`. MIN_VIEWPORT = 320px.',
      },
    },
  },
  argTypes: {
    defaultOpen: {
      control: 'boolean',
      description:
        'Initial open state for an uncontrolled disclosure. Ignored once `open` is set.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    open: {
      control: 'boolean',
      description:
        'Controlled open state. Setting this at all takes ownership of the state machine — the trigger then only reports intent through `onOpenChange`, and the panel will not move unless you feed the new value back in.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
    disabled: {
      control: 'boolean',
      description:
        'Ignore user interaction. The trigger keeps its accessible name and drops to 50% opacity with pointer events off.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    onOpenChange: {
      action: 'openChange',
      description:
        'Fired when the panel opens or closes. Receives `(open, eventDetails)` — `eventDetails.reason` distinguishes a trigger press from a programmatic change.',
      table: {
        type: { summary: '(open: boolean, details) => void' },
        category: 'Events',
      },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the root `<div>`. The root is the layout box for the whole disclosure — width, border and radius belong here, not on the trigger.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
    children: {
      control: false,
      description:
        'Exactly one `CollapsibleTrigger` and one `CollapsiblePanel`. Base UI wires `aria-expanded` / `aria-controls` between them.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    render: {
      control: false,
      description:
        'Base UI composition seam — render the root as a different element instead of a `<div>`.',
      table: { type: { summary: 'ReactElement | (props, state) => ReactElement' }, category: 'Slots' },
    },
  },
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

const PanelBody = () => (
  <div className="space-y-sm p-md text-ui-sm text-muted-foreground">
    <p>
      <span className="text-foreground font-medium">eslint-plugin-jwt</span>{' '}
      surfaces three classes of token-handling defects:
    </p>
    <ul className="list-disc space-y-xs pl-md">
      <li>Hardcoded JWT secrets committed to source.</li>
      <li>
        Weak algorithms — <code className="font-mono">none</code> and{' '}
        <code className="font-mono">HS256</code> with sub-256-bit keys.
      </li>
      <li>Missing <code className="font-mono">exp</code> claim verification.</li>
    </ul>
    <p>
      Every finding maps to a CWE id and ships with an autofixer when the
      remediation is unambiguous.
    </p>
  </div>
);

// Default — opens with the panel already expanded so the rich content is
// visible without a click, per the spec. Driven entirely from args so every
// control in the panel moves something on screen.
export const Default: Story = {
  args: {
    defaultOpen: true,
    disabled: false,
    className: 'w-[420px] max-w-full rounded-md border',
  },
  render: (args) => (
    <Collapsible {...args}>
      {/* `block`, not `flex`: the label is three inline nodes, and flex would
          turn each into an item and space them apart. */}
      <CollapsibleTrigger className="block w-full px-md py-sm text-left text-ui-sm font-medium">
        What does <span className="font-mono">eslint-plugin-jwt</span> detect?
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <PanelBody />
      </CollapsiblePanel>
    </Collapsible>
  ),
};

/**
 * `disabled` — the disclosure is inert. The trigger keeps its accessible name
 * and its `aria-expanded` state so assistive tech still describes it
 * correctly; only the interaction is removed.
 */
export const Disabled: Story = {
  args: {
    ...Default.args,
    defaultOpen: false,
    disabled: true,
  },
  render: (args) => (
    <Collapsible {...args}>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-md py-sm text-left text-ui-sm font-medium">
        Show advanced settings
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <PanelBody />
      </CollapsiblePanel>
    </Collapsible>
  ),
};

/**
 * Variants — open vs closed side by side so the two terminal states of the
 * disclosure are reviewable on a single sheet. Open uses `defaultOpen`; closed
 * is the implicit default.
 */
export const Variants: Story = {
  render: () => (
    <div className="grid w-[880px] max-w-full grid-cols-1 gap-lg md:grid-cols-2">
      <section className="flex flex-col gap-xs">
        <div className="text-ui-sm font-mono uppercase text-muted-foreground">
          open
        </div>
        <Collapsible defaultOpen className="rounded-md border">
          <CollapsibleTrigger className="block w-full px-md py-sm text-left text-ui-sm font-medium">
            What does <span className="font-mono">eslint-plugin-jwt</span> detect?
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <PanelBody />
          </CollapsiblePanel>
        </Collapsible>
      </section>

      <section className="flex flex-col gap-xs">
        <div className="text-ui-sm font-mono uppercase text-muted-foreground">
          closed
        </div>
        <Collapsible className="rounded-md border">
          <CollapsibleTrigger className="block w-full px-md py-sm text-left text-ui-sm font-medium">
            What does <span className="font-mono">eslint-plugin-jwt</span> detect?
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <PanelBody />
          </CollapsiblePanel>
        </Collapsible>
      </section>
    </div>
  ),
};

/**
 * Keyboard-only flow: Enter and Space both toggle the disclosure and
 * `aria-expanded` / `aria-controls` keep assistive tech in sync.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <Collapsible className="w-[420px] max-w-full rounded-md border">
      <CollapsibleTrigger className="text-ui-sm flex w-full items-center justify-between px-md py-sm text-left font-medium">
        Show advanced settings
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <PanelBody />
      </CollapsiblePanel>
    </Collapsible>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /advanced settings/i });

    await step('Starts collapsed and announces it', async () => {
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    await step('Enter expands', async () => {
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(trigger.getAttribute('aria-expanded')).toBe('true'),
      );
    });

    await step('The open panel is wired to its trigger', async () => {
      // `aria-controls` only exists while the panel is mounted — Base UI
      // unmounts it when closed, so this is the state where it must hold.
      const id = trigger.getAttribute('aria-controls');
      expect(id).toBeTruthy();
      expect(document.getElementById(id as string)).toBeTruthy();
    });

    await step('Space collapses', async () => {
      await userEvent.keyboard(' ');
      await waitFor(() =>
        expect(trigger.getAttribute('aria-expanded')).toBe('false'),
      );
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
 * Below-min-viewport demo — wrap in a (MIN_VIEWPORT - 1)px container with the
 * `data-interlace-dev` flag so preflight's dashed warning outline appears.
 * The collapsible still functions; the outline is a dev-only signal that the
 * surface has dropped below its supported width.
 */
export const BelowMinViewport: Story = {
  render: () => (
    <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }}>
      <Collapsible defaultOpen className="rounded-md border">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-md py-sm text-left text-ui-sm font-medium">
          {`< ${MIN_VIEWPORT}px — dev outline`}
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <div className="p-md text-ui-sm text-muted-foreground">
            Panel content remains operable below the minimum viewport; the
            dashed warning outline is a development-mode signal only.
          </div>
        </CollapsiblePanel>
      </Collapsible>
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
