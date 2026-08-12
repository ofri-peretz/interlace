import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthorByline } from '@interlace/ui/patterns/author-byline';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Blocks/AuthorByline',
  component: AuthorByline,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The "who wrote this, when, and how long it takes to read" row that sits directly ' +
          'under an article H1. The date goes through a native `<time dateTime>` pinned to ' +
          'UTC, so RSS and structured-data parsers read the ISO value and no reader west of ' +
          'UTC sees the previous day. Use it on article and changelog headers; for an author ' +
          'card with a follow action or links, compose your own block instead.',
      },
    },
  },
  argTypes: {
    authorName: {
      control: 'text',
      description:
        'Display name. Also seeds the avatar fallback (first grapheme, uppercased) and the avatar `alt`.',
      table: { category: 'Content', type: { summary: 'string' } },
    },
    authorBio: {
      control: 'text',
      description: 'Optional one-line bio under the name, e.g. "Staff engineer at Interlace". Omit it for a two-line byline.',
      table: { category: 'Content', type: { summary: 'string' } },
    },
    authorAvatar: {
      control: 'text',
      description:
        'Avatar image URL. A missing or broken URL degrades to the initial-letter fallback rather than a broken image.',
      table: { category: 'Media', type: { summary: 'string' } },
    },
    publishedDateIso: {
      control: 'text',
      description:
        'ISO-8601 publication timestamp. Drives both `<time dateTime>` and the visible short form; an unparseable value renders no date at all instead of "Invalid Date".',
      table: { category: 'Data', type: { summary: 'string' } },
    },
    readingTimeMinutes: {
      control: { type: 'range', min: 1, max: 60, step: 1 },
      description: 'Estimated reading time in whole minutes. Omit it and the clock chip (and its separator) disappear.',
      table: { category: 'Data', type: { summary: 'number' } },
    },
    loading: {
      control: 'boolean',
      description:
        'Render the avatar + name + date silhouette instead of the byline, shape-matched so the article header does not shift on data arrival.',
      table: { category: 'State', type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    className: {
      control: 'text',
      description: 'Merged onto the root row — the seam for header spacing.',
      table: { category: 'Appearance', type: { summary: 'string' } },
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
    authorBio: 'Building Interlace — the ESLint floor for modern JS / TS teams.',
    publishedDateIso: '2026-05-30T08:00:00.000Z',
    readingTimeMinutes: 7,
    loading: false,
  },
};

/**
 * The pre-data silhouette. Same avatar / name / meta footprint as the populated
 * byline, so an article header rendered while the post is still streaming does
 * not shift when the author arrives.
 */
export const Loading: Story = {
  args: { loading: true },
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
  globals: { theme: 'dark' },
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
    <div className="w-[280px] max-w-full border border-dashed border-border p-sm">
      <AuthorByline {...args} />
    </div>
  ),
};
