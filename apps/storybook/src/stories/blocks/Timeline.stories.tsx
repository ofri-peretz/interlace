import type { Meta, StoryObj } from "@storybook/react-vite";
import { Timeline } from "@interlace/ui/patterns/timeline";

// Placeholder record: a fictional bridge and example publishers.
const EVENTS = [
  {
    date: "1931",
    title: "Bridge opens",
    quote: "Open to carts and walkers from Monday.",
    source: "Town gazette",
  },
  {
    date: "1962",
    title: "Cars allowed",
    quote: "The deck now carries two lanes of traffic.",
    source: "County records",
  },
  {
    date: "1998",
    title: "Listed",
    quote: "A structure of local importance.",
    source: "Heritage register",
  },
  {
    date: "2019",
    title: "Survey",
    quote: "The east pier needs work within five years.",
    source: "Engineers’ report",
  },
  {
    date: "2024",
    title: "Closed for repair",
    quote: "Closed 3 March, reopened 14 April.",
    source: "City notice",
    marker: "accent" as const,
  },
  {
    date: "2025",
    title: "Reopened in full",
    quote: "Both lanes and the footpath are open.",
    source: "City notice",
  },
];

const meta = {
  title: "Blocks/Timeline",
  component: Timeline,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A short record in date order: date, title, what was said, and where it comes from. " +
          "Side by side once the timeline itself is 48rem wide, stacked below that, so it is right in a " +
          'narrow column too. Each column is at least 13rem: more events than fit wrap onto a second row with its own rule. `marker="accent"` fills one dot; say in words why that event stands out. ' +
          "For many dated items with filters, use TimelineMap.",
      },
    },
  },
  argTypes: {
    orientation: {
      control: "inline-radio",
      options: ["responsive", "vertical"],
      description: "Rows in a wide column, or always stacked.",
      table: {
        category: "Appearance",
        defaultValue: { summary: "responsive" },
      },
    },
  },
  render: (args) => (
    <Timeline aria-label="The bridge, in order" {...args}>
      {EVENTS.map(({ date, title, quote, source, marker }) => (
        <Timeline.Item
          key={date}
          date={date}
          title={title}
          source={source}
          marker={marker}
        >
          <q>{quote}</q>
        </Timeline.Item>
      ))}
    </Timeline>
  ),
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Wide: rows of columns at least 13rem wide, each row on its own rule. Narrow the canvas to see it stack. */
export const Default: Story = {};

/** A 64rem column, as on a typical article page: six events sit four and two, never six cramped strips. */
export const InAContentColumn: Story = {
  render: (args) => (
    <div className="max-w-(--container-content)">
      <Timeline aria-label="The bridge, in order" {...args}>
        {EVENTS.map(({ date, title, quote, source, marker }) => (
          <Timeline.Item
            key={date}
            date={date}
            title={title}
            source={source}
            marker={marker}
          >
            <q>{quote}</q>
          </Timeline.Item>
        ))}
      </Timeline>
    </div>
  ),
};

/** The same record in a narrow column: it stacks because its own width is small, whatever the viewport. */
export const InANarrowColumn: Story = {
  render: (args) => (
    <div className="max-w-prose">
      <Timeline aria-label="The bridge, in order" {...args}>
        {EVENTS.slice(2).map(({ date, title, quote, source, marker }) => (
          <Timeline.Item
            key={date}
            date={date}
            title={title}
            source={source}
            marker={marker}
          >
            <q>{quote}</q>
          </Timeline.Item>
        ))}
      </Timeline>
    </div>
  ),
};
