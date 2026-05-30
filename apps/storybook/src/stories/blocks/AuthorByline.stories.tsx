import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthorByline } from '@interlace/ui/blocks/author-byline';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Blocks/AuthorByline',
  component: AuthorByline,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Article hero adornment — Avatar (large) + author name + optional bio + publication date · reading time. Server-first; composes Avatar / Typography. MIN_VIEWPORT 320.',
      },
    },
  },
} satisfies Meta<typeof AuthorByline>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleAvatar =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop&crop=faces&q=80';

export const Default: Story = {
  args: {
    authorName: 'Ofri Peretz',
    authorAvatar: sampleAvatar,
    publishedDateIso: '2026-05-30T08:00:00.000Z',
    readingTimeMinutes: 7,
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-lg">
      {/* Name only — narrowest byline (e.g. press release). */}
      <AuthorByline
        authorName="Jane Doe"
        authorAvatar={sampleAvatar}
        publishedDateIso="2026-04-12T09:30:00.000Z"
      />

      {/* Name + reading time — typical for a technical post. */}
      <AuthorByline
        authorName="Ofri Peretz"
        authorAvatar={sampleAvatar}
        publishedDateIso="2026-05-30T08:00:00.000Z"
        readingTimeMinutes={5}
      />

      {/* Full byline — name + bio + reading time. */}
      <AuthorByline
        authorName="Ofri Peretz"
        authorAvatar={sampleAvatar}
        authorBio="Building Interlace — the ESLint floor for modern JS / TS teams."
        publishedDateIso="2026-05-30T08:00:00.000Z"
        readingTimeMinutes={12}
      />

      {/* Fallback initial — broken avatar URL exercises AvatarFallback. */}
      <AuthorByline
        authorName="Casey Quinn"
        authorAvatar="https://invalid.example.test/missing.png"
        authorBio="Distributed-systems engineer. Writes about reliability and tests."
        publishedDateIso="2026-03-01T14:00:00.000Z"
        readingTimeMinutes={9}
      />
    </div>
  ),
};

export const Dark: Story = {
  args: {
    authorName: 'Ofri Peretz',
    authorAvatar: sampleAvatar,
    authorBio: 'Building Interlace — the ESLint floor for modern JS / TS teams.',
    publishedDateIso: '2026-05-30T08:00:00.000Z',
    readingTimeMinutes: 7,
  },
  decorators: [withDark],
};

export const RTL: Story = {
  args: {
    authorName: 'Ofri Peretz',
    authorAvatar: sampleAvatar,
    authorBio: 'Building Interlace — the ESLint floor for modern JS / TS teams.',
    publishedDateIso: '2026-05-30T08:00:00.000Z',
    readingTimeMinutes: 7,
  },
  decorators: [withRtl],
};

/**
 * Renders the block inside a 280px-wide frame — below MIN_VIEWPORT (320). The
 * dev-mode preflight contract is expected to outline the root in that mode;
 * in prod the layout still degrades gracefully (right column wraps).
 */
export const BelowMinViewport: Story = {
  args: {
    authorName: 'Ofri Peretz',
    authorAvatar: sampleAvatar,
    authorBio: 'Building Interlace — the ESLint floor for modern JS / TS teams.',
    publishedDateIso: '2026-05-30T08:00:00.000Z',
    readingTimeMinutes: 7,
  },
  render: (args) => (
    <div className="w-[280px] border border-dashed border-fd-border p-sm">
      <AuthorByline {...args} />
    </div>
  ),
};
