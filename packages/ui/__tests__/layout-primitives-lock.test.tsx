/**
 * Layout Primitives Lock Tests
 *
 * Locks the padding / spacing / container contract from LAYOUT_PHILOSOPHY.md
 * §2 (container widths), §3 (spacing scale), §5 (density scale), §7 (sections
 * own the wrapper) for the four mandated primitives:
 *
 *   - `<Container>` — width contract (prose / content / wide / full)
 *   - `<Section>` — vertical rhythm + tone + dividers + container injection
 *   - `<Stack>` / `<Cluster>` — gap rhythm
 *   - `<SectionHeader>` — title / tagline / eyebrow structure
 *
 * If any of these tests fail, the homepage refactor (HOMEPAGE_LAYOUT_AUDIT.md)
 * has regressed. Update the philosophy doc first if the change is intentional.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Container } from "../src/primitives/container";
import { Section } from "../src/primitives/section";
import { Stack, Cluster } from "../src/primitives/stack";
import { Grid } from "../src/primitives/grid";
import { SectionHeader } from "../src/blocks/section-header";

const render = (el: React.ReactNode) =>
  renderToStaticMarkup(el as React.ReactElement);

// =========================================
// CONTAINER — LAYOUT §2 (width contract) + §5 (density)
// =========================================

describe("Container: width contract (LAYOUT §2)", () => {
  it("every size carries the responsive horizontal padding scale (LAYOUT §5)", () => {
    for (const size of ["prose", "content", "wide"] as const) {
      const html = render(<Container size={size}>x</Container>);
      expect(html).toContain("px-4");
      expect(html).toContain("xs:px-6");
      expect(html).toContain("lg:px-8");
    }
  });

  it("every non-full size centers (mx-auto) and stretches (w-full)", () => {
    for (const size of ["prose", "content", "wide"] as const) {
      const html = render(<Container size={size}>x</Container>);
      expect(html).toContain("mx-auto");
      expect(html).toContain("w-full");
    }
  });

  it('size="prose" caps at 65ch', () => {
    expect(render(<Container size="prose">x</Container>)).toContain(
      "max-w-(--container-prose)",
    );
  });

  it('size="content" caps at 1024px (the landing default)', () => {
    expect(render(<Container size="content">x</Container>)).toContain(
      "max-w-(--container-content)",
    );
  });

  it('size="wide" caps at 1280px (card-grid heavy sections)', () => {
    expect(render(<Container size="wide">x</Container>)).toContain(
      "max-w-(--container-wide)",
    );
  });

  it('size="full" removes the cap AND strips horizontal padding (full-bleed)', () => {
    const html = render(<Container size="full">x</Container>);
    expect(html).toContain("max-w-none");
    expect(html).toContain("px-0");
    expect(html).toContain("xs:px-0");
    expect(html).toContain("lg:px-0");
  });

  it('defaults to size="content" when no prop is passed', () => {
    expect(render(<Container>x</Container>)).toContain(
      "max-w-(--container-content)",
    );
  });

  it('tags the rendered element with data-slot="container" and data-size for DevTools/E2E', () => {
    const html = render(<Container size="wide">x</Container>);
    expect(html).toContain('data-slot="container"');
    expect(html).toContain('data-size="wide"');
  });

  it("preserves user-supplied className alongside the variant classes", () => {
    const html = render(
      <Container size="content" className="custom-x">
        x
      </Container>,
    );
    expect(html).toContain("max-w-(--container-content)");
    expect(html).toContain("custom-x");
  });
});

// =========================================
// SECTION — LAYOUT §3 (spacing), §7 (sections compose), §8 (tone + divider)
// =========================================

describe("Section: vertical rhythm (LAYOUT §3, §5)", () => {
  // Each step is one fluid token (structure/layout.css), not a py-* ladder
  // that jumps at md and lg.
  it.each([
    ["tight", "py-section-tight"],
    ["comfortable", "py-section-comfortable"],
    ["spacious", "py-section-spacious"],
  ] as const)('spacing="%s" uses the fluid token %s', (spacing, klass) => {
    const html = render(<Section spacing={spacing}>x</Section>);
    expect(html).toContain(klass);
    // Locked OUT: the stepped ladder, and the values behind the 2026-05
    // "padless" stats-bar regression.
    expect(html).not.toMatch(/\b(md|lg):py-/);
    expect(html).not.toContain("py-10");
  });

  it('defaults to spacing="comfortable" when no prop is passed', () => {
    expect(render(<Section>x</Section>)).toContain("py-section-comfortable");
  });

  it("every fluid step clears the floors: 40px+ on a phone, 64px+ by 768px", () => {
    // The tokens' own curve, read back from the CSS: clamp(min, a + b·vw, max).
    const css = readFileSync(
      resolve(__dirname, "../styles/structure/layout.css"),
      "utf8",
    );
    for (const step of ["tight", "comfortable", "spacious"]) {
      const m = css.match(
        new RegExp(
          `--spacing-section-${step}: clamp\\(([\\d.]+)rem, ([\\d.]+)rem \\+ ([\\d.]+)vw, ([\\d.]+)rem\\)`,
        ),
      );
      expect(m, step).not.toBeNull();
      const [min, a, b, max] = m!.slice(1).map(Number) as [
        number,
        number,
        number,
        number,
      ];
      const at = (w: number) =>
        Math.min(max * 16, Math.max(min * 16, a * 16 + (b / 100) * w));
      expect(at(320), `${step} on a phone`).toBeGreaterThanOrEqual(40);
      expect(at(768), `${step} at 768`).toBeGreaterThanOrEqual(64);
      expect(at(1024), `${step} reaches its ceiling by 1024`).toBeCloseTo(
        max * 16,
        2,
      );
    }
  });
});

describe("Section: tone + divider (LAYOUT §8)", () => {
  it('tone="muted" applies bg-card/30', () => {
    expect(render(<Section tone="muted">x</Section>)).toContain("bg-card/30");
  });

  it('tone="inset" applies bg-card/50 + backdrop-blur-sm', () => {
    const html = render(<Section tone="inset">x</Section>);
    expect(html).toContain("bg-card/50");
    expect(html).toContain("backdrop-blur-sm");
  });

  it('tone="brand" is the brand band: bg-primary with its own foreground', () => {
    const html = render(<Section tone="brand">x</Section>);
    expect(html).toContain("bg-primary text-primary-foreground");
    expect(html).toContain('data-tone="brand"');
  });

  it("overlap pulls up by the depth, drops its own top padding, and stacks above", () => {
    const none = render(<Section>x</Section>);
    expect(none).not.toContain("-mt-");
    for (const [depth, pull] of [
      ["sm", "-mt-6"],
      ["md", "-mt-8"],
      ["lg", "-mt-12"],
    ] as const) {
      const html = render(<Section overlap={depth}>x</Section>);
      expect(html).toContain(pull);
      expect(html).toContain("z-10");
      // One pt-0 beats the single fluid py-section-* at every width.
      expect(html).toMatch(/(^|\s)pt-0(\s|")/);
      expect(html).toContain(`data-overlap="${depth}"`);
    }
  });

  it('tone="default" applies NO background class (the only "neutral" tone)', () => {
    const html = render(<Section tone="default">x</Section>);
    expect(html).not.toContain("bg-card");
  });

  it('divider="top" applies border-t only', () => {
    const html = render(<Section divider="top">x</Section>);
    expect(html).toContain("border-t");
    expect(html).toContain("border-border");
    expect(html).not.toContain("border-y");
    expect(html).not.toContain("border-b ");
  });

  it('divider="bottom" applies border-b only', () => {
    const html = render(<Section divider="bottom">x</Section>);
    expect(html).toContain("border-b");
    expect(html).not.toContain("border-y");
  });

  it('divider="both" applies border-y', () => {
    const html = render(<Section divider="both">x</Section>);
    expect(html).toContain("border-y");
  });
});

describe("Section: container injection (LAYOUT §7)", () => {
  // LAYOUT §7: pages never own `container mx-auto px-4`. <Section> wraps its
  // children in <Container> so the horizontal padding contract is owned by
  // the primitive, never the page.
  it("always renders a Container child (never edge-to-edge content)", () => {
    const html = render(<Section>x</Section>);
    expect(html).toContain('data-slot="container"');
  });

  it("inner Container carries px-4 xs:px-6 lg:px-8 (the responsive padding from §5)", () => {
    const html = render(<Section>x</Section>);
    expect(html).toContain("px-4");
    expect(html).toContain("xs:px-6");
    expect(html).toContain("lg:px-8");
  });

  it('inner Container defaults to size="content" (max-w-(--container-content))', () => {
    const html = render(<Section>x</Section>);
    expect(html).toContain('data-size="content"');
    expect(html).toContain("max-w-(--container-content)");
  });

  it('container="wide" forwards to the inner Container (max-w-(--container-wide))', () => {
    const html = render(<Section container="wide">x</Section>);
    expect(html).toContain('data-size="wide"');
    expect(html).toContain("max-w-(--container-wide)");
  });

  it('container="full" forwards full-bleed (no horizontal padding)', () => {
    const html = render(<Section container="full">x</Section>);
    expect(html).toContain('data-size="full"');
    expect(html).toContain("max-w-none");
  });
});

describe("Section: element + data attrs", () => {
  it("renders a <section> tag by default (semantic HTML)", () => {
    expect(render(<Section>x</Section>)).toMatch(/^<section\b/);
  });

  it('as="header" renders a <header> tag', () => {
    expect(render(<Section as="header">x</Section>)).toMatch(/^<header\b/);
  });

  it("tags the rendered element with data-slot + data-spacing + data-tone + data-divider", () => {
    const html = render(
      <Section spacing="tight" tone="inset" divider="both">
        x
      </Section>,
    );
    expect(html).toContain('data-slot="section"');
    expect(html).toContain('data-spacing="tight"');
    expect(html).toContain('data-tone="inset"');
    expect(html).toContain('data-divider="both"');
  });
});

// =========================================
// STACK / CLUSTER — LAYOUT §3 (gap scale)
// =========================================

describe("Stack: gap scale (LAYOUT §3)", () => {
  it.each([
    ["xs", "gap-2"],
    ["sm", "gap-4"],
    ["md", "gap-6"],
    ["lg", "gap-10"],
    ["xl", "gap-16"],
    ["2xl", "gap-24"],
  ] as const)('gap="%s" produces DS-token %s', (gap, klass) => {
    expect(render(<Stack gap={gap}>x</Stack>)).toContain(klass);
  });

  it("gap maps to the numeric scale, NOT a named key that shadows max-w-*", () => {
    // Regression lock: Interlace 2.0 dropped the named --spacing-xs…2xl keys
    // because they redefined max-w-sm/md/lg in consumer apps.
    const html = render(<Stack gap="md">x</Stack>);
    expect(html).toContain("gap-6");
    expect(html).not.toContain("gap-md");
  });

  it('defaults to vertical (flex-col) + gap="md" (gap-6)', () => {
    const html = render(<Stack>x</Stack>);
    expect(html).toContain("flex-col");
    expect(html).toContain("gap-6");
  });

  it("emits data-gap / data-align / data-justify styling hooks", () => {
    const html = render(
      <Stack gap="lg" align="center" justify="between">
        x
      </Stack>,
    );
    expect(html).toContain('data-gap="lg"');
    expect(html).toContain('data-align="center"');
    expect(html).toContain('data-justify="between"');
  });

  it('direction="horizontal" produces flex-row flex-wrap', () => {
    const html = render(<Stack direction="horizontal">x</Stack>);
    expect(html).toContain("flex-row");
    expect(html).toContain("flex-wrap");
  });
});

describe("Grid: column gap fits a phone", () => {
  // Twelve tracks need eleven column gaps. The gap is in rem and grows with
  // a reader's text size; the column does not. So the column gap is the
  // step, capped at one track's share of the width (100% / cols).
  const steps = {
    "2": 8,
    "4": 16,
    "6": 24,
    "10": 40,
    "16": 64,
    "24": 96,
  } as const;
  const columnGap = (
    html: string,
    root: number,
    width: number,
    wide = false,
  ) => {
    const set = [
      ...html.matchAll(
        /(md:)?\[--grid-gap-x:calc\(var\(--spacing\)\*(\d+)\)\]/g,
      ),
    ];
    const pick = (wide && set.find((m) => m[1])) || set.find((m) => !m[1]);
    const px = pick ? (steps[pick[2] as keyof typeof steps] / 16) * root : 0;
    expect(html).toContain(
      "gap-x-[min(var(--grid-gap-x),calc(100%/var(--grid-cols,12)))]",
    );
    return Math.min(px, width / 12);
  };

  it.each(["xs", "sm", "md", "lg", "xl", "2xl"] as const)(
    'gap="%s": eleven column gaps fit a 342px column at 100% and 150%',
    (gap) => {
      const html = render(<Grid gap={gap}>x</Grid>);
      for (const root of [16, 24]) {
        expect(columnGap(html, root, 342) * 11).toBeLessThan(342);
      }
    },
  );

  it.each(["xs", "sm", "md", "lg", "xl", "2xl"] as const)(
    'gap="%s": the cap never bites on a phone at 100%%',
    (gap) => {
      const html = render(<Grid gap={gap}>x</Grid>);
      const uncapped = columnGap(html, 16, Infinity);
      expect(columnGap(html, 16, 320)).toBe(uncapped);
    },
  );

  it.each([
    ["lg", "gap-y-10"],
    ["xl", "gap-y-16"],
    ["2xl", "gap-y-24"],
  ] as const)('gap="%s": rows keep the full step (%s)', (gap, rows) => {
    expect(render(<Grid gap={gap}>x</Grid>)).toContain(rows);
  });
});

describe("Cluster: horizontal sugar (LAYOUT §3)", () => {
  it("is a horizontal Stack with wrap", () => {
    const html = render(<Cluster>x</Cluster>);
    expect(html).toContain("flex-row");
    expect(html).toContain("flex-wrap");
  });

  it('defaults to gap="sm" (gap-4) and align="center" (chip-row preset)', () => {
    const html = render(<Cluster>x</Cluster>);
    expect(html).toContain("gap-4");
    expect(html).toContain("items-center");
  });

  it('is data-slot tagged as "cluster" (overrides Stack\'s data-slot)', () => {
    expect(render(<Cluster>x</Cluster>)).toContain('data-slot="cluster"');
  });
});

// =========================================
// SECTION HEADER — LAYOUT §1 (deduplicate the header pattern)
// =========================================

describe("SectionHeader: structure (LAYOUT §1)", () => {
  it("renders the title as an <h2> by default", () => {
    const html = render(<SectionHeader title="Trusted by developers" />);
    expect(html).toContain("<h2");
    expect(html).toContain("Trusted by developers");
    expect(html).toContain("</h2>");
  });

  it('as="h1" / "h3" change the heading level', () => {
    expect(render(<SectionHeader title="t" as="h1" />)).toContain("<h1");
    expect(render(<SectionHeader title="t" as="h3" />)).toContain("<h3");
  });

  it("omits the eyebrow block when no eyebrow prop is passed", () => {
    const html = render(<SectionHeader title="t" />);
    expect(html).not.toContain("mb-4 flex items-center justify-center");
  });

  it("renders the eyebrow above the title when provided", () => {
    const html = render(
      <SectionHeader title="t" eyebrow={<span>Featured</span>} />,
    );
    expect(html).toContain("Featured");
    expect(html).toContain("mb-4 flex items-center justify-center");
  });

  it("omits the tagline <p> when no tagline prop is passed", () => {
    const html = render(<SectionHeader title="t" />);
    expect(html).not.toContain("<p");
  });

  it("tagline carries max-w-prose (locks the §2 prose width contract)", () => {
    const html = render(<SectionHeader title="t" tagline="Body copy" />);
    expect(html).toContain("max-w-prose");
    expect(html).toContain("Body copy");
  });

  it("default alignment is center (text-center on root, mx-auto on the <p>)", () => {
    const html = render(<SectionHeader title="t" tagline="tag" />);
    expect(html).toContain("text-center");
    // [&_p]:mx-auto compiles into the className verbatim
    expect(html).toContain("[&amp;_p]:mx-auto");
  });

  it('align="start" produces text-start, so it follows the writing direction (no implicit mx-auto on the <p>)', () => {
    const html = render(<SectionHeader title="t" align="start" />);
    expect(html).toContain("text-start");
    expect(html).not.toContain("text-center");
  });

  it('align="start" puts the eyebrow row at the start too, not centred', () => {
    const html = render(
      <SectionHeader title="t" eyebrow="label" align="start" />,
    );
    expect(html).toContain("justify-start");
    expect(html).not.toContain("justify-center");
  });

  it("tracks a section title like a heading and a display title tighter", () => {
    expect(render(<SectionHeader title="t" />)).toContain("tracking-heading");
    expect(render(<SectionHeader title="t" size="display" />)).toContain(
      "tracking-display",
    );
  });

  it('defaults to spacing="lg", a fraction of the comfortable section rhythm', () => {
    expect(render(<SectionHeader title="t" />)).toContain(
      "mb-[calc(var(--spacing-section-comfortable)*0.75)]",
    );
  });

  it('spacing="md" follows the tight section rhythm', () => {
    expect(render(<SectionHeader title="t" spacing="md" />)).toContain(
      "mb-[calc(var(--spacing-section-tight)*0.8)]",
    );
  });

  it('sets the title on the fluid scale: text-section by default, text-display for size="display"', () => {
    expect(render(<SectionHeader title="t" />)).toContain("text-section");
    const display = render(<SectionHeader title="t" size="display" />);
    expect(display).toContain("text-display");
    expect(display).toContain('data-size="display"');
    expect(display).not.toMatch(/text-[345]xl/);
  });

  it('eyebrowStyle="pill" wraps the eyebrow in a rounded chip; plain does not', () => {
    expect(
      render(<SectionHeader title="t" eyebrow="New" eyebrowStyle="pill" />),
    ).toMatch(/<span class="[^"]*rounded-full[^"]*">New<\/span>/);
    expect(render(<SectionHeader title="t" eyebrow="New" />)).not.toContain(
      "rounded-full",
    );
  });
});

// =========================================
// END-TO-END COMPOSITION — the homepage stats-bar contract
// =========================================

describe("Section + Container composition: the stats-bar contract", () => {
  // This case mirrors the first <Section> on the homepage:
  //   <Section spacing="tight" tone="inset" divider="both" container="content">
  // Locked here so a future Section refactor can't silently drop the inner
  // Container or change the padding scale that prevents edge-to-edge content
  // on the page (the regression that triggered LAYOUT_PHILOSOPHY.md).
  it("the homepage stats-bar pattern produces every contracted class", () => {
    const html = render(
      <Section spacing="tight" tone="inset" divider="both" container="content">
        <div data-testid="content" />
      </Section>,
    );

    // §3 vertical rhythm — tight tier (its curve clears the floors; see above)
    expect(html).toContain("py-section-tight");

    // §8 tone + divider
    expect(html).toContain("bg-card/50");
    expect(html).toContain("backdrop-blur-sm");
    expect(html).toContain("border-y");
    expect(html).toContain("border-border");

    // §7 inner Container exists
    expect(html).toContain('data-slot="container"');
    expect(html).toContain('data-size="content"');

    // §2 + §5 horizontal padding + width cap on the inner Container
    expect(html).toContain("mx-auto");
    expect(html).toContain("w-full");
    expect(html).toContain("px-4");
    expect(html).toContain("xs:px-6");
    expect(html).toContain("lg:px-8");
    expect(html).toContain("max-w-(--container-content)");
  });
});
