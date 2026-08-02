import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@interlace/ui/accordion';
import { withDark, withReducedMotion, withRtl } from '@/decorators';

const meta: Meta<typeof Accordion> = {
  title: 'Primitives/Accordion',
  component: Accordion,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Vertical disclosure for FAQ, settings, or progressive content reveal. Each item opens its panel on click. Per `MOTION_PHILOSOPHY.md` the open/close transition is killed under `prefers-reduced-motion`.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Accordion>;

export const Default: Story = {
  // AccordionTrigger is `py-4` (32px tall) on a full-width container.
  // Suppression for `target-size` was removed 2026-05-18 — the trigger
  // is well above WCAG 2.2's 24×24 threshold and the explicit `w-[420px]`
  // container makes the button's bounding box something axe can measure
  // without ambiguity.
  render: () => (
    <Accordion className="w-[420px]">
      <AccordionItem value="a">
        <AccordionTrigger>What does eslint-plugin-jwt detect?</AccordionTrigger>
        <AccordionContent>
          Hardcoded JWT secrets, weak algorithms (none/HS256 with short keys),
          and missing expiry validation.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>Is it type-aware?</AccordionTrigger>
        <AccordionContent>
          No — the default config is type-unaware. A type-aware tier exists for
          callers who already pay TS-program startup cost.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

/**
 * Keyboard-only flow per the APG accordion pattern: the trigger is a real
 * button, Enter and Space both toggle it, and `aria-expanded` tracks the
 * panel so screen readers announce the state change.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <Accordion className="w-[420px]">
      <AccordionItem value="a">
        <AccordionTrigger>First question</AccordionTrigger>
        <AccordionContent>First answer.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>Second question</AccordionTrigger>
        <AccordionContent>Second answer.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole('button', { name: /first question/i });

    await step('Starts collapsed and announces it', async () => {
      expect(first.getAttribute('aria-expanded')).toBe('false');
    });

    await step('Enter expands the panel', async () => {
      first.focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(first.getAttribute('aria-expanded')).toBe('true'),
      );
    });

    await step('The open panel is wired to its trigger', async () => {
      // Base UI only emits `aria-controls` once the panel is mounted —
      // closed panels are unmounted, so there is no id to point at. Assert
      // the pairing in the state where it must hold.
      const id = first.getAttribute('aria-controls');
      expect(id).toBeTruthy();
      expect(document.getElementById(id as string)).toBeTruthy();
    });

    await step('Space collapses it again', async () => {
      await userEvent.keyboard(' ');
      await waitFor(() =>
        expect(first.getAttribute('aria-expanded')).toBe('false'),
      );
    });

    await step('Tab reaches the next trigger', async () => {
      await userEvent.tab();
      expect(document.activeElement).toBe(
        canvas.getByRole('button', { name: /second question/i }),
      );
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
