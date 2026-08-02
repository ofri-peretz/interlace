import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Skeleton } from '@interlace/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@interlace/ui/pagination';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof Pagination> = {
  title: 'Primitives/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Classic numbered pagination per `PAGINATION_PHILOSOPHY.md` — explicit page links, URL state, never infinite scroll. The active page is marked with `aria-current="page"` for assistive tech.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Pagination>;

export const Default: Story = {
  // Pagination anchors are `size-9` (36×36 — well above WCAG 2.2's 24×24
  // target-size threshold). The earlier suppression existed because the
  // adjacent `gap-1` (4px) put axe's spacing-exception circle math into a
  // borderline state. Override the default content gap to a comfortable
  // `gap-2` (8px) — boundary-to-boundary spacing is now well clear of the
  // target-size threshold, and the suppression is no longer needed.
  render: () => (
    <Pagination>
      <PaginationContent className="gap-2">
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" active>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">3</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
};

/**
 * Keyboard-only flow: every page control is a real link in the tab order,
 * the current page carries `aria-current="page"`, and the ellipsis exposes
 * "More pages" to screen readers instead of being silently `aria-hidden`.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <Pagination>
      <PaginationContent className="gap-2">
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" active>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('The nav exposes an accessible name', async () => {
      expect(canvas.getByRole('navigation', { name: /pagination/i })).toBeTruthy();
    });

    await step('Exactly one link is aria-current="page"', async () => {
      const current = canvas
        .getAllByRole('link')
        .filter((a) => a.getAttribute('aria-current') === 'page');
      expect(current).toHaveLength(1);
      expect(current[0].textContent?.trim()).toBe('2');
    });

    await step('The gap marker is announced, not hidden', async () => {
      // Regression guard: `aria-hidden` on the wrapper would have swallowed
      // the sr-only text with it.
      expect(canvas.getByText('More pages')).toBeTruthy();
    });

    await step('Tab walks Previous → 1 → 2 → Next', async () => {
      const links = canvas.getAllByRole('link');
      links[0].focus();
      for (let i = 1; i < links.length; i += 1) {
        await userEvent.tab();
        expect(document.activeElement).toBe(links[i]);
      }
    });
  },
};

/**
 * Async page count — reserve the nav row so the footer under a loading list
 * doesn't jump once the total page count resolves.
 */
export const Loading: Story = {
  render: () => <Skeleton variant="pagination" />,
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
