#!/usr/bin/env node
/**
 * Refresh src/data/interlace-numbers.json from the eslint repo's generated
 * numbers manifest (the single source of truth for plugin/rule counts,
 * generated there by apps/docs/scripts/sync-plugin-stats.ts from the actual
 * package registry). Never hand-edit the local copy.
 *
 * Run: npm run sync:numbers -w landing
 */
import { writeFileSync } from "node:fs";

const MANIFEST_URL =
  "https://raw.githubusercontent.com/ofri-peretz/eslint/main/apps/docs/src/data/interlace-numbers.json";

const res = await fetch(MANIFEST_URL);
if (!res.ok) {
  console.error(`Failed to fetch numbers manifest: HTTP ${res.status}`);
  process.exit(1);
}
const data = await res.json();
if (data.schemaVersion !== 1) {
  console.error(`Unexpected manifest schemaVersion: ${data.schemaVersion}`);
  process.exit(1);
}
// Refuse to write a malformed or internally inconsistent manifest — a bad
// upstream generate should fail here, not at the next CI run.
for (const group of ["plugins", "rules"]) {
  const g = data[group];
  const pillars = ["security", "quality", "react"];
  const ok =
    g &&
    Number.isInteger(g.total) &&
    pillars.every((k) => Number.isInteger(g[k])) &&
    pillars.reduce((sum, k) => sum + g[k], 0) === g.total;
  if (!ok) {
    console.error(`Manifest "${group}" block is missing or inconsistent`);
    process.exit(1);
  }
}
// Rebuild the manifest field-by-field from the values just validated rather
// than writing the parsed response through. The checks above prove the shape
// is sound but leave `data` an arbitrary upstream object — anything extra it
// carried would land in a committed file (and CodeQL js/http-to-file-access
// rightly flags the fetch → write path). An explicit projection writes only
// the eleven fields consumers actually read.
const PILLARS = ["security", "quality", "react"];
const pick = (group) =>
  Object.fromEntries([
    ["total", data[group].total],
    ...PILLARS.map((k) => [k, data[group][k]]),
  ]);

for (const key of ["source", "generatedAt"]) {
  if (typeof data[key] !== "string") {
    console.error(`Manifest is missing a string \`${key}\``);
    process.exit(1);
  }
}

// Key order mirrors the upstream manifest so the committed file stays diff-
// stable when only the numbers change.
const manifest = {
  schemaVersion: 1,
  source: data.source,
  plugins: pick("plugins"),
  rules: pick("rules"),
  generatedAt: data.generatedAt,
};

writeFileSync(
  new URL("../src/data/interlace-numbers.json", import.meta.url),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `Synced: ${data.plugins.total} plugins / ${data.rules.total} rules (generated ${data.generatedAt})`,
);
