import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { FlipCard } from "@interlace/ui/patterns/flip-card";
import { withRtl } from "@/decorators";

const meta: Meta<typeof FlipCard> = {
  title: "Blocks/FlipCard",
  component: FlipCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A card with a front that asks and a back that answers. Pressing it turns it over in 3D, so the reader makes a guess before the answer arrives. " +
          "Both faces stay in the DOM and the card is as tall as its taller face, so a grid of them stays aligned. " +
          "The hidden face is inert and focus follows the turn. Without JavaScript both faces show; under reduced motion the faces cross-fade.",
      },
    },
  },
  argTypes: {
    front: {
      control: false,
      description: "The side that asks.",
      table: { category: "Slots", type: { summary: "ReactNode" } },
    },
    back: {
      control: false,
      description:
        "The side that answers. Links and other controls are fine here; they are inert while the card shows its front.",
      table: { category: "Slots", type: { summary: "ReactNode" } },
    },
    revealLabel: {
      control: "text",
      table: { category: "Content", defaultValue: { summary: "Show answer" } },
    },
    returnLabel: {
      control: "text",
      table: {
        category: "Content",
        defaultValue: { summary: "Show question" },
      },
    },
    flipped: {
      control: "boolean",
      description: "Controlled state.",
      table: { category: "State" },
    },
    defaultFlipped: {
      control: "boolean",
      table: { category: "State", defaultValue: { summary: "false" } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FlipCard>;

const Front = ({ n, q }: { n: string; q: string }) => (
  <>
    <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
      Question {n}
    </p>
    <p className="font-heading mt-3 text-xl font-semibold text-balance">{q}</p>
  </>
);

const Back = ({ a, source }: { a: string; source: string }) => (
  <>
    <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
      Answer
    </p>
    <p className="mt-3 text-base leading-relaxed">{a}</p>
    <a
      href="#source"
      className="text-primary mt-3 text-sm underline underline-offset-4"
    >
      {source}
    </a>
  </>
);

export const Default: Story = {
  args: {
    front: <Front n="1" q="How tall is the tallest tree ever measured?" />,
    back: (
      <Back
        a="About 116 metres: a coast redwood in California, measured in 2006."
        source="Forest survey, 2006"
      />
    ),
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const reveal = canvas.getByRole("button", { name: /show answer/i });
    await step(
      "the back is hidden and its link cannot be tabbed to",
      async () => {
        await expect(reveal).toHaveAttribute("aria-expanded", "false");
        await waitFor(() =>
          expect(
            canvasElement.querySelector('[data-slot="flip-card-back"]'),
          ).toHaveAttribute("inert"),
        );
      },
    );
    await step("pressing turns it, and focus follows to the back", async () => {
      await userEvent.click(reveal);
      const back = canvas.getByRole("button", { name: /show question/i });
      await waitFor(() => expect(back).toHaveFocus());
      await expect(back).toHaveAttribute("aria-expanded", "true");
      await expect(
        canvasElement.querySelector('[data-slot="flip-card-front"]'),
      ).toHaveAttribute("inert");
    });
    await step("Enter turns it back", async () => {
      await userEvent.keyboard("{Enter}");
      await waitFor(() =>
        expect(
          canvas.getByRole("button", { name: /show answer/i }),
        ).toHaveFocus(),
      );
    });
  },
};

/** A grid: each card is as tall as its taller face, and a row shares one height. */
export const Grid: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <FlipCard
        front={<Front n="1" q="How tall is the tallest tree ever measured?" />}
        back={
          <Back
            a="About 116 metres: a coast redwood in California, measured in 2006."
            source="Forest survey, 2006"
          />
        }
      />
      <FlipCard
        front={<Front n="2" q="Which planet has the shortest day?" />}
        back={
          <Back
            a="Jupiter. It turns once in just under ten hours."
            source="Planetary data sheet"
          />
        }
      />
      <FlipCard
        front={<Front n="3" q="How much of the Earth’s surface is ocean?" />}
        back={
          <Back
            a="About 71 percent. Most of the planet’s water is in the oceans; only a small share is fresh, and most of that is ice."
            source="Ocean survey"
          />
        }
      />
    </div>
  ),
};

/** Starts on its answer. */
export const StartsFlipped: Story = {
  args: { ...Default.args, defaultFlipped: true },
  play: undefined,
};

export const Dark: Story = {
  ...Default,
  globals: { theme: "dark" },
  play: undefined,
};
export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
  play: undefined,
};
