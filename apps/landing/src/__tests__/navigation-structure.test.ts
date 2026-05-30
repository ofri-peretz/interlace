import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { validateNavigationStructure } from "#interlace/validators/navigation-structure";

describe("navigation structure", () => {
  it("every meta.json entry resolves to a real sibling page or folder", async () => {
    const findings = await validateNavigationStructure({
      contentDir: resolve(__dirname, "..", "..", "content", "docs"),
    });

    if (findings.length > 0) {
      console.error("Navigation structure issues:", findings);
    }
    expect(findings).toEqual([]);
  });
});
