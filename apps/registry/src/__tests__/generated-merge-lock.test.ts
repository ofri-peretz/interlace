import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Registry output under `public/` is committed, and every branch that touches a
 * component rebuilds it, so two branches used to conflict on it on every merge
 * of main. Two things keep that from coming back: the output carries no per-run
 * field (a timestamp made every rebuild differ), and `.gitattributes` hands each
 * generated file to the `interlace-generated` merge driver, which keeps the
 * branch's copy for the post-merge hook to rebuild.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../../..");
const PUBLIC = "apps/registry/public";

/** Files under `public/` a person writes; everything else there is generated. */
const HAND_AUTHORED = new Set([`${PUBLIC}/favicon.svg`]);

const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });

const tracked = git("ls-files", "--", PUBLIC).split("\n").filter(Boolean);
const generated = tracked.filter((file) => !HAND_AUTHORED.has(file));

const mergeDriverOf = (files: string[]) =>
  new Map(
    git("check-attr", "merge", "--", ...files)
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [file, , value] = line.split(": ");
        return [file, value] as const;
      }),
  );

describe("generated registry output merges without conflicts", () => {
  it("finds the generated files it guards", () => {
    expect(generated.length).toBeGreaterThan(100);
  });

  it("hands every generated file to the interlace-generated merge driver", () => {
    const drivers = mergeDriverOf(generated);
    const missing = generated.filter(
      (file) => drivers.get(file) !== "interlace-generated",
    );
    expect(
      missing,
      "add a `merge=interlace-generated` line to .gitattributes for these, or list them in HAND_AUTHORED",
    ).toEqual([]);
  });

  it("leaves hand-authored files to an ordinary merge", () => {
    const drivers = mergeDriverOf([...HAND_AUTHORED]);
    for (const file of HAND_AUTHORED) {
      expect(drivers.get(file), file).toBe("unspecified");
    }
  });

  it("carries no per-run timestamp, so two branches that rebuild it agree", () => {
    const stamped = generated.filter((file) =>
      /"generatedAt"\s*:/.test(readFileSync(join(REPO_ROOT, file), "utf8")),
    );
    expect(
      stamped,
      "drop the timestamp from the generator that writes these",
    ).toEqual([]);
  });

  it("registers the driver on install and rebuilds after every merge", () => {
    const pkg = JSON.parse(
      readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.prepare).toContain(
      "git config merge.interlace-generated.driver true",
    );
    const hooks = readFileSync(join(REPO_ROOT, "lefthook.yml"), "utf8");
    expect(hooks).toMatch(
      /^post-merge:\n {2}commands:\n {4}registry:\n {6}run: npm run prebuild --workspace=registry$/m,
    );
  });
});
