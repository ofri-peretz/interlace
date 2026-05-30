import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { validateInternalLinks } from "#interlace/validators/internal-links";

describe("internal links", () => {
  it("all internal MDX links resolve to existing pages", async () => {
    const findings = await validateInternalLinks({
      contentDir: resolve(__dirname, "..", "..", "content", "docs"),
    });

    if (findings.length > 0) {
      console.error("Broken internal links:", findings);
    }
    expect(findings).toEqual([]);
  });
});
