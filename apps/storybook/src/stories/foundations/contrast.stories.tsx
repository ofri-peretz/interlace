import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { Badge } from '@interlace/ui/badge';
import { Button } from '@interlace/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@interlace/ui/card';
import { Input } from '@interlace/ui/input';
import { Label } from '@interlace/ui/label';

/**
 * **More contrast**, the AAA reading mode (the end of `styles/semantics.css`, part of the
 * base CSS).
 *
 * Interlace is AA in every theme. For readers who find that hard to read, this
 * mode lifts every text pair to 7:1 and every line to a clear 3:1, on any
 * theme and in both schemes. It turns on by itself when the system asks for
 * more contrast (`prefers-contrast: more`), or when the page sets
 * `data-contrast="more"` on `<html>` or on one region. `data-contrast="normal"`
 * opts a page out of the automatic switch.
 *
 * - Secondary text becomes the full foreground.
 * - Primary becomes foreground on background. A brand that wants its own
 *   colour re-points `--primary` inside `[data-contrast='more']` with a pair it
 *   has measured at 7:1.
 * - Status colours deepen until their text clears 7:1.
 * - Borders darken, and focus becomes a 3px outline 2px outside the element.
 *
 * Use the Contrast toolbar item to switch the whole canvas.
 */
const meta = {
  title: 'Foundations/More contrast',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Sample({ label }: { label: string }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <Badge variant="outline" className="w-fit">
          {label}
        </Badge>
        <CardTitle>Reading settings</CardTitle>
        <CardDescription>
          Secondary text, the kind that is easiest to lose on a bright screen.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`email-${label}`}>Email</Label>
          <Input id={`email-${label}`} placeholder="you@example.org" />
        </div>
        <p className="text-success text-sm font-medium">Saved a moment ago.</p>
        <p className="text-destructive text-sm font-medium">That address looks incomplete.</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button>Continue</Button>
        <Button variant="outline">Not now</Button>
      </CardFooter>
    </Card>
  );
}

/** The same card at the standard AA level and with more contrast, side by side. */
export const SideBySide: Story = {
  render: () => (
    <div className="grid gap-6 md:grid-cols-2">
      <Sample label="Standard (AA)" />
      <div data-contrast="more" className="bg-background text-foreground">
        <Sample label="More contrast (AAA)" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const more = canvasElement.querySelector<HTMLElement>('[data-contrast="more"]')!;
    const standard = canvasElement.querySelector<HTMLElement>('[data-slot="card"]')!;
    const descIn = (el: HTMLElement) =>
      getComputedStyle(el.querySelector('[data-slot="card-description"]')!).color;
    // Secondary text takes the full foreground under more contrast.
    await expect(descIn(more)).not.toBe(descIn(standard));
    await expect(descIn(more)).toBe(getComputedStyle(more).color);
  },
};

/** The same, at night. */
export const SideBySideDark: Story = {
  ...SideBySide,
  globals: { theme: 'dark' },
};
