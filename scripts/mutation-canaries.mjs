#!/usr/bin/env node
// The five hand-written breaks of the room's authority rules (packages/ui/mutation/canaries/*.patch):
// a non-host may send a host event; a locked room, an expired code and a full room admit a new
// player; an answer is accepted twice. Each is applied to the working tree, the room tests run, and
// EACH MUST FAIL. They do not depend on oxmutate, so a misconfigured scope that scores 100% on
// nothing cannot hide a broken gate. The tree is put back after every patch, and the unbroken tree
// must pass first, so a red test run means the patch, not a broken suite.
//
//   node scripts/mutation-canaries.mjs            # all five
//   node scripts/mutation-canaries.mjs 3-expired  # the ones whose file name contains the argument

import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "../..");
const DIR = join(ROOT, "packages/ui/mutation/canaries");
const TESTS = [
  "__tests__/games-live-room.test.tsx",
  "__tests__/games-room-access.test.tsx",
  "__tests__/games-room-hardening.test.tsx",
];

const git = (...args) =>
  execFileSync("git", args, {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
const roomTests = () =>
  spawnSync(
    "npx",
    ["vitest", "run", "--coverage.enabled=false", "--reporter=dot", ...TESTS],
    {
      cwd: join(ROOT, "packages/ui"),
      encoding: "utf8",
    },
  );

const only = process.argv[2];
const patches = readdirSync(DIR)
  .filter((f) => f.endsWith(".patch") && (!only || f.includes(only)))
  .sort();
if (patches.length === 0) {
  console.error("mutation-canaries: no patches found");
  process.exit(1);
}

const base = roomTests();
if (base.status !== 0) {
  console.error(
    "mutation-canaries: the room tests fail with no patch applied, so a red run proves nothing.\n" +
      base.stdout.slice(-800),
  );
  process.exit(1);
}

const survived = [];
for (const patch of patches) {
  const path = join(DIR, patch);
  git("apply", path);
  let result;
  try {
    result = roomTests();
  } finally {
    git("apply", "-R", path);
  }
  const red = result.status !== 0;
  console.log(`${red ? "red  " : "GREEN"}  ${patch}`);
  if (!red) survived.push(patch);
}

if (survived.length > 0) {
  console.error(
    `\nmutation-canaries: ${survived.length} canary break(s) passed the room tests: ${survived.join(", ")}. The tests no longer pin that rule.`,
  );
  process.exit(1);
}
console.log("\nmutation-canaries: every canary is caught");
