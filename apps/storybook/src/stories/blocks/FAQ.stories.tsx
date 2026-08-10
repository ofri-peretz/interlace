import type { Meta, StoryObj } from '@storybook/react-vite';
import { FAQ } from '@interlace/ui/patterns/faq';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof FAQ> = {
  title: 'Blocks/FAQ',
  component: FAQ,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Question-and-answer section built as a disclosure list: pass an array of ' +
          '`{ question, answer }` and the keyboard handling, ARIA and open/close animation ' +
          'come from the Accordion primitive underneath. Use it for genuine FAQs at prose ' +
          'width; if the answers are long enough to need their own headings or code blocks, ' +
          'they belong on a docs page rather than folded into an accordion.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Section heading above the list, rendered as a balanced `h2`.',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    lead: {
      control: 'text',
      description: 'Optional muted intro line under the title.',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    items: {
      control: 'object',
      description:
        'The questions. `question` becomes the trigger and `answer` the panel; both are ReactNode, so an answer can carry a link or inline code. An empty array renders nothing at all — no accordion shell, no placeholder.',
      table: {
        category: 'Data',
        type: { summary: 'Array<{ question: ReactNode; answer: ReactNode }>' },
        defaultValue: { summary: '[]' },
      },
    },
    multiple: {
      control: 'boolean',
      description:
        'Allow more than one panel open at once. Leave it off when the answers are comparable (the reader is picking one); turn it on when they are checklist-style and read together.',
      table: { category: 'Behavior', type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    loading: {
      control: 'boolean',
      description: 'Render a stack of card skeletons in place of the accordion.',
      table: { category: 'State', type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    loadingCount: {
      control: { type: 'range', min: 1, max: 10, step: 1 },
      description: 'How many skeleton rows to paint while loading.',
      table: { category: 'State', type: { summary: 'number' }, defaultValue: { summary: '4' } },
    },
    className: {
      control: 'text',
      description: 'Merged onto the `<section>` — the seam for section padding or a tinted band.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FAQ>;

const sampleItems = [
  {
    question: 'Do I need to install every primitive separately?',
    answer:
      'No. Run `npx shadcn add @interlace/theme` and you get the full CSS contract. Add individual primitives only as you need them.',
  },
  {
    question: 'Is Interlace tied to Next.js?',
    answer:
      'No. Primitives are framework-agnostic React 19. The DS ships with Next examples because most consumers use it, but the components work in Vite, Remix, Astro, etc.',
  },
  {
    question: 'How do I fork the brand?',
    answer:
      'Declare `@layer interlace.brand` after importing index.css and override the `--interlace-*` tokens. See the theme-authoring guide.',
  },
  {
    question: 'What about WCAG?',
    answer:
      'WCAG 2.2 AA is a hard gate. Every story is axe-scanned in CI. Zero suppressions, zero asterisks.',
  },
];

export const Default: Story = {
  args: {
    title: 'Frequently asked questions',
    lead: 'The four things people ask before they install anything.',
    items: sampleItems,
    multiple: false,
    loading: false,
    loadingCount: 4,
  },
};

export const Multiple: Story = {
  args: { ...Default.args, multiple: true },
};

export const Loading: Story = { args: { loading: true } };

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
