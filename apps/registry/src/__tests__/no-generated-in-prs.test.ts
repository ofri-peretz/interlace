import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error plain .mjs shared with the CI gate
import { HAND_AUTHORED, isGenerated } from "../../scripts/lib/generated-paths.mjs";

/**
 * A feature PR commits sources only; the release commit carries the registry output. The CI
 * gate `registry (no generated output in PRs)` runs check-no-generated-output.mjs. These tests
 * hold the gate: it fails a PR that touches generated output and passes one that does not, and
 * its idea of "generated" is the same set .gitattributes and the merge-lock test use.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../../..");
const SCRIPT = join(REPO_ROOT, "apps/registry/scripts/check-no-generated-output.mjs");

const repos: string[] = [];
afterEach(() => {
  while (repos.length) rmSync(repos.pop()!, { recursive: true, force: true });
});

function repoWithBranch(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "nogen-"));
  repos.push(dir);
  const git = (...a: string[]) =>
    execFileSync("git", a, { cwd: dir, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  writeFileSync(join(dir, "seed.txt"), "seed");
  git("add", "-A");
  git("commit", "-qm", "seed", "--no-verify");
  git("switch", "-qc", "feature");
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  git("add", "-A");
  git("commit", "-qm", "change", "--no-verify");
  return dir;
}

const run = (cwd: string) =>
  spawnSync("node", [SCRIPT, "main"], { cwd, encoding: "utf8" });

describe("a feature PR carries sources only", () => {
  it("fails a diff that touches generated registry output, and names the files", () => {
    const dir = repoWithBranch({
      "packages/ui/src/x.tsx": "source",
      "apps/registry/public/r/button.json": "{}",
      "apps/registry/public/llms.txt": "x",
    });
    const result = run(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/registry/public/r/button.json");
    expect(result.stderr).toContain("apps/registry/public/llms.txt");
    expect(result.stderr).not.toContain("packages/ui/src/x.tsx");
  });

  it("passes a diff of sources and hand-authored public files", () => {
    const dir = repoWithBranch({
      "packages/ui/src/x.tsx": "source",
      "apps/registry/public/favicon.svg": "<svg/>",
    });
    expect(run(dir).status).toBe(0);
  });

  it("treats every tracked generated file as generated, and hand-authored ones as not", () => {
    const tracked = execFileSync(
      "git",
      ["ls-files", "--", "apps/registry/public"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);
    for (const file of tracked) {
      expect(isGenerated(file), file).toBe(!HAND_AUTHORED.has(file));
    }
    expect(isGenerated("apps/registry/src/lib/registry.ts")).toBe(false);
  });
});
