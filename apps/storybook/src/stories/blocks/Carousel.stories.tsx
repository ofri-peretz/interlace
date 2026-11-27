import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@interlace/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@interlace/ui/patterns/carousel';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Carousel> = {
  title: 'Blocks/Carousel',
  component: Carousel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A row of cards the reader swipes through. The row is the browser’s own scroll with snap points, so touch, trackpad, wheel and the arrow keys all work at the device’s own feel; Previous and Next page by one view and switch off at either end, and are not shown when every card fits.\n\n' +
          '**Accessible.** Every card is in the server HTML, announced as “slide, 2 of 6” in a region announced as a carousel. Nothing rotates on its own and nothing is cloned. The row is one tab stop; Tab then walks the links inside, and each scrolls into view.\n\n' +
          '**Direction.** In a right-to-left page Next moves left and the arrows turn around. Under reduced motion a page jumps instead of gliding.\n\n' +
          '**Tokens.** `--carousel-item-size` (default `min(20rem, 85%)`, so the next card peeks in on a phone) and `--carousel-gap` (default `1rem`). Part names follow shadcn’s carousel.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Carousel>;

// Sample content with checkable facts, so the demo makes no claim about the world.
const CARDS = [
  { title: 'Triangles', body: 'Three sides, and the angles add up to 180 degrees.' },
  { title: 'Squares', body: 'Four equal sides and four right angles.' },
  { title: 'Hexagons', body: 'Six sides; bees build their combs from them.' },
  { title: 'Circles', body: 'Every point is the same distance from the centre.' },
  { title: 'Cubes', body: 'Six square faces, twelve edges and eight corners.' },
  { title: 'Spheres', body: 'A circle turned in three dimensions.' },
];

const Shapes = () => (
  <Carousel aria-labelledby="shapes-title" className="max-w-prose">
    <h2 id="shapes-title" className="text-lg font-semibold">
      Shapes to explore
    </h2>
    <CarouselContent>
      {CARDS.map((card) => (
        <CarouselItem key={card.title}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>Geometry</CardDescription>
            </CardHeader>
            <CardContent>{card.body}</CardContent>
          </Card>
        </CarouselItem>
      ))}
    </CarouselContent>
    <CarouselPrevious />
    <CarouselNext />
  </Carousel>
);

/** Swipe or scroll the row, or page with the buttons. */
export const Default: Story = {
  render: () => <Shapes />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Shapes to explore' })).toBeInTheDocument();
    await expect(canvas.getAllByRole('group')).toHaveLength(CARDS.length);
    await expect(canvas.getByRole('group', { name: `1 of ${CARDS.length}` })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Previous' })).toBeDisabled();
  },
};

/** Right to left: Next moves left and the arrows turn around. */
export const RightToLeft: Story = {
  decorators: [withRtl],
  render: () => <Shapes />,
};
