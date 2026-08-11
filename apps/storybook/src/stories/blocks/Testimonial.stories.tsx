import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Testimonial,
  TestimonialGrid,
} from '@interlace/ui/patterns/testimonial';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Testimonial> = {
  title: 'Blocks/Testimonial',
  component: Testimonial,
  tags: ['autodocs'],
  parameters: {
    // NOT `centered`: the testimonial card fills its container. Centered sizes
    // the story root to content, pushing the 420px frame past a 375px viewport.
    layout: 'padded',
    docs: {
      description: {
        component:
          'A quote with an attribution that can be checked. Semantic `<figure>` / `<blockquote>` / `<cite>` rather than styled divs, so the quote is machine-readable as a quote — which is what makes it eligible for a rich result and what tells a screen reader where the borrowed words start and stop.\n\n' +
          'Attribution is not optional: `authorName` is required and the avatar falls back to initials rather than a silhouette, because an anonymous testimonial is decoration. Use `TestimonialGrid` for the marketing row of 2–3; a lone card belongs beside the claim it supports, not centred on its own.\n\n' +
          'The quote marks are added by the component, so do not include them in `quote` — you will get two sets.',
      },
    },
  },
  argTypes: {
    quote: {
      control: 'text',
      description:
        'The borrowed words, without surrounding quote marks. Long enough to be specific, short enough to read at a glance — a paragraph in a card is a paragraph nobody reads.',
      table: { type: { summary: 'ReactNode' }, category: 'Data' },
    },
    authorName: {
      control: 'text',
      description:
        'Required. Also the source of the avatar fallback initials (first letter of the first two words).',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    authorRole: {
      control: 'text',
      description:
        'Title and/or company under the name. This is the line that makes the quote worth something — "Engineer @ Acme" is evidence, "Happy user" is filler.',
      table: { type: { summary: 'ReactNode' }, category: 'Data' },
    },
    authorAvatar: {
      control: 'text',
      description:
        'Image URL. Rendered with `alt=""` because the name is already beside it — a second announcement of the same person is noise. Omit it and the initials fallback carries the slot at the same size, so the row never reflows.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    loading: {
      control: 'boolean',
      description: 'Render a `<Skeleton variant="card" />` at the card footprint.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the `<figure>`. The card fills its container by design — width belongs to the grid around it, which is why these stories wrap it in a fixed-width box rather than centring the story root.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Testimonial>;

const sampleItem = {
  quote:
    'Interlace made it dead-simple to ship our blog. We dropped one template and inherited the streaming, error-boundary, and skeleton contract.',
  authorName: 'Ada Lovelace',
  authorRole: 'Engineer @ Acme',
};

export const Default: Story = {
  args: { ...sampleItem, loading: false },
  render: (args) => (
    <div className="w-[420px] max-w-full">
      <Testimonial {...args} />
    </div>
  ),
};

/**
 * Inline SVG rather than a remote URL: a story that reaches the network is a
 * story that fails in CI on someone else's outage, and the visual-regression
 * snapshot would change whenever the remote image did.
 */
const AVATAR_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="%23f4794a"/><circle cx="32" cy="25" r="11" fill="%23ffffff"/><path d="M8 64c0-13 11-21 24-21s24 8 24 21z" fill="%23ffffff"/></svg>',
  );

export const WithAvatar: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'With a photo supplied. The image is `alt=""` on purpose — the name is already beside it in a `<cite>`, and announcing the person twice is noise. Clear `authorAvatar` in the controls to see the initials fallback take the same 36px slot, so the caption never reflows between the two.',
      },
    },
  },
  args: { ...sampleItem, authorAvatar: AVATAR_SRC },
  render: (args) => (
    <div className="w-[420px] max-w-full">
      <Testimonial {...args} />
    </div>
  ),
};

export const Grid: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <TestimonialGrid
      title="What people are saying"
      lead="Real quotes from real consumers (well, almost)."
      items={[sampleItem, { ...sampleItem, authorName: 'Grace Hopper' }, { ...sampleItem, authorName: 'Tim Berners-Lee' }]}
    />
  ),
};

export const Loading: Story = {
  args: { ...sampleItem, loading: true },
  render: (args) => (
    <div className="w-[420px] max-w-full">
      <Testimonial {...args} />
    </div>
  ),
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
export const RTL: Story = { ...Default, decorators: [withRtl] };
