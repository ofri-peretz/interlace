#!/usr/bin/env node
// The ratchet for mutation testing of the room and game logic. Zero dependencies, Node only.
//
//   node scripts/mutation-ratchet.mjs --check [--base origin/main] [--report a.json[,b.json]] [--lane full|pr] [--touched a.ts,b.test.ts] [--summary]
//   node scripts/mutation-ratchet.mjs --write --report reports/mutation/mutation.json --command "<cmd>" [--tool oxmutate@2.19.0]
//   node scripts/mutation-ratchet.mjs --scope-lock
//
// What it enforces (docs/intents/mutation-testing-room-logic/spec.md §5):
//   - a floor never falls, a file never leaves the floor file, the ignore budget never rises, an
//     `exclude` never grows;
//   - the survivor ledger is complete: every entry has a class, and equivalent or unreachable ones
//     have a reason; an untriaged entry is red;
//   - with a report: no file scores below its floor, none scores nothing (the mutant count may not
//     fall below half of what was recorded), no survivor sits outside the ledger, and a file the
//     change touched that now beats its floor by 2 points or more says "raise the floor";
//   - the scope lock: every `*-model.ts` under packages/ui/src is in scope or excluded with a reason.
// The functions are exported for scripts/mutation-ratchet.test.mjs; main() runs only as a command.

import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "../..");
const UI = "packages/ui";
export const PATHS = {
  floor: ".sdlc/bands/mutation-floor.json",
  ledger: ".sdlc/bands/mutation-survivors.json",
  scope: `${UI}/mutation/scope.json`,
};

/** Statuses of a Stryker-format report that count as a mutant the tests were asked to catch. */
const DETECTED = new Set(["Killed", "Timeout"]);
const ESCAPED = new Set(["Survived", "NoCoverage"]);
const CLASSES = new Set(["killable", "equivalent", "unreachable", "untriaged"]);
const FLOOR_KEYS = [
  "floor",
  "mutants",
  "killed",
  "survived",
  "timeouts",
  "ignored",
];
const HEADROOM = 2;
const MIN_MUTANTS_SHARE = 0.5;

const isNum = (n) => typeof n === "number" && Number.isFinite(n);

/* -------------------------------------------------------------- the report */

/** Per-file facts from a Stryker-format `mutation.json` (the shape oxmutate writes). */
export function summarise(report) {
  const out = {};
  for (const [file, data] of Object.entries(report.files ?? {})) {
    const mutants = data.mutants ?? [];
    const count = (set) => mutants.filter((m) => set.has(m.status)).length;
    const killed = mutants.filter((m) => m.status === "Killed").length;
    const timeouts = mutants.filter((m) => m.status === "Timeout").length;
    const survivors = mutants.filter((m) => ESCAPED.has(m.status));
    const detected = count(DETECTED);
    const total = detected + survivors.length;
    out[file] = {
      mutants: total,
      killed,
      timeouts,
      survived: survivors.length,
      ignored: mutants.filter((m) => m.status === "Ignored").length,
      score: total === 0 ? 0 : (detected / total) * 100,
      survivors: survivors.map((m) => ({
        id: String(m.id),
        line: m.location?.start?.line ?? 0,
        mutator: m.mutatorName ?? "unknown",
      })),
    };
  }
  return out;
}

/** The floor for a score: rounded DOWN to a whole percent, so a floor never exceeds what was measured. */
export const floorOf = (score) => Math.floor(score + 1e-9);

/* ----------------------------------------------------------------- shapes */

export function checkShape(floors, ledger) {
  const errors = [];
  const only = (obj, keys, where) => {
    for (const k of Object.keys(obj ?? {}))
      if (!keys.includes(k)) errors.push(`${where}: unknown key "${k}"`);
  };
  only(floors, ["$comment", "measured", "ignoreBudget", "files"], PATHS.floor);
  only(
    floors.measured,
    ["command", "date", "tool", "node"],
    `${PATHS.floor} measured`,
  );
  for (const [file, row] of Object.entries(floors.files ?? {})) {
    only(row, FLOOR_KEYS, `${PATHS.floor} ${file}`);
    for (const k of FLOOR_KEYS) {
      if (row[k] !== null && !isNum(row[k]))
        errors.push(
          `${PATHS.floor} ${file}: "${k}" must be a number or null (recorded when measured)`,
        );
    }
  }
  only(ledger, ["$comment", "survivors"], PATHS.ledger);
  const seen = new Set();
  for (const s of ledger.survivors ?? []) {
    const where = `${PATHS.ledger} ${s.file}:${s.line} ${s.id}`;
    only(
      s,
      ["id", "file", "line", "mutator", "class", "reason", "since"],
      where,
    );
    if (seen.has(s.id)) errors.push(`${where}: duplicate id`);
    seen.add(s.id);
    if (!CLASSES.has(s.class))
      errors.push(`${where}: class must be one of ${[...CLASSES].join(", ")}`);
    if (
      (s.class === "equivalent" || s.class === "unreachable") &&
      !String(s.reason ?? "").trim()
    ) {
      errors.push(
        `${where}: a ${s.class} survivor needs a reason, a sentence a reviewer can disprove`,
      );
    }
    if (s.class === "untriaged")
      errors.push(
        `${where}: untriaged; kill it with an assertion, or classify it equivalent or unreachable with a reason`,
      );
  }
  return errors;
}

/* ----------------------------------------------------------- against base */

/** A change may not lower a floor, drop a file, raise the ignore budget or add an exclusion. */
export function checkMonotone(base, head, baseScope, headScope) {
  const errors = [];
  for (const [file, row] of Object.entries(base.files ?? {})) {
    const now = head.files?.[file];
    if (!now) {
      errors.push(
        `${file}: removed from ${PATHS.floor}. A file leaves the floor only through a written exclusion in ${PATHS.scope}`,
      );
      continue;
    }
    if (isNum(row.floor) && (!isNum(now.floor) || now.floor < row.floor)) {
      errors.push(
        `${file}: floor ${now.floor} is below ${row.floor} on the base. A floor only rises`,
      );
    }
  }
  if (
    isNum(base.ignoreBudget) &&
    (!isNum(head.ignoreBudget) || head.ignoreBudget > base.ignoreBudget)
  ) {
    errors.push(
      `ignoreBudget ${head.ignoreBudget} is above ${base.ignoreBudget} on the base. It only falls`,
    );
  }
  const before = new Set((baseScope?.exclude ?? []).map((e) => e.file));
  for (const e of headScope?.exclude ?? []) {
    if (!before.has(e.file))
      errors.push(
        `${e.file}: newly excluded from mutation scope. Exclusions only shrink; fix the file's tests instead`,
      );
    if (!String(e.reason ?? "").trim())
      errors.push(`${e.file}: an exclusion needs a reason`);
  }
  return errors;
}

/* ------------------------------------------------------------------ report */

/**
 * The report against the floors and the ledger.
 * `touched` are the files the change touched (a model or its test), for the headroom rule.
 */
export function checkReport(
  report,
  floors,
  ledger,
  { touched = [], lane = "full" } = {},
) {
  const errors = [];
  const summary = summarise(report);
  const known = new Set((ledger.survivors ?? []).map((s) => s.id));
  const files = Object.keys(summary);
  // The pull-request lane mutates only the changed lines, so it has no score to hold against a floor
  // and a diff that touches no scoped line has nothing to report. Survivors it finds are still red.
  const full = lane === "full";
  if (full && files.length === 0)
    errors.push(
      "the report has no files: a run that scores nothing is not a pass",
    );
  for (const file of files) {
    const got = summary[file];
    const rec = floors.files?.[file];
    if (full && got.mutants === 0)
      errors.push(
        `${file}: no mutants scored: a file that scores nothing is not a pass`,
      );
    if (
      full &&
      rec &&
      isNum(rec.mutants) &&
      got.mutants < rec.mutants * MIN_MUTANTS_SHARE
    ) {
      errors.push(
        `${file}: ${got.mutants} mutants is under half of the ${rec.mutants} recorded; the scope or the mutators shrank`,
      );
    }
    if (full && rec && isNum(rec.floor) && got.score < rec.floor) {
      errors.push(
        `${file}: score ${got.score.toFixed(1)} is below the floor ${rec.floor}`,
      );
    }
    if (
      full &&
      rec &&
      isNum(rec.floor) &&
      got.score >= rec.floor + HEADROOM &&
      touched.some((t) => touchesFile(t, file))
    ) {
      errors.push(
        `${file}: score ${got.score.toFixed(1)} beats the floor ${rec.floor} by ${HEADROOM} points or more and this change touched it: ` +
          `raise the floor with: node scripts/mutation-ratchet.mjs --write --report <report> --command "<command>"`,
      );
    }
    for (const s of got.survivors) {
      if (!known.has(s.id)) {
        errors.push(
          `${file}:${s.line} ${s.mutator} survived and is not in the ledger. fix: assert the behaviour it changes, or triage it in ${PATHS.ledger}`,
        );
      }
    }
  }
  return errors;
}

/** Shards (or any parts of one run) as one report: a file's mutants from every part, together. */
export function mergeReports(reports) {
  const files = {};
  for (const r of reports) {
    for (const [file, data] of Object.entries(r.files ?? {})) {
      files[file] = {
        ...(files[file] ?? data),
        mutants: [...(files[file]?.mutants ?? []), ...(data.mutants ?? [])],
      };
    }
  }
  return { ...(reports[0] ?? {}), files };
}

/** A markdown table for the job summary: what was measured against what the floor says. */
export function summaryTable(report, floors) {
  const rows = Object.entries(summarise(report)).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const lines = [
    "| file | mutants | killed | survived | timeouts | score | floor | headroom |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const [file, g] of rows) {
    const floor = floors.files?.[file]?.floor;
    const head = isNum(floor) ? (g.score - floor).toFixed(1) : "";
    lines.push(
      `| ${file} | ${g.mutants} | ${g.killed} | ${g.survived} | ${g.timeouts} | ${g.score.toFixed(1)} | ${isNum(floor) ? floor : "recorded when measured"} | ${head} |`,
    );
  }
  return lines.join("\n");
}

/** True when `touchedPath` is the file itself or the test named for it. */
export function touchesFile(touchedPath, file) {
  const base = file
    .replace(/^src\/(games|patterns)\//, "")
    .replace(/\.ts$/, "");
  return (
    touchedPath.endsWith(file) ||
    (touchedPath.includes("__tests__/") &&
      touchedPath.includes(base.replace(/-model$/, "")))
  );
}

/* ------------------------------------------------------------------- write */

/**
 * The floor and ledger after a run. Floors only rise, survivors the run no longer reports leave
 * the ledger, and a new survivor comes in as `untriaged` (red until a person classifies it): a
 * bot never makes a survivor acceptable.
 */
export function writeFrom(
  report,
  floors,
  ledger,
  { command, tool, node, date },
) {
  const summary = summarise(report);
  const nextFloors = JSON.parse(JSON.stringify(floors));
  nextFloors.measured = { command, date, tool, node };
  for (const [file, got] of Object.entries(summary)) {
    const prev = nextFloors.files[file] ?? {};
    const floor = Math.max(
      isNum(prev.floor) ? prev.floor : 0,
      floorOf(got.score),
    );
    nextFloors.files[file] = {
      floor,
      mutants: got.mutants,
      killed: got.killed,
      survived: got.survived,
      timeouts: got.timeouts,
      ignored: got.ignored,
    };
  }
  const present = new Map();
  for (const [file, got] of Object.entries(summary))
    for (const s of got.survivors) present.set(s.id, { file, ...s });
  const kept = (ledger.survivors ?? []).filter((s) => present.has(s.id));
  const have = new Set(kept.map((s) => s.id));
  const added = [...present.values()]
    .filter((s) => !have.has(s.id))
    .map((s) => ({
      id: s.id,
      file: s.file,
      line: s.line,
      mutator: s.mutator,
      class: "untriaged",
      since: date,
    }));
  return {
    floors: nextFloors,
    ledger: { ...ledger, survivors: [...kept, ...added] },
  };
}

/* -------------------------------------------------------------- scope lock */

const globToRegExp = (glob) =>
  new RegExp(
    "^" +
      glob
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "@@GLOBSTAR@@")
        .replace(/\*/g, "[^/]*")
        .replace(/@@GLOBSTAR@@/g, ".*") +
      "$",
  );

/** Every `*-model.ts` under `src/` that is neither in scope nor excluded with a reason. */
export function scopeLock(modelFiles, scope) {
  const include = (scope.include ?? []).map(globToRegExp);
  const excluded = new Set((scope.exclude ?? []).map((e) => e.file));
  return modelFiles
    .filter((f) => !include.some((re) => re.test(f)) && !excluded.has(f))
    .map(
      (f) =>
        `${f}: a model that is neither in ${PATHS.scope} include nor excluded with a reason. Add it to include, or exclude it and say why`,
    );
}

/** Files named in `include` that exist, for the floor file's keys. */
export function filesInScope(allFiles, scope) {
  const include = (scope.include ?? []).map(globToRegExp);
  const excluded = new Set((scope.exclude ?? []).map((e) => e.file));
  return allFiles.filter(
    (f) => include.some((re) => re.test(f)) && !excluded.has(f),
  );
}

/* --------------------------------------------------------------------- CLI */

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "node_modules") walk(p, out);
    } else out.push(p);
  }
  return out;
};
const git = (...args) =>
  execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
const gitShow = (ref, path) => {
  try {
    return JSON.parse(git("show", `${ref}:${path}`));
  } catch {
    return null; // the file is new on this branch: nothing to be monotone against
  }
};
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const has = (name) => process.argv.includes(`--${name}`);

function srcRelative() {
  const src = join(ROOT, UI, "src");
  return walk(src).map((p) =>
    relative(join(ROOT, UI), p).split("\\").join("/"),
  );
}

function main() {
  const floors = readJson(join(ROOT, PATHS.floor));
  const ledger = readJson(join(ROOT, PATHS.ledger));
  const scope = readJson(join(ROOT, PATHS.scope));
  const errors = [];

  if (has("scope-lock")) {
    const models = srcRelative().filter((f) => f.endsWith("-model.ts"));
    errors.push(...scopeLock(models, scope));
    const inScope = filesInScope(srcRelative(), scope);
    for (const f of inScope)
      if (!floors.files?.[f])
        errors.push(`${f}: in scope but has no row in ${PATHS.floor}`);
  } else if (has("check")) {
    errors.push(...checkShape(floors, ledger));
    const base = arg("base") ?? "origin/main";
    const baseFloors = gitShow(base, PATHS.floor);
    if (baseFloors)
      errors.push(
        ...checkMonotone(baseFloors, floors, gitShow(base, PATHS.scope), scope),
      );
    const reportPaths = (arg("report") ?? "").split(",").filter(Boolean);
    if (reportPaths.length > 0) {
      const missing = reportPaths.filter((p) => !existsSync(p));
      if (missing.length > 0)
        errors.push(
          `${missing.join(", ")}: no report: the run did not finish, which is not a pass`,
        );
      else {
        const merged = mergeReports(reportPaths.map(readJson));
        errors.push(
          ...checkReport(merged, floors, ledger, {
            touched: (arg("touched") ?? "").split(",").filter(Boolean),
            lane: arg("lane") ?? "full",
          }),
        );
        if (process.env.GITHUB_STEP_SUMMARY && has("summary")) {
          appendFileSync(
            process.env.GITHUB_STEP_SUMMARY,
            `### Mutation floors\n\n${summaryTable(merged, floors)}\n`,
          );
        }
      }
    }
  } else if (has("write")) {
    const reportPaths = (arg("report") ?? "").split(",").filter(Boolean);
    if (reportPaths.length === 0 || reportPaths.some((p) => !existsSync(p))) {
      console.error(
        "mutation-ratchet --write needs --report <mutation.json>[,<more shards>]",
      );
      process.exit(2);
    }
    const next = writeFrom(
      mergeReports(reportPaths.map(readJson)),
      floors,
      ledger,
      {
        command: arg("command") ?? null,
        tool: arg("tool") ?? null,
        node: process.version,
        date: new Date().toISOString().slice(0, 10),
      },
    );
    writeFileSync(
      join(ROOT, PATHS.floor),
      `${JSON.stringify(next.floors, null, 2)}\n`,
    );
    writeFileSync(
      join(ROOT, PATHS.ledger),
      `${JSON.stringify(next.ledger, null, 2)}\n`,
    );
    console.log(`mutation-ratchet: wrote ${PATHS.floor} and ${PATHS.ledger}`);
    return;
  } else {
    console.error("usage: mutation-ratchet --check | --write | --scope-lock");
    process.exit(2);
  }

  if (errors.length > 0) {
    console.error(
      `mutation-ratchet: ${errors.length} problem(s)\n\n${errors.map((e) => `  ${e}`).join("\n")}\n`,
    );
    process.exit(1);
  }
  console.log("mutation-ratchet: ok");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
