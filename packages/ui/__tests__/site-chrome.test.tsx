/**
 * Site chrome a public site needs without custom classes: a header that
 * works on a phone and marks the current page, a site-wide banner, prose
 * that can fill a card, value-first stats, and a footer tagline.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Banner } from "../src/patterns/banner.js";
import { Footer } from "../src/patterns/footer.js";
import { StatCard } from "../src/patterns/stat-card.js";
import { StatGroup } from "../src/patterns/stat-group.js";
import { Topbar } from "../src/patterns/topbar.js";
import { TopbarScrollEdge } from "../src/patterns/topbar-scroll-edge.js";
import { Prose } from "../src/primitives/prose.js";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/questions", label: "Questions" },
  { href: "/about", label: "About" },
];

describe("Topbar", () => {
  it.each(["md", "lg", "xl"] as const)(
    'collapseBelow="%s" switches the row and the menu button at that breakpoint only',
    (bp) => {
      const html = renderToStaticMarkup(
        <Topbar logo="Site" links={LINKS} collapseBelow={bp} />,
      );
      expect(html).toContain(`${bp}:flex`);
      expect(html).toContain(`${bp}:hidden`);
      for (const other of ["md", "lg", "xl"].filter((b) => b !== bp)) {
        expect(html).not.toContain(`${other}:flex`);
        expect(html).not.toContain(`${other}:hidden`);
      }
    },
  );

  it("marks the current page with aria-current", () => {
    render(
      <Topbar
        logo={<a href="/">Site</a>}
        links={LINKS}
        currentHref="/questions"
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(nav)
        .getByRole("link", { name: "Questions" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(nav)
        .getByRole("link", { name: "Home" })
        .hasAttribute("aria-current"),
    ).toBe(false);
  });

  it("forwards aria-current through renderLink", () => {
    render(
      <Topbar
        logo="Site"
        links={LINKS}
        currentHref="/about"
        renderLink={({ href, className, children, ...rest }) => (
          <a href={href} className={className} data-router {...rest}>
            {children}
          </a>
        )}
      />,
    );
    const link = screen.getAllByRole("link", { name: "About" })[0]!;
    expect(link.hasAttribute("data-router")).toBe(true);
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("gives small screens a Menu button that opens the links", async () => {
    render(<Topbar logo="Site" links={LINKS} currentHref="/" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const dialog = await screen.findByRole("dialog");
    const menuNav = within(dialog).getByRole("navigation", { name: "Primary" });
    expect(within(menuNav).getAllByRole("link")).toHaveLength(3);
    expect(
      within(menuNav)
        .getByRole("link", { name: "Home" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("can wrap the links into a second row instead", () => {
    const { container } = render(
      <Topbar logo="Site" links={LINKS} mobileNav="wrap" />,
    );
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(
      container
        .querySelector('[data-slot="topbar-wrap-nav"]')
        ?.querySelectorAll("a"),
    ).toHaveLength(3);
  });

  it("still renders on the server", () => {
    expect(
      renderToStaticMarkup(
        <Topbar logo="Site" links={LINKS} currentHref="/" />,
      ),
    ).toContain('aria-current="page"');
  });
});

const GROUPED = [
  {
    label: "Products",
    items: [
      {
        href: "/data",
        label: "Data hub",
        description: "Every source, searchable.",
        icon: <svg data-testid="icon" />,
      },
      {
        href: "/workshops",
        label: "Workshops",
        description: "Sessions for groups.",
      },
      { href: "https://example.org/press", label: "Press kit", external: true },
    ],
  },
  { href: "/about", label: "About" },
];

describe("Topbar link groups", () => {
  it("opens a group as a panel of its items, with descriptions, and closes on Escape", async () => {
    render(<Topbar logo="Site" links={GROUPED} currentHref="/workshops" />);
    const trigger = screen.getByRole("button", { name: "Products" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // The group holding the current page is marked, so the row shows where you are.
    expect(trigger.hasAttribute("data-current")).toBe(true);
    fireEvent.click(trigger);
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("true"),
    );
    const hub = await screen.findByRole("link", { name: /Data hub/ });
    expect(hub.textContent).toContain("Every source, searchable.");
    // The icon is decoration: the label names the link.
    expect(
      hub
        .querySelector('[data-slot="topbar-item-icon"]')!
        .getAttribute("aria-hidden"),
    ).toBe("true");
    const current = screen
      .getAllByRole("link", { name: /Workshops/ })
      .find((a) => a.closest('[data-slot="topbar-nav-panel"]'))!;
    expect(current.getAttribute("aria-current")).toBe("page");
    const press = screen
      .getAllByRole("link", { name: /Press kit/ })
      .find((a) => a.closest('[data-slot="topbar-nav-panel"]'))!;
    expect(press.getAttribute("target")).toBe("_blank");
    fireEvent.keyDown(hub, { key: "Escape" });
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("false"),
    );
  });

  it("closes the panel when one of its links is followed", async () => {
    render(<Topbar logo="Site" links={GROUPED} />);
    const trigger = screen.getByRole("button", { name: "Products" });
    fireEvent.click(trigger);
    const hub = await screen.findByRole("link", { name: /Data hub/ });
    // jsdom cannot navigate; the panel only needs to see the click.
    hub.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(hub);
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("false"),
    );
  });

  it("keeps plain links in the row beside the groups", () => {
    render(<Topbar logo="Site" links={GROUPED} currentHref="/about" />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(nav)
        .getByRole("link", { name: "About" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("lists each group as a labelled section of the small-screen menu", async () => {
    render(<Topbar logo="Site" links={GROUPED} currentHref="/data" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const dialog = await screen.findByRole("dialog");
    const section = within(dialog).getByRole("region", { name: "Products" });
    expect(within(section).getAllByRole("link")).toHaveLength(3);
    expect(
      within(section)
        .getByRole("link", { name: /Data hub/ })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(within(dialog).getByRole("link", { name: "About" })).toBeTruthy();
  });

  it("opens groups out into the wrap row", () => {
    const { container } = render(
      <Topbar logo="Site" links={GROUPED} mobileNav="wrap" />,
    );
    expect(
      container
        .querySelector('[data-slot="topbar-wrap-nav"]')
        ?.querySelectorAll("a"),
    ).toHaveLength(4);
  });

  it("renders on the server, with the group trigger in the markup", () => {
    const html = renderToStaticMarkup(<Topbar logo="Site" links={GROUPED} />);
    expect(html).toContain('data-slot="topbar-nav-trigger"');
    expect(html).toContain("Products");
  });
});

describe("Topbar edge and full-screen menu", () => {
  const scrollTo = (y: number) => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    fireEvent.scroll(window);
  };

  it("keeps the surface and border on by default", () => {
    const { container } = render(<Topbar logo="Site" links={LINKS} />);
    const header = container.querySelector("header")!;
    expect(header.getAttribute("data-edge")).toBe("always");
    expect(header.className).toContain("border-border");
    expect(
      container.querySelector('[data-slot="topbar-scroll-edge"]'),
    ).toBeNull();
  });

  it('edge="scroll" stays clear at the top and marks the header once the page scrolls', () => {
    scrollTo(0);
    const { container, unmount } = render(
      <Topbar logo="Site" links={LINKS} edge="scroll" />,
    );
    const header = container.querySelector("header")!;
    expect(header.getAttribute("data-edge")).toBe("scroll");
    expect(header.className).toContain("border-transparent");
    expect(header.hasAttribute("data-scrolled")).toBe(false);
    scrollTo(120);
    expect(header.hasAttribute("data-scrolled")).toBe(true);
    scrollTo(0);
    expect(header.hasAttribute("data-scrolled")).toBe(false);
    scrollTo(120);
    unmount();
    expect(header.hasAttribute("data-scrolled")).toBe(false);
    scrollTo(0);
  });

  it("marks a page that loads already scrolled", () => {
    scrollTo(300);
    const { container } = render(
      <Topbar logo="Site" links={LINKS} edge="scroll" />,
    );
    expect(
      container.querySelector("header")!.hasAttribute("data-scrolled"),
    ).toBe(true);
    scrollTo(0);
  });

  it("does nothing outside a Topbar", () => {
    const { container } = render(<TopbarScrollEdge threshold={10} />);
    expect(
      container
        .querySelector('[data-slot="topbar-scroll-edge"]')
        ?.hasAttribute("hidden"),
    ).toBe(true);
  });

  it('menuSide="full" opens a menu that covers the screen', async () => {
    render(<Topbar logo="Site" links={GROUPED} menuSide="full" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.hasAttribute("data-full")).toBe(true);
    expect(dialog.getAttribute("data-direction")).toBe("top");
    expect(dialog.className).toContain("h-dvh");
    expect(
      within(dialog).getByRole("navigation", { name: "Primary" }).className,
    ).toContain("text-lg");
  });
});

describe("Banner", () => {
  it("is a labelled region whose tone is data, not meaning", () => {
    render(<Banner tone="warning">This site is still being written.</Banner>);
    const region = screen.getByRole("region", { name: "Announcement" });
    expect(region.getAttribute("data-tone")).toBe("warning");
    expect(region.textContent).toContain("still being written");
  });

  it("closes from a named button and reports it", () => {
    const changes: boolean[] = [];
    render(
      <Banner dismissible onOpenChange={(open) => changes.push(open)}>
        Notice
      </Banner>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("region")).toBeNull();
    expect(changes).toEqual([false]);
  });

  it("stays open when controlled", () => {
    render(
      <Banner dismissible open>
        Notice
      </Banner>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByRole("region")).toBeTruthy();
  });
});

describe("Prose", () => {
  it("caps the measure by default and fills on request", () => {
    const { container, rerender } = render(<Prose>x</Prose>);
    const root = () => container.firstElementChild!.className.split(/\s+/);
    expect(root()).toContain("max-w-(--container-prose)");
    rerender(<Prose width="fill">x</Prose>);
    expect(root()).toContain("max-w-none");
    expect(root()).not.toContain("max-w-(--container-prose)");
  });

  it("sets headings in the heading face", () => {
    const { container } = render(<Prose>x</Prose>);
    const classes = container.firstElementChild!.className;
    expect(classes).toContain("[&_h2]:font-heading");
    expect(classes).not.toContain("font-body");
  });
});

describe("StatCard", () => {
  it("puts the number first in value-first layout", () => {
    const { container } = render(
      <StatCard label="Sources checked" value="120" layout="value-first" />,
    );
    expect(container.textContent?.indexOf("120")).toBeLessThan(
      container.textContent!.indexOf("Sources"),
    );
  });

  it("keeps label-first as the default", () => {
    const { container } = render(
      <StatCard label="Sources checked" value="120" />,
    );
    expect(container.textContent?.indexOf("Sources")).toBeLessThan(
      container.textContent!.indexOf("120"),
    );
  });

  it("takes the layout from StatGroup", () => {
    const { container } = render(
      <StatGroup layout="value-first" stats={[{ label: "A", value: "1" }]} />,
    );
    expect(
      container
        .querySelector('[data-slot="stat-card"]')
        ?.getAttribute("data-layout"),
    ).toBe("value-first");
  });
});

describe("Footer", () => {
  it("shows a tagline under the brand", () => {
    render(<Footer brand="Site" tagline="Answers with their sources." />);
    expect(
      screen.getByText("Answers with their sources.").getAttribute("data-slot"),
    ).toBe("footer-tagline");
  });
});
