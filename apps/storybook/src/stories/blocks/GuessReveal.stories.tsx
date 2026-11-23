import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { GuessReveal } from "@interlace/ui/patterns/guess-reveal";
import { withRtl } from "@/decorators";

const OPTIONS = [
  { id: "mercury", label: "Mercury" },
  { id: "jupiter", label: "Jupiter", correct: true },
  { id: "mars", label: "Mars" },
  { id: "venus", label: "Venus" },
];

const EXPLANATION = (
  <>
    Jupiter turns once in just under ten hours, the shortest day of any planet.{" "}
    <a href="#source" className="text-primary underline underline-offset-4">
      Planetary data sheet
    </a>
  </>
);

const meta: Meta<typeof GuessReveal> = {
  title: "Blocks/GuessReveal",
  component: GuessReveal,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A one-question quiz: a question, two to four answers, and an explanation that opens once the reader picks. " +
          "The pick is marked right or wrong in words and with a short movement, and the right answer is always shown. " +
          "`onAnswer` hands the pick to the consumer to record. The status is a polite live region; without JavaScript a details element holds the answer.",
      },
    },
  },
  argTypes: {
    question: {
      control: "text",
      table: { category: "Content", type: { summary: "ReactNode" } },
    },
    options: {
      control: "object",
      description:
        "Two to four `{ id, label, correct? }`. Mark exactly one `correct`.",
      table: { category: "Content", type: { summary: "GuessRevealOption[]" } },
    },
    explanation: {
      control: false,
      description:
        "Opens after the pick: why the answer is right, with its source.",
      table: { category: "Slots", type: { summary: "ReactNode" } },
    },
    answer: {
      control: "text",
      description: "Controlled pick (an option id), or null.",
      table: { category: "State" },
    },
    defaultAnswer: { control: "text", table: { category: "State" } },
    onAnswer: {
      action: "answered",
      table: { category: "Events", type: { summary: "(id, correct) => void" } },
    },
    labels: {
      control: "object",
      description:
        "Status words and the no-JS summary: `{ right, wrong, reveal }`.",
      table: { category: "Content" },
    },
  },
  args: {
    question: "Which planet has the shortest day?",
    options: OPTIONS,
    explanation: EXPLANATION,
  },
  render: (args) => (
    <div className="max-w-144">
      <GuessReveal {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof GuessReveal>;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step(
      "a wrong pick is marked and the right answer shown",
      async () => {
        await userEvent.click(canvas.getByRole("button", { name: /mars/i }));
        await expect(
          canvas.getByRole("button", { name: /mars/i }),
        ).toHaveAttribute("data-result", "wrong");
        await expect(
          canvas.getByRole("button", { name: /jupiter/i }),
        ).toHaveAttribute("data-result", "right");
        await waitFor(() =>
          expect(canvas.getByText("Not quite.")).toBeVisible(),
        );
      },
    );
    await step("the explanation opens and its link is reachable", async () => {
      await expect(
        canvasElement.querySelector('[data-slot="guess-reveal-explanation"]'),
      ).not.toHaveAttribute("inert");
      // It fades in over 300ms.
      await waitFor(() =>
        expect(
          canvas.getByRole("link", { name: /planetary data sheet/i }),
        ).toBeVisible(),
      );
    });
    await step("a second pick does nothing", async () => {
      await userEvent.click(canvas.getByRole("button", { name: /venus/i }));
      await expect(
        canvas.getByRole("button", { name: /venus/i }),
      ).toHaveAttribute("data-result", "none");
    });
  },
};

/** Already answered correctly. */
export const AnsweredRight: Story = { args: { defaultAnswer: "jupiter" } };

/** Two options: a true-or-false claim. */
export const TrueOrFalse: Story = {
  args: {
    question:
      "True or false: the Great Wall is visible from the Moon with the naked eye.",
    options: [
      { id: "true", label: "True" },
      { id: "false", label: "False", correct: true },
    ],
    explanation:
      "False. It is far too narrow; astronauts have said they could not pick it out even from low orbit.",
    defaultAnswer: "true",
  },
};

export const Dark: Story = {
  args: { defaultAnswer: "mars" },
  globals: { theme: "dark" },
};
export const RTL: Story = {
  args: { defaultAnswer: "mars" },
  decorators: [withRtl],
};
