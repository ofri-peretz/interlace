import type { Meta, StoryObj } from "@storybook/react-vite";
import { Trophy } from "lucide-react";
import { SectionHeader } from "@interlace/ui/patterns/section-header";

const meta: Meta<typeof SectionHeader> = {
  title: "Blocks/SectionHeader",
  component: SectionHeader,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          'The "text-center mb-12 + h2 + tagline" pattern from LAYOUT_PHILOSOPHY.md §1, ' +
          "lifted into one component so six homepage sections stop drifting apart. It " +
          "owns the heading and its bottom margin only — no background, no container — " +
          "so it drops into whatever section wrapper you already have. Use PageHeader " +
          "for the page h1 and Hero for above-the-fold display type.",
      },
    },
  },
  argTypes: {
    title: {
      control: "text",
      description: "The heading text. Rendered at the level given by `as`.",
      table: { type: { summary: "ReactNode" } },
    },
    tagline: {
      control: "text",
      description:
        'Subhead under the title, capped at `max-w-prose` and centred with the title when `align="center"`.',
      table: { type: { summary: "ReactNode" } },
    },
    eyebrow: {
      control: false,
      description:
        "A short label above the title. It follows `align`. Plain text is set small and in the primary colour; pass your own chip for anything richer.",
      table: { type: { summary: "ReactNode" }, category: "Slots" },
    },
    eyebrowStyle: {
      control: "inline-radio",
      options: ["plain", "pill"],
      description:
        "`pill` wraps the eyebrow in an outlined, rounded chip; `plain` leaves it as small text.",
      table: {
        type: { summary: "'plain' | 'pill'" },
        defaultValue: { summary: "plain" },
        category: "Appearance",
      },
    },
    size: {
      control: "inline-radio",
      options: ["default", "display"],
      description:
        "The title size, both fluid from phone to laptop: `default` is `text-section` (28 → 40px), `display` is `text-display` (44 → 64px) for the one loudest line on a page. The heading level stays whatever `as` says.",
      table: {
        type: { summary: "'default' | 'display'" },
        defaultValue: { summary: "default" },
        category: "Appearance",
      },
    },
    align: {
      control: "select",
      options: ["center", "start"],
      description:
        "Centred for full-width marketing sections; `start` inside a prose-width column, where a centred heading fights the text gutter.",
      table: {
        type: { summary: "'center' | 'start'" },
        defaultValue: { summary: "center" },
        category: "Appearance",
      },
    },
    spacing: {
      control: "select",
      options: ["md", "lg"],
      description:
        "Gap before the section body, a fraction of the section rhythm tokens so it grows with the band: `md` 38 → 64px, `lg` 48 → 72px.",
      table: {
        type: { summary: "'md' | 'lg'" },
        defaultValue: { summary: "lg" },
        category: "Appearance",
      },
    },
    as: {
      control: "select",
      options: ["h1", "h2", "h3"],
      description:
        "Heading level. Keep the document outline honest — h2 for a top-level section, h3 for a nested one. The visual size does not change with it.",
      table: {
        type: { summary: "'h1' | 'h2' | 'h3'" },
        defaultValue: { summary: "h2" },
        category: "Accessibility",
      },
    },
    className: {
      control: "text",
      description:
        "Merged after the align / spacing variants — the override seam.",
      table: { category: "Appearance" },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SectionHeader>;

export const Default: Story = {
  args: {
    title: "See it in action",
    tagline:
      "Clean configuration, powerful protection. Works with ESLint 8 and 9, flat config or legacy.",
    align: "center",
    spacing: "lg",
    as: "h2",
  },
};

export const WithEyebrow: Story = {
  args: {
    eyebrow: (
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
        <Trophy className="text-primary size-3.5" aria-hidden />
        Featured in DEV Community Top 7
      </span>
    ),
    title: "Trusted by developers",
    tagline: "Security insights from teams shipping production JavaScript.",
  },
};

/** The eyebrow in a pill: a quiet section label, centred or at the start. */
export const PillEyebrow: Story = {
  args: {
    eyebrow: "Features",
    eyebrowStyle: "pill",
    title: "Everything a section needs, nothing it does not",
    tagline:
      "A label, a title on the fluid scale, and a tagline capped at a readable width.",
  },
};

/** The display size, for the one loudest line on a page. Resize the canvas: it glides, it does not jump. */
export const Display: Story = {
  args: {
    eyebrow: "Start here",
    eyebrowStyle: "pill",
    title: "Ask the question out loud",
    tagline:
      "The display size is for a page’s single strongest line, not for every section.",
    size: "display",
  },
};

/** Start-aligned with a pill, as it sits at the head of a split section. */
export const StartWithPill: Story = {
  args: {
    eyebrow: "How it works",
    eyebrowStyle: "pill",
    title: "Three steps, in order",
    tagline:
      'With `align="start"` the eyebrow, title and tagline all line up on the start edge, in either direction.',
    align: "start",
  },
};

export const TitleOnly: Story = {
  args: {
    title: "How it works",
  },
};

export const LeftAligned: Story = {
  args: {
    title: "Long-form rule docs",
    tagline:
      "When the section sits inside a prose-width container, the start alignment keeps the eye on the gutter.",
    align: "start",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div>
      <SectionHeader
        title="Centered (default)"
        tagline="Tagline takes max-w-prose under the headline."
      />
      <SectionHeader
        align="start"
        title="Left-aligned"
        tagline="Used inside prose-width containers."
      />
      <SectionHeader
        eyebrow={
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            With eyebrow
          </span>
        }
        title="Eyebrow above"
        tagline="Use the eyebrow slot for chips / badges that frame the section."
      />
    </div>
  ),
};
