import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Morph, PageTransitions, useViewTransition } from '@interlace/ui/effects/view-transition';
import { Button } from '@interlace/ui/button';
import { withRtl } from '@/decorators';

// Invented places, drawn with tokens: no images to load.
const PLACES = [
  { id: 'bridge', title: 'The river bridge', blurb: 'Steel arches over slow water.', tone: 'bg-primary' },
  { id: 'market', title: 'The old market', blurb: 'Stalls under a long roof.', tone: 'bg-highlight' },
  { id: 'harbour', title: 'The harbour wall', blurb: 'A walk out to the light.', tone: 'bg-info' },
];

function Gallery() {
  const [open, setOpen] = React.useState<string | null>(null);
  const transition = useViewTransition();
  const place = PLACES.find((p) => p.id === open);

  if (place) {
    return (
      <article className="grid max-w-prose gap-4">
        <Morph name={`place-${place.id}`}>
          <div className={`${place.tone} aspect-video w-full rounded-2xl`} />
        </Morph>
        <Morph name={`place-title-${place.id}`}>
          <h2 className="text-3xl font-semibold">{place.title}</h2>
        </Morph>
        <p className="text-muted-foreground">
          {place.blurb} The card grew into this page; going back shrinks it into its place.
        </p>
        <div>
          <Button type="button" variant="outline" onClick={() => transition(() => setOpen(null), { types: ['back'] })}>
            Back to all places
          </Button>
        </div>
      </article>
    );
  }

  return (
    <div className="@container max-w-prose">
      <ul className="grid gap-4 @md:grid-cols-3">
        {PLACES.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="focus-visible:ring-ring/50 grid w-full gap-2 rounded-2xl text-start outline-none focus-visible:ring-[3px]"
              onClick={() => transition(() => setOpen(p.id), { types: ['forward'] })}
            >
              <Morph name={`place-${p.id}`}>
                <span className={`${p.tone} block aspect-video w-full rounded-xl`} />
              </Morph>
              <Morph name={`place-title-${p.id}`}>
                <span className="font-semibold">{p.title}</span>
              </Morph>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const meta = {
  title: 'Effects/ViewTransition',
  component: Morph,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The browser’s View Transitions, made safe to reach for: a card grows into its detail page, and a page change cross-fades instead of blinking.\n\n' +
          '**A card that grows into its page.** Give the card’s image and the detail page’s hero the same `<Morph name>`, and change the view inside `useViewTransition()`: the browser moves and scales the one into the other. `Morph` cleans any string into a valid name; a name must be unique on the page at any moment.\n\n' +
          '**Page changes.** `PageTransitions` (once, in the root layout) is a `<style>`: the old page fades out, the new one rises in by half a rem, and `@view-transition` turns it on between documents. `pageTransitionsCss()` gives the same CSS for a stylesheet of your own.\n\n' +
          '**Safe.** Where the browser has no View Transitions the update simply runs; under reduced motion there is no transition at all. `startViewTransition` is a plain function for code outside React, with `types` where supported.',
      },
    },
  },
  args: { name: 'place', children: <span /> },
} satisfies Meta<typeof Morph>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open a place: its card grows into the page. */
export const Default: Story = {
  render: () => (
    <>
      <PageTransitions crossDocument={false} />
      <Gallery />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'The old market' })).toBeTruthy();
  },
};

/** After opening one, and back again. */
export const OpenAndBack: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'The river bridge' }));
    await expect(await canvas.findByRole('heading', { name: 'The river bridge' })).toBeTruthy();
    await userEvent.click(canvas.getByRole('button', { name: 'Back to all places' }));
    await expect(await canvas.findByRole('button', { name: 'The harbour wall' })).toBeTruthy();
  },
};

export const RightToLeft: Story = { render: Default.render, decorators: [withRtl] };
