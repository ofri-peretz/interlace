import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight } from "lucide-react";
import { Button } from "@interlace/ui/button";
import { Hero } from "@interlace/ui/patterns/hero";

const meta: Meta<typeof Hero> = {
  title: "Blocks/Hero",
  component: Hero,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The above-the-fold landing section: eyebrow, headline, body, CTA cluster, and " +
          "an optional media slot that flips the layout from one centred column to a " +
          "two-column grid. It is the plain-surface hero — it inherits the page " +
          "background and paints no decoration; reach for HeroCosmic when the section " +
          "should own its own dark starfield surface.",
      },
    },
  },
  argTypes: {
    eyebrow: {
      control: "text",
      description:
        "Small accent line above the headline — version, date, or a category. Not a heading, so keep it short.",
      table: { type: { summary: "ReactNode" } },
    },
    headline: {
      control: "text",
      description: "Display headline. The only required prop.",
      table: { type: { summary: "ReactNode" } },
    },
    body: {
      control: "text",
      description:
        "Supporting paragraph, capped at prose width under the headline.",
      table: { type: { summary: "ReactNode" } },
    },
    actions: {
      control: false,
      description:
        "CTA cluster — typically a primary Button and a secondary one. Elements only; see the Default story source.",
      table: { type: { summary: "ReactNode" }, category: "Slots" },
    },
    media: {
      control: false,
      description:
        "Right-column visual: image, video, CodeWindow, decorative SVG. Supplying it is what switches the hero to the two-column layout — there is no `layout` prop.",
      table: { type: { summary: "ReactNode" }, category: "Slots" },
    },
    mediaRole: {
      control: "inline-radio",
      options: ["content", "decorative"],
      description:
        "Whether screen readers read the media. `content` (default) keeps it in the accessibility tree, which a form, an interactive panel or a meaningful image needs. `decorative` hides it, only for ornament that holds nothing focusable.",
      table: {
        type: { summary: "'content' | 'decorative'" },
        defaultValue: { summary: "content" },
        category: "Accessibility",
      },
    },
    className: {
      control: "text",
      description:
        "Merged onto the `<section>` — the padding / background seam.",
      table: { category: "Appearance" },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    eyebrow: "",
    headline: "Production-grade React primitives for shadcn.",
    body: "Drop in @interlace/ui — brand tokens, theme bridge, animation keyframes, and a portable 26-rule component-modeling floor — installed alongside.",
    actions: (
      <>
        <Button>
          Get started
          <ArrowRight className="ml-1 size-4" aria-hidden />
        </Button>
        <Button variant="ghost">View on GitHub</Button>
      </>
    ),
  },
};

export const WithEyebrow: Story = {
  args: {
    eyebrow: "v2.0 · February 2026",
    headline: "A design system that scales with the brand.",
    body: "One token layer, every surface — docs, storybook, registry, blog, future apps. Brand-fork seam at the --interlace-* primitive layer.",
    actions: (
      <>
        <Button>Read the changelog</Button>
        <Button variant="outline">See the release</Button>
      </>
    ),
  },
};

export const TwoColumn: Story = {
  args: {
    eyebrow: "Designed for engineers",
    headline: "See the source, copy the source.",
    body: "Every primitive ships with its full TSX inline — no bundled black boxes. Install via the shadcn CLI; the file lands in your repo.",
    actions: (
      <>
        <Button>Install a primitive</Button>
        <Button variant="ghost">Browse the catalog</Button>
      </>
    ),
    media: (
      <div className="bg-card text-card-foreground border-border rounded-xl border p-6 font-mono text-xs">
        <div className="text-muted-foreground">
          $ npx shadcn@latest add @interlace/button
        </div>
        {/* `text-success`, not `text-emerald-600` — the raw palette scored
            3.65:1 on white and failed the enforced AA/AAA contrast gate. */}
        <div className="mt-2 text-success">
          ✓ Created src/components/ui/button.tsx
        </div>
        <div className="text-success">✓ Updated tailwind.config.ts</div>
        <div className="text-success">✓ Installed dependencies</div>
      </div>
    ),
  },
};

/** An interactive panel in the media slot stays readable and reachable: the slot is not hidden by default. */
export const InteractiveMedia: Story = {
  args: {
    headline: "Find an answer in seconds.",
    body: "The media slot can hold a working control. Screen readers reach it like any other part of the page.",
    media: (
      <form
        className="bg-card border-border grid gap-3 rounded-xl border p-6"
        onSubmit={(e) => e.preventDefault()}
      >
        <label htmlFor="hero-search" className="text-sm font-medium">
          Search the questions
        </label>
        <input
          id="hero-search"
          type="search"
          placeholder="Type a question"
          className="border-input bg-background h-10 rounded-md border px-3 text-sm"
        />
        <Button type="submit">Search</Button>
      </form>
    ),
  },
  play: async ({ canvasElement }) => {
    const media = canvasElement.querySelector('[data-slot="hero-media"]');
    if (!media || media.closest('[aria-hidden="true"]'))
      throw new Error("Interactive media must not be aria-hidden");
  },
};

/** Ornament that repeats nothing: `mediaRole="decorative"` hides it from assistive tech. */
export const DecorativeMedia: Story = {
  args: {
    headline: "A calm page, with a little ornament.",
    body: "The shape on the right says nothing the headline does not, so it is hidden from screen readers.",
    mediaRole: "decorative",
    media: (
      <div className="from-primary/30 to-highlight/40 aspect-square rounded-full bg-linear-to-br" />
    ),
  },
};
