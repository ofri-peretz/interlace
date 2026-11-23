import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  BookOpen,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { FeaturedIcon } from "@interlace/ui/featured-icon";

const meta: Meta<typeof FeaturedIcon> = {
  title: "Primitives/FeaturedIcon",
  component: FeaturedIcon,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "An icon in a tinted rounded square or circle, with a soft outer ring: the mark at the head of a feature, a step or a section. " +
          "It gives a row of features one shared shape. Every surface is opaque, so the icon keeps its contrast on any card. " +
          "Decorative by default (`aria-hidden`); pass `label` when the icon stands alone and means something.",
      },
    },
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["sm", "md", "lg", "xl"],
      description: "2rem to 3.5rem square; the icon inside is sized with it.",
      table: {
        type: { summary: "'sm' | 'md' | 'lg' | 'xl'" },
        defaultValue: { summary: "md" },
        category: "Appearance",
      },
    },
    tone: {
      control: "inline-radio",
      options: ["primary", "highlight", "neutral", "inverse"],
      description: "The surface and icon colour, all from tokens.",
      table: {
        type: { summary: "'primary' | 'highlight' | 'neutral' | 'inverse'" },
        defaultValue: { summary: "primary" },
        category: "Appearance",
      },
    },
    shape: {
      control: "inline-radio",
      options: ["square", "circle"],
      table: {
        type: { summary: "'square' | 'circle'" },
        defaultValue: { summary: "square" },
        category: "Appearance",
      },
    },
    label: {
      control: "text",
      description:
        'A name for an icon that carries meaning alone. It becomes `role="img"`.',
      table: { type: { summary: "string" }, category: "Accessibility" },
    },
  },
  args: { children: <Sparkles />, size: "lg" },
};

export default meta;
type Story = StoryObj<typeof FeaturedIcon>;

export const Default: Story = {};

/** Every tone and size, square and circle. */
export const Matrix: Story = {
  render: () => (
    <div className="grid gap-8">
      {(["primary", "highlight", "neutral", "inverse"] as const).map((tone) => (
        <div key={tone} className="flex flex-wrap items-center gap-6">
          {(["sm", "md", "lg", "xl"] as const).map((size) => (
            <FeaturedIcon key={size} tone={tone} size={size}>
              <ShieldCheck />
            </FeaturedIcon>
          ))}
          {(["sm", "md", "lg", "xl"] as const).map((size) => (
            <FeaturedIcon
              key={`c-${size}`}
              tone={tone}
              size={size}
              shape="circle"
            >
              <ShieldCheck />
            </FeaturedIcon>
          ))}
        </div>
      ))}
    </div>
  ),
};

/** At the head of feature cards: one shape across the row, aligned whatever the text length. */
export const InFeatureCards: Story = {
  render: () => (
    <ul className="grid gap-6 sm:grid-cols-3">
      {[
        {
          icon: <MessageCircleQuestion />,
          title: "Answers in one place",
          body: "The common questions, answered once and kept current.",
        },
        {
          icon: <BookOpen />,
          title: "Documented",
          body: "Every option has a page with an example you can copy.",
        },
        {
          icon: <ShieldCheck />,
          title: "Safe by default",
          body: "The defaults are the careful choice; you opt out, not in.",
        },
      ].map(({ icon, title, body }) => (
        <li key={title} className="border-border bg-card rounded-xl border p-6">
          <FeaturedIcon size="lg">{icon}</FeaturedIcon>
          <h3 className="font-heading mt-5 text-lg font-semibold">{title}</h3>
          <p className="text-muted-foreground mt-2 text-sm">{body}</p>
        </li>
      ))}
    </ul>
  ),
};

export const Dark: Story = { ...Matrix, globals: { theme: "dark" } };
