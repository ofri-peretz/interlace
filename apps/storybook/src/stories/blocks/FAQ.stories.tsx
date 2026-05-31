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
          'Frequently-asked-questions disclosure. Composes the Accordion primitive. Single-open by default; pass `multiple` to allow multi-open.',
      },
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
    items: sampleItems,
  },
};

export const Multiple: Story = {
  args: { ...Default.args, multiple: true },
};

export const Loading: Story = { args: { loading: true } };

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
