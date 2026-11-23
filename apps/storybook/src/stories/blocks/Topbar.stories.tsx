import type { Meta, StoryObj } from "@storybook/react-vite";
import { Topbar } from "@interlace/ui/patterns/topbar";
import { Button } from "@interlace/ui/button";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { withRtl } from "@/decorators";

const meta: Meta<typeof Topbar> = {
  title: "Blocks/Topbar",
  component: Topbar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The one row every landing, docs and dashboard surface starts with: logo left, primary nav centre-right, action cluster right. Sticky with a translucent backdrop blur, so content scrolls visibly underneath without a colour seam.\n\n" +
          'It is framework-agnostic on purpose. `logo` is a slot rather than an `href`, and `renderLink` is the seam a Next.js or React Router consumer passes its own `<Link>` through — the DS never imports a router. External links opt out of that seam entirely and always render a plain `<a target="_blank">` with a trailing ↗.\n\n' +
          'Below the `collapseBelow` width (768px by default) the links never disappear. By default they move behind a Menu button that opens a side panel that a finger can drag closed (`mobileNav="menu"`); `mobileNav="wrap"` shows them as a second row instead. Pass `currentHref` and the current link gets `aria-current="page"` and an underline, in the row and in the menu.',
      },
    },
  },
  argTypes: {
    logo: {
      control: false,
      description:
        "Wordmark or logo, wrapped by the caller in whatever link component it uses. A slot rather than an `href` prop because the DS cannot know which router is in the app.",
      table: { type: { summary: "ReactNode" }, category: "Slots" },
    },
    links: {
      control: "object",
      description:
        'Primary nav: `{ href, label, external? }`. `external: true` forces a plain `<a target="_blank" rel="noopener noreferrer">` with a ↗ affix and bypasses `renderLink`. Below `collapseBelow`, see `mobileNav`.',
      table: {
        type: { summary: "TopbarLink[]" },
        defaultValue: { summary: "[]" },
        category: "Data",
      },
    },
    actions: {
      control: false,
      description:
        "Right-aligned cluster — sign-in, a primary CTA, a theme toggle. Stays visible at every width, unlike `links`, so anything a phone user genuinely needs belongs here.",
      table: { type: { summary: "ReactNode" }, category: "Slots" },
    },
    currentHref: {
      control: "text",
      description:
        'The current page. The link with this exact href gets `aria-current="page"` and the current style.',
      table: { type: { summary: "string" }, category: "State" },
    },
    collapseBelow: {
      control: "inline-radio",
      options: ["md", "lg", "xl"],
      description:
        "The width below which the row of links gives way to the menu. Pick the one at which your links still fit on one line: `md` for three or four short links, `lg` for five or six, `xl` for more.",
      table: {
        type: { summary: "'md' | 'lg' | 'xl'" },
        defaultValue: { summary: "md" },
        category: "Appearance",
      },
    },
    mobileNav: {
      control: "inline-radio",
      options: ["menu", "wrap", "none"],
      description:
        "What the links do below `collapseBelow` (768px by default). `menu`: a Menu button opening a swipeable side panel. `wrap`: a second, wrapping row. `none`: hidden, only when the page offers another route to them.",
      table: {
        type: { summary: "'menu' | 'wrap' | 'none'" },
        defaultValue: { summary: "menu" },
        category: "Appearance",
      },
    },
    menuSide: {
      control: "inline-radio",
      options: ["right", "left", "bottom", "full"],
      description:
        "The edge the small-screen menu opens from. Topbar cannot know the page's direction, so an RTL page passes `left`. `full` covers the whole screen.",
      table: {
        type: { summary: "'right' | 'left' | 'bottom' | 'full'" },
        defaultValue: { summary: "right" },
        category: "Appearance",
      },
    },
    edge: {
      control: "inline-radio",
      options: ["always", "scroll"],
      description:
        "When the bar shows its surface and border. `scroll` keeps it clear over the top of the page and fades them in once the page scrolls under it.",
      table: {
        type: { summary: "'always' | 'scroll'" },
        defaultValue: { summary: "always" },
        category: "Appearance",
      },
    },
    menuLabel: {
      control: "text",
      description:
        "Label of the small-screen menu button and title of the panel.",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "Menu" },
        category: "Content",
      },
    },
    containerSize: {
      control: "inline-radio",
      options: ["wide", "content", "prose"],
      description:
        "Max-width of the inner row. Match it to the page beneath — a `wide` bar over a `prose` article leaves the logo floating away from the text it belongs to.",
      table: {
        type: { summary: "'wide' | 'content' | 'prose'" },
        defaultValue: { summary: "wide" },
        category: "Appearance",
      },
    },
    renderLink: {
      control: false,
      description:
        "Render prop for internal links — `({ href, className, children, ...rest }) => ReactElement`. Defaults to a plain `<a>`, which is a full page load; pass your framework's Link to get SPA navigation. Forward `className` (the DS link styling) and `rest` (it carries `aria-current`).",
      table: {
        type: { summary: "(props) => ReactElement" },
        category: "Slots",
      },
    },
    className: {
      control: "text",
      description:
        "Merged onto the `<header>`. This is where `sticky top-0 z-10` lives — raise the z-index here if the page has an overlay that must sit under the bar.",
      table: { type: { summary: "string" }, category: "Appearance" },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Topbar>;

const sampleLogo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-lg bg-linear-to-br from-primary to-chart-2"
    />
    <span>Interlace</span>
  </a>
);

const sampleLinks = [
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "https://github.com", label: "GitHub", external: true },
];

export const Default: Story = {
  args: {
    logo: sampleLogo,
    links: sampleLinks,
    containerSize: "wide",
    actions: (
      <>
        <Button variant="ghost" size="sm">
          Sign in
        </Button>
        <Button size="sm">Get started</Button>
      </>
    ),
  },
};

export const NoActions: Story = {
  args: {
    logo: sampleLogo,
    links: sampleLinks,
  },
};

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
export const RTL: Story = { ...Default, decorators: [withRtl] };

/** The current page is marked in the row and in the menu. */
export const CurrentPage: Story = {
  args: { ...Default.args, currentHref: sampleLinks[0]?.href },
};

/** Below 768px: a Menu button opens the links in a swipeable side panel. */
export const MobileMenu: Story = {
  args: { ...Default.args, currentHref: sampleLinks[0]?.href },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

/** Below 768px: the links wrap into a second row instead. */
export const MobileWrap: Story = {
  args: {
    ...Default.args,
    mobileNav: "wrap",
    currentHref: sampleLinks[0]?.href,
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

const manyLinks = [
  { href: "/questions", label: "Questions we tested" },
  { href: "/answers", label: "Answers" },
  { href: "/sources", label: "Sources" },
  { href: "/method", label: "How we check" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/**
 * Six links at 820px: with `collapseBelow="lg"` they sit behind the menu until
 * there is room for all of them on one line, instead of each wrapping in two.
 */
export const ManyLinks: Story = {
  args: { ...Default.args, links: manyLinks, collapseBelow: "lg" },
  parameters: { viewport: { defaultViewport: "tablet" } },
};

/** An RTL page on a phone: the menu opens from the left. */
export const RTLMobileMenu: Story = {
  args: { ...Default.args, menuSide: "left" },
  decorators: [withRtl],
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

const icon = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const groupedLinks = [
  {
    label: "Products",
    items: [
      {
        href: "/data",
        label: "Data hub",
        description: "Every source we use, searchable and cited.",
        icon: icon(
          "M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2Zm0 0v12c0 1.1 3.6 2 8 2s8-.9 8-2V6M4 12c0 1.1 3.6 2 8 2s8-.9 8-2",
        ),
      },
      {
        href: "/workshops",
        label: "Workshops",
        description: "Live sessions for schools and community groups.",
        icon: icon(
          "M3 7h18M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7M8 3v4m8-4v4",
        ),
      },
      {
        href: "/guides",
        label: "Guides",
        description: "Short reads for one question at a time.",
        icon: icon("M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Zm4 2h6"),
      },
    ],
  },
  {
    label: "Company",
    items: [
      {
        href: "/about",
        label: "About",
        description: "Who we are and how we work.",
      },
      {
        href: "/method",
        label: "Method",
        description: "How every claim is checked.",
      },
      { href: "https://example.org/press", label: "Press kit", external: true },
    ],
  },
  { href: "/pricing", label: "Pricing" },
];

/**
 * Link groups: a family of products. From `collapseBelow` up a group is a
 * button that opens a panel of its items, each with an icon and a line of
 * description; the panel slides between groups. Arrow keys move between
 * triggers, Tab walks the panel, Escape closes it.
 */
export const LinkGroups: Story = {
  args: { ...Default.args, links: groupedLinks, currentHref: "/workshops" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Products" });
    // Keyboard, not a click: a synthetic click also starts the hover-open
    // timer, which would reopen the panel after Escape and end the story open.
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "true"),
    );
    const body = within(canvasElement.ownerDocument.body);
    const item = await body.findByRole("link", { name: /Data hub/ });
    // The panel fades in from opacity 0, so visibility settles after a frame or two.
    await waitFor(() => expect(item).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "false"),
    );
    await waitFor(() =>
      expect(canvasElement.ownerDocument.activeElement).toBe(trigger),
    );
  },
};

/** The same groups on a phone: each is a labelled section of the menu. */
export const LinkGroupsMobile: Story = {
  args: { ...Default.args, links: groupedLinks, currentHref: "/workshops" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

export const LinkGroupsDark: Story = {
  ...LinkGroups,
  play: undefined,
  globals: { theme: "dark" },
};

/** A long page under the bar, so the scroll edge has something to pass beneath. */
const withPage: NonNullable<Story["decorators"]>[number] = (Story) => (
  <div className="bg-background text-foreground">
    <Story />
    <section className="mx-auto max-w-(--container-wide) px-6 py-24">
      <h1 className="font-heading text-display max-w-(--container-prose)">
        A calm header that steps back until you scroll
      </h1>
      <p className="text-muted-foreground mt-6 max-w-(--container-prose) text-lg">
        At the top of the page the bar has no surface and no border, so it reads
        as part of the hero. Scroll, and its surface, blur and hairline fade in.
      </p>
    </section>
    {Array.from({ length: 6 }, (_, i) => (
      <section
        key={i}
        className="border-border mx-auto max-w-(--container-wide) border-t px-6 py-20"
      >
        <p className="text-muted-foreground max-w-(--container-prose)">
          Section {i + 1}
        </p>
      </section>
    ))}
  </div>
);

/**
 * The quiet header: `edge="scroll"` keeps the bar clear over the hero and
 * brings in its surface and border once the page scrolls; one understated
 * action on the right.
 */
export const ClearUntilScroll: Story = {
  args: {
    ...Default.args,
    links: groupedLinks,
    edge: "scroll",
    actions: (
      <Button size="sm" variant="outline">
        Get in touch
      </Button>
    ),
  },
  decorators: [withPage],
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector<HTMLElement>(
      '[data-slot="topbar"]',
    )!;
    await expect(header.getAttribute("data-edge")).toBe("scroll");
    await expect(header.hasAttribute("data-scrolled")).toBe(false);
  },
};

/** `menuSide="full"`: on a phone the menu covers the screen, with larger links. */
export const FullScreenMenu: Story = {
  args: { ...ClearUntilScroll.args, menuSide: "full" },
  decorators: [withPage],
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: undefined,
};
