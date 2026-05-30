import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Live-page axe-core sweep against the built Next app. This is the layer
 * storybook can't reach — it sees what the actual deployed page renders,
 * with the actual Tailwind compilation, the actual font loading, the actual
 * theme provider state. Storybook isolates components against the source
 * baseline; this isolates nothing.
 *
 * Rule scope mirrors the storybook config:
 *   - WCAG 2.0/2.1/2.2 A + AA
 *   - axe `best-practice` tag (region landmarks, single h1, etc. — these
 *     run here because the live page IS a real page, unlike storybook)
 *   - AAA disabled (purple gradient breaks color-contrast-enhanced).
 */

const A11Y_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

const ROUTES_LIGHT_THEME: Array<{ path: string; description: string }> = [
  { path: "/", description: "home" },
];

for (const { path, description } of ROUTES_LIGHT_THEME) {
  test(`${description} (${path}) — light theme passes axe`, async ({
    page,
  }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page })
      .withTags(A11Y_TAGS)
      .analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual(
      [],
    );
  });

  test(`${description} (${path}) — dark theme passes axe`, async ({ page }) => {
    // Set the next-themes localStorage key BEFORE navigating so the
    // hydration script picks up the preference and applies `.dark` to
    // <html> on first paint. Adding the class manually post-load races
    // with next-themes' own re-evaluation.
    await page.addInitScript(() => {
      localStorage.setItem("theme", "dark");
    });
    await page.goto(path, { waitUntil: "networkidle" });
    // Sanity-check that the class actually applied — fail clearly if not.
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(isDark, "dark class did not apply on <html>").toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(A11Y_TAGS)
      .analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual(
      [],
    );
  });
}

function formatViolations(
  violations: ReadonlyArray<{
    id: string;
    help: string;
    nodes: ReadonlyArray<{ html: string; failureSummary?: string | undefined }>;
  }>,
): string {
  if (violations.length === 0) return "no violations";
  return violations
    .map(
      (v) =>
        `\n[${v.id}] ${v.help}\n${v.nodes
          .map(
            (n) =>
              `  - ${n.html}\n    ${n.failureSummary?.replace(/\n/g, "\n    ") ?? ""}`,
          )
          .join("\n")}`,
    )
    .join("\n");
}
