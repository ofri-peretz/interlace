import { describe, expect, it } from "vitest";

import { countPackages } from "../lib/live-numbers";

const pkg = (name: string, version: string, repo: string) => ({
  package: { name, version, links: { repository: `https://github.com/ofri-peretz/${repo}` } },
});

describe("countPackages", () => {
  it("counts shipped packages per Interlace repo, skipping name reservations and other repos", () => {
    const counts = countPackages([
      pkg("eslint-plugin-jwt", "2.1.0", "eslint"),
      pkg("burgee", "1.10.1", "burgee"),
      pkg("roundel", "1.3.1", "burgee"),
      pkg("pennon", "0.0.1", "burgee"),
      pkg("oxmutate", "1.5.0", "burgee"),
      pkg("@interlace/serverless-devkit", "1.0.0", "serverless"),
      pkg("@forge-js/cli", "2.5.2", "forge-js"),
    ]);
    expect(counts).toEqual({ total: 5, eslint: 1, burgee: 2, serverless: 1 });
  });
});
