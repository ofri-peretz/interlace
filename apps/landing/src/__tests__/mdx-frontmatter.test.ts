import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { validateMdxFrontmatter } from "#interlace/validators/mdx-frontmatter";

describe("mdx frontmatter", () => {
  it("every page has title + description and follows AUTHORING.md rules", async () => {
    const findings = await validateMdxFrontmatter({
      contentDir: resolve(__dirname, "..", "..", "content", "docs"),
    });

    const errors = findings.filter((f) => f.severity === "error");
    if (errors.length > 0) {
      console.error("Frontmatter errors:", errors);
    }
    expect(errors).toEqual([]);
  });
});
