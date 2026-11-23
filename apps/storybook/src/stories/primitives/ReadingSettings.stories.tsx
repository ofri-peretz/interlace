import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ContrastToggle, TextSizeControl } from '@interlace/ui/reading-settings';
import { Button } from '@interlace/ui/button';
import { Input } from '@interlace/ui/input';
import {
  CONTRAST_STORAGE_KEY,
  TEXT_SIZE_STORAGE_KEY,
} from '@interlace/ui/theme-script';

/**
 * Each story starts from the defaults. The controls write to `<html>` and
 * `localStorage` for real, so without this a size chosen in one story would
 * follow the reader into every other story in the sidebar.
 */
const fresh: Decorator = (Story) => {
  try {
    localStorage.removeItem(TEXT_SIZE_STORAGE_KEY);
    localStorage.removeItem(CONTRAST_STORAGE_KEY);
  } catch {
    /* storage blocked: nothing to clear */
  }
  document.documentElement.removeAttribute('data-text-size');
  document.documentElement.removeAttribute('data-contrast');
  return Story();
};

/** Back to the defaults, so a play run leaves the canvas as it found it. */
async function reset(canvas: ReturnType<typeof within>) {
  await userEvent.click(canvas.getByRole('button', { name: /Reset text size/ }));
  const contrast = canvas.queryByRole('button', { name: 'More contrast' });
  if (contrast?.getAttribute('aria-pressed') === 'true') await userEvent.click(contrast);
  localStorage.removeItem(CONTRAST_STORAGE_KEY);
  document.documentElement.removeAttribute('data-contrast');
}

const rootPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);

/**
 * Reading settings for the reader: text size and More contrast.
 *
 * Both write an attribute on `<html>` (`data-text-size`, `data-contrast`),
 * remember the choice, and `THEME_SCRIPT` restores it before first paint.
 */
const meta: Meta<typeof TextSizeControl> = {
  title: 'Primitives/ReadingSettings',
  component: TextSizeControl,
  tags: ['autodocs'],
  decorators: [fresh],
  parameters: {
    docs: {
      description: {
        component:
          'Two small controls for the reader. `TextSizeControl` sets the root font size to 100, 112, 125 or 150% of the browser default, so type, spacing, control heights and containers grow together and the layout holds. `ContrastToggle` turns on More contrast, the AAA reading mode, and stores an explicit choice so it can also turn the OS `prefers-contrast` setting off. Both persist to `localStorage`; ship `THEME_SCRIPT` in `<head>` so a returning reader never sees the page reflow. Words are props, so both translate.',
      },
    },
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'The group’s accessible name.',
      table: { category: 'A11y', type: { summary: 'string' }, defaultValue: { summary: "'Text size'" } },
    },
    labels: {
      control: 'object',
      description: 'Names of the smaller, reset and larger buttons, for translation.',
      table: { category: 'A11y', type: { summary: '{ smaller?; reset?; larger? }' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TextSizeControl>;

/** Both controls, the way a site header or a settings panel would carry them. */
export const Default: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <TextSizeControl {...args} />
      <ContrastToggle />
    </div>
  ),
};

/**
 * Larger text grows the whole layout, not only the words: the root font size
 * moves, and every rem follows. The play steps to the top and checks that
 * the page has not grown a horizontal scrollbar.
 */
export const GrowsTheLayout: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      <TextSizeControl {...args} />
      <article className="flex max-w-(--container-prose) flex-col gap-3">
        <h2 className="text-h3 font-semibold">Readable at any size</h2>
        <p className="text-body text-muted-foreground">
          A reader who needs larger text should get a larger page, not text that
          spills out of boxes sized for the default. Every height and gap here is
          in rem, so it all grows together.
        </p>
        <form className="flex flex-wrap gap-2" onSubmit={(event) => event.preventDefault()}>
          <Input aria-label="Email" placeholder="you@example.com" className="min-w-0 flex-1" />
          <Button type="submit">Subscribe</Button>
        </form>
      </article>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const base = rootPx();
    const larger = canvas.getByRole('button', { name: 'Larger text' });

    await userEvent.click(larger);
    await waitFor(() => expect(rootPx()).toBeCloseTo(base * 1.125, 1));
    await userEvent.click(larger);
    await userEvent.click(larger);
    await waitFor(() => expect(rootPx()).toBeCloseTo(base * 1.5, 1));
    await expect(larger).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.getByRole('button', { name: /150%/ })).toBeInTheDocument();

    const page = document.documentElement;
    await expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth);

    await reset(canvas);
    await waitFor(() => expect(rootPx()).toBeCloseTo(base, 1));
  },
};

/** More contrast on and off. Off stores `normal`, which also overrides the OS. */
export const Contrast: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <ContrastToggle />
      <p className="text-body text-muted-foreground">
        Muted text like this reaches 7:1 when More contrast is on.
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'More contrast' });
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-contrast')).toBe('more'),
    );
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-contrast')).toBe('normal'),
    );
    localStorage.removeItem(CONTRAST_STORAGE_KEY);
    document.documentElement.removeAttribute('data-contrast');
  },
};

/** The icon-only toggle for a crowded header. The name stays on the button. */
export const IconOnlyContrast: Story = {
  render: () => <ContrastToggle showLabel={false} />,
};

/** Every word is a prop. */
export const Translated: Story = {
  args: {
    label: 'Taille du texte',
    labels: { smaller: 'Plus petit', reset: 'Taille normale', larger: 'Plus grand' },
  },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3" lang="fr">
      <TextSizeControl {...args} />
      <ContrastToggle label="Plus de contraste" />
    </div>
  ),
};
