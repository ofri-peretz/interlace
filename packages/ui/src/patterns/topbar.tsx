/**
 * @interlace/ui — Topbar
 *
 * Site-wide horizontal navigation. The first pattern every landing /
 * docs / dashboard surface needs: logo (left), primary nav (middle/right),
 * action cluster (right). One row, sticky to the top, semi-transparent
 * backdrop blur so content scrolls visibly beneath without colour bleed.
 *
 * ## Anatomy
 *
 *   <header data-slot="topbar" data-min-viewport="320">
 *     <div className="container">
 *       <div className="logo">{logo}</div>
 *       <nav>{links.map(...)} </nav>          (collapseBelow and up)
 *       <div className="actions">{actions}</div>
 *       <TopbarMenu>{links}</TopbarMenu>      (below collapseBelow, mobileNav="menu")
 *     </div>
 *     <nav>{links}</nav>                      (below collapseBelow, mobileNav="wrap")
 *     </div>
 *   </header>
 *
 * ## MIN_VIEWPORT — 320
 *
 * Below `collapseBelow` (768 by default) the links never disappear. By
 * default they move into a "Menu" button that opens a swipeable side panel
 * (`TopbarMenu`); `mobileNav="wrap"` shows them as a second, wrapping row
 * instead, which suits sites with three or four short links. Above it, the
 * nav row is visible, and a link never wraps onto two lines: a site with
 * more links than fit at 768 sets `collapseBelow="lg"` or `"xl"`.
 *
 * ## Logo height
 *
 * The row is at least 3.5rem tall and grows to fit a taller logo, such as a
 * stacked multi-script `Wordmark`, so the logo slot never clips.
 *
 * ## Groups
 *
 * An entry with `items` is a group. From `collapseBelow` up it is a button
 * that opens a panel of its items, each with an optional icon and a one-line
 * description (`TopbarNav`); below, a labelled section of the menu.
 *
 * ## Edge
 *
 * `edge="scroll"` leaves the bar clear at the top of the page and brings in
 * its surface and border once content scrolls under it (`TopbarScrollEdge`).
 * `hideOnScroll` slides the bar away while the reader scrolls down and brings
 * it back on the first scroll up. `menuSide="full"` makes the small-screen
 * menu cover the screen.
 *
 * ## Current page
 *
 * Pass `currentHref` and the matching link gets `aria-current="page"` and a
 * visible current style (foreground colour and an underline), in both the
 * row and the menu. `renderLink` receives `aria-current` so a framework link
 * forwards it.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'header'>` + Topbar props             |
 * | R6   | data-slot on root                | `data-slot="topbar"`                                        |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R10  | Composition seam (slots)         | `logo` / `links` / `actions` ReactNode props                |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | `bg-background` / `border-border` / `text-muted-foreground` |
 * | R20  | AA contrast                      | semantic foregrounds on backdrop-blur background            |
 * | R25  | Server component                 | No hooks; open state and scroll live in client children     |
 * | R26  | A11y from native el              | `<header>` landmark, `<nav>` for the link cluster           |
 */

import * as React from "react";

import { cn } from "../lib/cn.js";
import { TopbarMenu } from "./topbar-menu.js";
import {
  TOPBAR_ROW_ITEM,
  TopbarNav,
  type TopbarNavEntry,
} from "./topbar-nav.js";
import { TopbarScrollEdge } from "./topbar-scroll-edge.js";

export const MIN_VIEWPORT = 320 as const;

interface TopbarLink {
  href: string;
  label: React.ReactNode;
  external?: boolean;
}

/** A link inside a group: a product, a section, a tool. */
interface TopbarGroupItem extends TopbarLink {
  /** One line under the label, shown in the panel and the small-screen menu. */
  description?: React.ReactNode;
  /** A small mark before the label, decorative (hidden from assistive tech). */
  icon?: React.ReactNode;
}

/**
 * A labelled set of links. From `collapseBelow` up it is a button that opens a
 * panel of its items; below, a labelled section of the menu.
 */
interface TopbarLinkGroup {
  label: React.ReactNode;
  items: TopbarGroupItem[];
}

type TopbarEntry = TopbarLink | TopbarLinkGroup;

const isGroup = (entry: TopbarEntry): entry is TopbarLinkGroup =>
  "items" in entry;

interface TopbarLinkRenderProps {
  href: string;
  className: string;
  children: React.ReactNode;
  "aria-current"?: "page";
}

interface TopbarProps extends React.ComponentProps<"header"> {
  /**
   * Logo / wordmark. Receives a `<a href="/">…</a>` or a framework-
   * specific Link (Next.js Link, React Router NavLink, etc.) — the DS
   * is platform-agnostic so the consumer decides which.
   */
  logo: React.ReactNode;
  /**
   * Primary nav: links, and groups of links. From `collapseBelow` up they sit
   * in one row and a group opens a panel of its items; below, see `mobileNav`.
   */
  links?: TopbarEntry[];
  /** Right-aligned actions (Buttons, ThemeToggle, etc.). */
  actions?: React.ReactNode;
  /**
   * Container max-width. Defaults to `'wide'` (1280px). Set to
   * `'content'` (1024px) for narrower docs surfaces.
   */
  containerSize?: "wide" | "content" | "prose";
  /**
   * The current page's href. The link with this exact href is marked
   * `aria-current="page"` and styled as current.
   */
  currentHref?: string;
  /**
   * The width below which the row of links gives way to `mobileNav`. Pick the
   * one at which your links still fit on one line: `md` (768px) suits three or
   * four short links, `lg` (1024px) five or six, `xl` (1280px) more.
   * @default 'md'
   */
  collapseBelow?: "md" | "lg" | "xl";
  /**
   * What the links do below `collapseBelow`: `menu` puts them behind a Menu button in a
   * swipeable side panel, `wrap` shows them as a second row, `none` hides them (only
   * when the page offers another way to reach them). @default 'menu'
   */
  mobileNav?: "menu" | "wrap" | "none";
  /** Label of the small-screen menu button. @default 'Menu' */
  menuLabel?: string;
  /**
   * The edge the small-screen menu opens from; a drag back toward it closes it.
   * Topbar cannot know the page's direction, so an RTL page passes `left`.
   * `full` covers the whole screen, dropping from the top, with larger links.
   * @default "right"
   */
  menuSide?: "right" | "left" | "bottom" | "full";
  /**
   * When the bar shows its surface and bottom border. `always` keeps them on.
   * `scroll` leaves the bar clear over the top of the page, so it sits on a
   * hero like part of it, and fades the surface, blur and border in once the
   * page scrolls under it, after 4px. Compose `TopbarScrollEdge` yourself
   * for another threshold. @default 'always'
   */
  edge?: "always" | "scroll";
  /**
   * Slide the bar away while the reader scrolls down, and back on the first
   * scroll up. It stays while focus or an open panel is inside it.
   * @default false
   */
  hideOnScroll?: boolean;
  /**
   * Render-prop slot for internal links. Defaults to a plain `<a>`. A
   * Next.js consumer passes `({ href, className, children, ...rest }) =>
   * <Link href={href} className={className} {...rest}>{children}</Link>`
   * to enable SPA navigation; spreading `rest` forwards `aria-current`.
   * External links (`link.external === true`) always use a plain
   * `<a target="_blank">` regardless of this slot.
   */
  renderLink?: (props: TopbarLinkRenderProps) => React.ReactElement;
}

const defaultRenderLink: NonNullable<TopbarProps["renderLink"]> = ({
  href,
  className,
  children,
  ...rest
}) => (
  <a href={href} className={className} {...rest}>
    {children}
  </a>
);

const CONTAINER_CLASSES = {
  wide: "max-w-(--container-wide)",
  content: "max-w-(--container-content)",
  prose: "max-w-(--container-prose)",
} as const;

/** Link styles per place. Current = foreground + underline, never colour alone. */
const LINK = {
  row: cn(
    TOPBAR_ROW_ITEM,
    "aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-[1.15rem]",
  ),
  wrap: "text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-4 inline-flex min-h-11 items-center transition-colors",
  menu: "text-foreground hover:bg-muted aria-[current=page]:bg-muted flex min-h-11 items-center rounded-md px-3 font-medium aria-[current=page]:font-semibold",
  /** An item in a group's panel: icon, label and description in one target. */
  panel:
    "hover:bg-muted focus-visible:bg-muted aria-[current=page]:bg-muted focus-visible:ring-ring flex gap-3 rounded-lg p-3 text-start transition-colors focus-visible:ring-2 focus-visible:outline-hidden",
  /** An item in a group's section of the small-screen menu. */
  section:
    "text-foreground hover:bg-muted aria-[current=page]:bg-muted flex min-h-11 gap-3 rounded-md px-3 py-2 aria-[current=page]:font-semibold",
} as const;

/**
 * A panel's items arrive in a quick cascade: each one fades and rises 4px,
 * 20ms after the one before, so eight items finish inside the 150ms stagger
 * window MOTION_PHILOSOPHY allows. Spelled out so Tailwind sees each class.
 */
const CASCADE = [
  "delay-0",
  "delay-20",
  "delay-40",
  "delay-60",
  "delay-80",
  "delay-100",
  "delay-120",
  "delay-140",
] as const;
const CASCADE_ITEM =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-(--duration-base) motion-safe:ease-enter";

/** Each breakpoint spelled out, so Tailwind sees every class it needs. */
const COLLAPSE = {
  md: { row: "md:flex", actions: "md:gap-4", small: "md:hidden" },
  lg: { row: "lg:flex", actions: "lg:gap-4", small: "lg:hidden" },
  xl: { row: "xl:flex", actions: "xl:gap-4", small: "xl:hidden" },
} as const;

/**
 * The inside of a group item: icon, then label over description. In a panel
 * the label is small; in the menu it takes the menu's size, as plain links do.
 */
function richLabel(
  link: TopbarGroupItem,
  external: React.ReactNode,
  place: "panel" | "section",
) {
  const labelClass = cn(
    "text-foreground font-medium",
    place === "panel" && "text-sm",
  );
  if (!link.icon && !link.description) {
    return (
      <span className={labelClass}>
        {link.label}
        {external}
      </span>
    );
  }
  return (
    <>
      {link.icon ? (
        <span
          aria-hidden
          data-slot="topbar-item-icon"
          className="text-muted-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center [&_svg]:size-5"
        >
          {link.icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={labelClass}>
          {link.label}
          {external}
        </span>
        {link.description ? (
          <span className="text-muted-foreground text-sm font-normal">
            {link.description}
          </span>
        ) : null}
      </span>
    </>
  );
}

function renderLinks(
  links: TopbarGroupItem[],
  place: keyof typeof LINK,
  currentHref: string | undefined,
  renderLink: NonNullable<TopbarProps["renderLink"]>,
) {
  const rich = place === "panel" || place === "section";
  return links.map((link) => {
    const className = LINK[place];
    if (link.external) {
      const mark = (
        <>
          {" "}
          <span aria-hidden>↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </>
      );
      return (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {rich ? (
            richLabel(link, mark, place as "panel" | "section")
          ) : (
            <>
              {link.label}
              {mark}
            </>
          )}
        </a>
      );
    }
    const current = currentHref !== undefined && link.href === currentHref;
    return (
      <React.Fragment key={link.href}>
        {renderLink({
          href: link.href,
          className,
          children: rich
            ? richLabel(link, null, place as "panel" | "section")
            : link.label,
          ...(current ? { "aria-current": "page" as const } : {}),
        })}
      </React.Fragment>
    );
  });
}

/** Every link, with groups opened out: for the wrap row. */
const flatten = (entries: TopbarEntry[]): TopbarLink[] =>
  entries.flatMap((entry) => (isGroup(entry) ? entry.items : [entry]));

const groupHas = (group: TopbarLinkGroup, href: string | undefined) =>
  href !== undefined && group.items.some((item) => item.href === href);

/** A stable key for a group: its label when it is text, else its place. */
const groupKey = (group: TopbarLinkGroup, index: number) =>
  typeof group.label === "string" ? `group:${group.label}` : `group:${index}`;

/** The small-screen menu: plain links, and each group as a labelled list. */
function renderMenu(
  entries: TopbarEntry[],
  currentHref: string | undefined,
  renderLink: NonNullable<TopbarProps["renderLink"]>,
) {
  return entries.map((entry, index) => {
    if (!isGroup(entry)) {
      return (
        <React.Fragment key={entry.href}>
          {renderLinks([entry], "menu", currentHref, renderLink)}
        </React.Fragment>
      );
    }
    const key = groupKey(entry, index);
    return (
      <section
        key={key}
        data-slot="topbar-menu-section"
        aria-label={typeof entry.label === "string" ? entry.label : undefined}
        className="mt-4 first:mt-0"
      >
        <p
          aria-hidden={typeof entry.label === "string" ? true : undefined}
          className="text-muted-foreground px-3 pb-1 text-xs font-semibold tracking-wider uppercase"
        >
          {entry.label}
        </p>
        <ul className="flex flex-col">
          {renderLinks(entry.items, "section", currentHref, renderLink).map(
            (node, i) => (
              <li key={entry.items[i]!.href}>{node}</li>
            ),
          )}
        </ul>
      </section>
    );
  });
}

/** The wide row when it holds groups: entries rendered here, opened by TopbarNav. */
function navEntries(
  entries: TopbarEntry[],
  currentHref: string | undefined,
  renderLink: NonNullable<TopbarProps["renderLink"]>,
): TopbarNavEntry[] {
  return entries.map((entry, index) => {
    if (!isGroup(entry)) {
      return {
        kind: "link",
        key: entry.href,
        node: renderLinks([entry], "row", currentHref, renderLink),
      };
    }
    return {
      kind: "group",
      key: groupKey(entry, index),
      label: entry.label,
      current: groupHas(entry, currentHref),
      wide: entry.items.length > 3,
      node: (
        <ul
          className={cn("grid gap-1", entry.items.length > 3 && "grid-cols-2")}
        >
          {renderLinks(entry.items, "panel", currentHref, renderLink).map(
            (node, i) => (
              <li
                key={entry.items[i]!.href}
                className={cn(
                  CASCADE_ITEM,
                  CASCADE[Math.min(i, CASCADE.length - 1)],
                )}
              >
                {node}
              </li>
            ),
          )}
        </ul>
      ),
    };
  });
}

function Topbar({
  logo,
  links = [],
  actions,
  containerSize = "wide",
  currentHref,
  mobileNav = "menu",
  menuLabel = "Menu",
  menuSide = "right",
  collapseBelow = "md",
  edge = "always",
  hideOnScroll = false,
  renderLink = defaultRenderLink,
  className,
  ...props
}: TopbarProps) {
  const hasLinks = links.length > 0;
  const at = COLLAPSE[collapseBelow];
  return (
    <header
      data-slot="topbar"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-edge={edge}
      className={cn(
        "sticky top-0 z-10 border-b data-hidden:-translate-y-full",
        "motion-safe:transition-[background-color,border-color,translate] motion-safe:duration-(--duration-medium) motion-safe:ease-move",
        edge === "always"
          ? "border-border bg-background/80 supports-backdrop-filter:bg-background/60 backdrop-blur"
          : "data-scrolled:border-border data-scrolled:bg-background/80 supports-backdrop-filter:data-scrolled:bg-background/60 border-transparent bg-transparent data-scrolled:backdrop-blur",
        className,
      )}
      {...props}
    >
      {edge === "scroll" || hideOnScroll ? (
        <TopbarScrollEdge hide={hideOnScroll} />
      ) : null}
      <div
        className={cn(
          "mx-auto flex min-h-14 items-center justify-between gap-4 px-6 py-2",
          CONTAINER_CLASSES[containerSize],
        )}
      >
        <div className="flex items-center gap-4">{logo}</div>
        {hasLinks ? (
          <div className={cn("hidden items-center", at.row)}>
            <TopbarNav
              entries={navEntries(links, currentHref, renderLink)}
              className="text-sm"
            />
          </div>
        ) : null}
        {actions || (hasLinks && mobileNav === "menu") ? (
          <div className={cn("flex items-center gap-2", at.actions)}>
            {actions}
            {hasLinks && mobileNav === "menu" ? (
              <div className={at.small}>
                <TopbarMenu label={menuLabel} side={menuSide}>
                  {renderMenu(links, currentHref, renderLink)}
                </TopbarMenu>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {hasLinks && mobileNav === "wrap" ? (
        <nav
          aria-label="Primary"
          data-slot="topbar-wrap-nav"
          className={cn(
            "flex flex-wrap items-center gap-x-5 px-6 pb-1 text-sm",
            at.small,
          )}
        >
          {renderLinks(flatten(links), "wrap", currentHref, renderLink)}
        </nav>
      ) : null}
    </header>
  );
}
Topbar.displayName = "Topbar";

export { Topbar };
export type {
  TopbarProps,
  TopbarLink,
  TopbarLinkGroup,
  TopbarGroupItem,
  TopbarEntry,
  TopbarLinkRenderProps,
};
