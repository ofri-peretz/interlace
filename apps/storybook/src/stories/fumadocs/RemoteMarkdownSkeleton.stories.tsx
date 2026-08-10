import type { Meta, StoryObj } from '@storybook/react-vite';
import { RemoteMarkdownSkeleton } from '@interlace/ui/fumadocs/remote-markdown-skeleton';

const meta: Meta<typeof RemoteMarkdownSkeleton> = {
  title: 'Fumadocs/RemoteMarkdownSkeleton',
  component: RemoteMarkdownSkeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The `<Suspense fallback>` for `<RemoteMarkdown>`. A page whose body is fetched from GitHub at request time has a real gap on an ISR cold start, and the choice is between a blank flash, a spinner that reserves no space, or a shape that matches what is about to land. This is the third one.\n\n' +
          'Match the props to the page you are covering: `withSourceCallout` and `withHeading` reserve the two fixed elements above the body, and `rows` should approximate the article, not the viewport — a 6-row skeleton in front of a 40-paragraph page is honest about the delay in a way a full-screen one is not.\n\n' +
          'It renders `aria-hidden`, so a screen reader hears nothing until the content arrives rather than being read a fake page. That means the loading state must be announced by whatever owns the region, not by this.',
      },
    },
  },
  argTypes: {
    rows: {
      control: { type: 'range', min: 1, max: 16, step: 1 },
      description:
        'Paragraph bars under the heading. Widths are deterministic (75–99%, cycling) rather than random, so the placeholder does not shimmer differently on every render — and so a visual snapshot of it is stable.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '6' }, category: 'Data' },
    },
    withHeading: {
      control: 'boolean',
      description:
        'Reserve the page title bar. Turn it off where the heading is server-rendered from frontmatter and only the body is in flight — reserving space for something already on screen pushes the real content down.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Appearance' },
    },
    withSourceCallout: {
      control: 'boolean',
      description:
        'Reserve the `RemoteSourceCallout` bar at the top. It is the tallest fixed element on these pages, so omitting it when the real page has one is the single biggest source of layout shift here.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Appearance' },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the wrapper. Constrain it to the same measure as the article it stands in for — a full-bleed skeleton in front of a `max-w-prose` body reflows the whole column when the text lands.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RemoteMarkdownSkeleton>;

export const Default: Story = {
  args: {
    rows: 6,
    withHeading: true,
    withSourceCallout: true,
  },
};

export const Minimal: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Body only — for a page that already rendered its callout and title from local frontmatter and is waiting on the remote markdown alone.',
      },
    },
  },
  args: {
    rows: 3,
    withHeading: false,
    withSourceCallout: false,
  },
};
