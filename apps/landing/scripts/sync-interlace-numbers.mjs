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
const PILLARS = ["security", "quality", "react"];
const GROUPS = ["plugins", "rules"];

for (const group of GROUPS) {
  const g = data[group];
  const ok =
    g &&
    Number.isInteger(g.total) &&
    PILLARS.every((k) => Number.isInteger(g[k])) &&
    PILLARS.reduce((sum, k) => sum + g[k], 0) === g.total;
  if (!ok) {
    console.error(`Manifest "${group}" block is missing or inconsistent`);
    process.exit(1);
  }
}

for (const key of ["source", "generatedAt"]) {
  if (typeof data[key] !== "string") {
    console.error(`Manifest is missing a string \`${key}\``);
    process.exit(1);
  }
}

/**
 * Re-derive every written value instead of passing the fetched object (or its
 * strings) through. `Number()` on an already-`Number.isInteger` value is a
 * no-op numerically but re-creates the primitive, and `sanitise` rebuilds each
 * string character-by-character, dropping the control characters that could
 * corrupt the committed JSON. Printable Unicode is preserved — `source`
 * legitimately contains an em-dash. Nothing reaches the file that the checks
 * above didn't validate (CodeQL js/http-to-file-access).
 */
const isControl = (ch) => {
  const cp = ch.codePointAt(0);
  return cp < 0x20 || (cp >= 0x7f && cp <= 0x9f);
};

const sanitise = (value, max = 200) =>
  Array.from(String(value))
    .filter((ch) => !isControl(ch))
    .slice(0, max)
    .join("");

const pick = (group) =>
  Object.fromEntries(
    ["total", ...PILLARS].map((k) => [k, Number(data[group][k])]),
  );

// Key order mirrors the upstream manifest so the committed file stays diff-
// stable when only the numbers change.
const manifest = {
  schemaVersion: 1,
  source: sanitise(data.source),
  plugins: pick("plugins"),
  rules: pick("rules"),
  generatedAt: sanitise(data.generatedAt, 40),
};

writeFileSync(
  new URL("../src/data/interlace-numbers.json", import.meta.url),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `Synced: ${data.plugins.total} plugins / ${data.rules.total} rules (generated ${data.generatedAt})`,
);
