import type { Meta, StoryObj } from '@storybook/react-vite';
import { Prose } from '@interlace/ui/prose';
import { ReadingLayout } from '@interlace/ui/patterns/reading-layout';

const TOC = [
  { id: 'closing', label: 'Why the bridge closed', level: 2 as const },
  { id: 'bearings', label: 'The bearings', level: 3 as const },
  { id: 'parts', label: 'Waiting for parts', level: 3 as const },
  { id: 'detour', label: 'The detour', level: 2 as const },
  { id: 'reopening', label: 'Reopening', level: 2 as const },
];

const PARA =
  'The city published the dates on its notice board and its site. Residents remember it differently, and both memories are worth taking seriously, because the detour added twenty minutes to every crossing.';

function Article() {
  return (
    <Prose>
      {TOC.map((item) => {
        const Heading = item.level === 2 ? 'h2' : 'h3';
        return (
          <section key={item.id}>
            <Heading id={item.id} tabIndex={-1}>
              {item.label}
            </Heading>
            <p>{PARA}</p>
            <p>{PARA}</p>
            <p>{PARA}</p>
          </section>
        );
      })}
    </Prose>
  );
}

const meta = {
  title: 'Blocks/ReadingLayout',
  component: ReadingLayout,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A long read with its table of contents. When the layout is at least 56rem wide, a `Toc` rail ' +
          'sits beside the text and stays in view: a marker slides to the section being read and the track ' +
          'fills as you go. Narrower, the contents fold into a slim bar that sticks to the top of the column, ' +
          'names the current section, and opens the list in a bottom sheet. The switch is a container query on the ' +
          "layout's own width, so the same layout folds inside a narrow column with no prop. A page with " +
          'a sticky header sets `--reading-offset` to its height.',
      },
    },
  },
  args: { toc: TOC, children: null },
  argTypes: {
    toc: { control: false },
    children: { control: false },
    tocLabel: { control: 'text', table: { defaultValue: { summary: 'Table of contents' } } },
    triggerLabel: {
      control: 'text',
      description: "The rail's title, the bar's label and the sheet's title.",
      table: { defaultValue: { summary: 'On this page' } },
    },
  },
  render: (args) => (
    <ReadingLayout {...args}>
      <Article />
    </ReadingLayout>
  ),
} satisfies Meta<typeof ReadingLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Wide: the rail beside the text, sticky as you scroll. */
export const Default: Story = {};

/** The same layout in a narrow column: the contents fold into the sticky bar. */
export const NarrowColumn: Story = {
  render: (args) => (
    <div className="max-w-prose">
      <ReadingLayout {...args}>
        <Article />
      </ReadingLayout>
    </div>
  ),
};

/** Below a sticky page header: `--reading-offset` keeps the rail, the bar and heading jumps clear of it. */
export const BelowStickyHeader: Story = {
  render: (args) => (
    <div className="[--reading-offset:3.5rem]">
      <header className="bg-background border-border sticky top-0 z-header flex h-14 items-center border-b px-4 font-semibold">
        Acme
      </header>
      <ReadingLayout {...args} className="pt-6">
        <Article />
      </ReadingLayout>
    </div>
  ),
};

const LONG_TOC = ['Why the bridge closed', 'The bearings', 'Waiting for parts', 'The detour', 'Reopening'].flatMap(
  (label, s) => [
    { id: `l${s}`, label, level: 2 as const },
    { id: `l${s}a`, label: 'What the city said', level: 3 as const },
    { id: `l${s}b`, label: 'What residents remember', level: 3 as const },
  ],
);

function LongArticle() {
  return (
    <Prose>
      {LONG_TOC.map((item) => {
        const Heading = item.level === 2 ? 'h2' : 'h3';
        return (
          <section key={item.id}>
            <Heading id={item.id} tabIndex={-1}>
              {item.label}
            </Heading>
            <p>{PARA}</p>
            <p>{PARA}</p>
          </section>
        );
      })}
    </Prose>
  );
}

/** A long outline: sub-headings show only under the section being read. */
export const LongRead: Story = {
  args: { toc: LONG_TOC },
  render: (args) => (
    <ReadingLayout {...args}>
      <LongArticle />
    </ReadingLayout>
  ),
};

/** No contents list: the text alone, no rail or bar. */
export const WithoutContents: Story = { args: { toc: [] } };
