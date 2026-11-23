import type { Meta, StoryObj } from "@storybook/react-vite";
import { CTASection } from "@interlace/ui/patterns/cta-section";
import { Button } from "@interlace/ui/button";
import { Input } from "@interlace/ui/input";
import { GridField } from "@interlace/ui/effects/grid-field";
import { withRtl } from "@/decorators";

const meta: Meta<typeof CTASection> = {
  title: "Blocks/CTASection",
  component: CTASection,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full-width closing band: heading, one paragraph and one or two buttons, centred " +
          "on a tinted surface. Reach for it as the last section of a landing or docs page " +
          '("Ready to ship?", "Read the docs"). Keep to a single `primary`-tone instance per ' +
          "page — a second one competes with the first and neither reads as the main action.",
      },
    },
  },
  argTypes: {
    title: {
      control: "text",
      description: "The ask, rendered as a balanced `h2`. Keep it to one line.",
      table: { category: "Content", type: { summary: "ReactNode" } },
    },
    description: {
      control: "text",
      description:
        "Supporting paragraph, clamped to `max-w-prose` so it stays readable on a wide band.",
      table: { category: "Content", type: { summary: "ReactNode" } },
    },
    actions: {
      control: false,
      description:
        "The button row — typically one primary Button plus one outline Button. Stacks on mobile, goes side-by-side from `sm`. Not editable from Controls; pass nodes in code.",
      table: { category: "Slots", type: { summary: "ReactNode" } },
    },
    tone: {
      control: "select",
      options: ["subtle", "primary", "neutral"],
      description:
        "Surface treatment. `subtle` is a brand-tinted neutral, `primary` is the fully-branded band (its description drops to full-opacity foreground so contrast clears AAA), `neutral` is a plain card with hairline rules top and bottom.",
      table: {
        category: "Appearance",
        type: { summary: "'subtle' | 'primary' | 'neutral'" },
        defaultValue: { summary: "subtle" },
      },
    },
    variant: {
      control: "inline-radio",
      options: ["band", "card"],
      description:
        "`band` paints the full width; `card` is a contained rounded card inside the content width, with the page showing around it.",
      table: {
        category: "Appearance",
        type: { summary: "'band' | 'card'" },
        defaultValue: { summary: "band" },
      },
    },
    align: {
      control: "inline-radio",
      options: ["center", "start"],
      description:
        "Where the copy and the actions sit. `start` follows the writing direction.",
      table: {
        category: "Appearance",
        type: { summary: "'center' | 'start'" },
        defaultValue: { summary: "center" },
      },
    },
    background: {
      control: false,
      description:
        "A decorative layer behind the copy (a GridField, a gradient), clipped to the band or the card and hidden from assistive tech.",
      table: { category: "Slots", type: { summary: "ReactNode" } },
    },
    children: {
      control: false,
      description:
        "Rendered under the actions, up to 28rem wide: a search box, a sign-up form, anything beyond buttons.",
      table: { category: "Slots", type: { summary: "ReactNode" } },
    },
    loading: {
      control: "boolean",
      description:
        "Replace the band with a fixed-height card skeleton so the page does not shift when the copy arrives.",
      table: {
        category: "State",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    className: {
      control: "text",
      description:
        "Merged onto the `<section>`, after the tone classes — so this is also the override seam for the band background.",
      table: { category: "Appearance", type: { summary: "string" } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CTASection>;

export const Default: Story = {
  args: {
    title: "Ship your design system today",
    description:
      "Drop-in primitives, R1-R26 enforced API, every story a11y-scanned in CI. Install with one npx command.",
    actions: (
      <>
        <Button size="lg">Get started</Button>
        <Button variant="outline" size="lg">
          Read the docs
        </Button>
      </>
    ),
    tone: "subtle",
    loading: false,
  },
};

export const Primary: Story = { args: { ...Default.args, tone: "primary" } };
export const Neutral: Story = { args: { ...Default.args, tone: "neutral" } };
export const Loading: Story = { args: { loading: true } };
export const Dark: Story = { ...Default, globals: { theme: "dark" } };
export const RTL: Story = { ...Default, decorators: [withRtl] };

/** A contained card inside the content width, with the page around it. */
export const Card: Story = { args: { ...Default.args, variant: "card" } };

/** A card with a decorative GridField behind the copy. */
export const CardWithBackground: Story = {
  args: {
    ...Default.args,
    variant: "card",
    tone: "neutral",
    background: <GridField className="opacity-60" />,
  },
};

/** Start-aligned, with a search box under the copy instead of buttons. */
export const CardWithSearch: Story = {
  args: {
    title: "Can’t find what you need?",
    description: "Search everything, or ask and we will add it.",
    variant: "card",
    align: "start",
    children: (
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <Input
          type="search"
          aria-label="Search"
          placeholder="Search"
          className="bg-background"
        />
        <Button type="submit">Search</Button>
      </form>
    ),
  },
};

export const CardRTL: Story = { ...CardWithSearch, decorators: [withRtl] };
