import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
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
import { withRtl } from '@/decorators';

/**
 * Story-only args. `page` / `totalPages` / `onPageChange` are NOT props of
 * `Pagination` — the primitive is a presentational `<nav>` and owns no page
 * state. They drive the demo below (which is what a real call site has to
 * write) so the Controls panel can exercise the window/ellipsis behaviour and
 * the Actions panel can show the navigation intent.
 */
type PaginationStoryArgs = React.ComponentProps<typeof Pagination> & {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const meta: Meta<PaginationStoryArgs> = {
  title: 'Primitives/Pagination',
  component: Pagination,
  subcomponents: { PaginationLink, PaginationEllipsis },
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Numbered page navigation, per `PAGINATION_PHILOSOPHY.md`: explicit page links that live in the URL, never infinite scroll — so a result is linkable, back works, and the crawler can reach page 7. The primitive is presentational: it renders a labelled `<nav>` and its parts, while the page window, the ellipsis placement and the current-page state stay with the caller. Mark the current page with `active` on `PaginationLink` (it emits `aria-current="page"`), and render every page control as a real `<a href>` rather than a button.',
      },
    },
  },
  argTypes: {
    page: {
      control: { type: 'number', min: 1 },
      description:
        'STORY ARG (not a component prop) — the current page the demo renders as `active`.',
      table: { category: 'Story data' },
    },
    totalPages: {
      control: { type: 'range', min: 1, max: 40, step: 1 },
      description:
        'STORY ARG (not a component prop) — how many pages the demo windows over. Push it past ~7 to see the ellipsis appear.',
      table: { category: 'Story data' },
    },
    onPageChange: {
      action: 'pageChange',
      description:
        'STORY ARG (not a component prop) — the callback a real call site would use to push the new page into the URL.',
      table: { category: 'Events' },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the `<nav>` (`mx-auto flex w-full justify-center`) — the seam for aligning the bar left/right instead of centred.',
      table: { category: 'Appearance' },
    },
    'aria-label': {
      control: 'text',
      description:
        'Defaults to `"pagination"`. Override it when a page has two of these (e.g. one per list) so screen-reader users can tell them apart.',
      table: { category: 'Appearance', defaultValue: { summary: 'pagination' } },
    },
    children: {
      control: false,
      description: 'The `PaginationContent` list and its items.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
  },
  args: {
    page: 2,
    totalPages: 9,
    className: '',
    'aria-label': 'pagination',
    onPageChange: fn(),
  },
};

export default meta;
type Story = StoryObj<PaginationStoryArgs>;

/**
 * The windowing a real call site has to write: first page, last page, the
 * neighbours of the current page, and an ellipsis wherever the sequence jumps.
 * `null` marks a gap.
 */
function pageWindow(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const around = [page - 1, page, page + 1].filter(
    (p) => p > 1 && p < totalPages,
  );
  const shown = [1, ...around, totalPages];
  const out: (number | null)[] = [];
  let previous = 0;
  for (const p of shown) {
    if (p - previous > 1) out.push(null);
    out.push(p);
    previous = p;
  }
  return out;
}

function PaginationDemo({
  page: initialPage,
  totalPages,
  onPageChange,
  ...navProps
}: PaginationStoryArgs) {
  const [page, setPage] = React.useState(initialPage);
  const go = (next: number) => (event: React.MouseEvent) => {
    // The href stays real (linkable, middle-clickable); the demo just keeps
    // Storybook from navigating the iframe.
    event.preventDefault();
    const clamped = Math.min(Math.max(next, 1), totalPages);
    setPage(clamped);
    onPageChange?.(clamped);
  };

  return (
    // gap-2 (8px), not the default gap-1: the `size-9` anchors clear WCAG 2.2's
    // 24×24 target-size threshold on their own, and 8px boundary-to-boundary
    // keeps axe's spacing-exception circle math well clear too.
    <Pagination {...navProps}>
      <PaginationContent className="gap-2">
        <PaginationItem>
          <PaginationPrevious
            href={`?page=${Math.max(page - 1, 1)}`}
            onClick={go(page - 1)}
            aria-disabled={page === 1 || undefined}
          />
        </PaginationItem>
        {pageWindow(page, totalPages).map((p, i) =>
          p === null ? (
            <PaginationItem key={`gap-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                href={`?page=${p}`}
                active={p === page}
                onClick={go(p)}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href={`?page=${Math.min(page + 1, totalPages)}`}
            onClick={go(page + 1)}
            aria-disabled={page === totalPages || undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export const Default: Story = {
  // key: `page` seeds local state, so remount when the control changes it.
  render: (args) => (
    <PaginationDemo key={`${args.page}-${args.totalPages}`} {...args} />
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
 * Short result sets get no ellipsis — every page is worth a link, and a gap
 * marker over six pages is pure noise.
 */
export const FewPages: Story = {
  args: { page: 1, totalPages: 4 },
  render: (args) => (
    <PaginationDemo key={`${args.page}-${args.totalPages}`} {...args} />
  ),
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
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
