// The ratchet's own tests: each way the gate must go red is shown red here, and the way it stays
// green is shown green. `node --test scripts/mutation-ratchet.test.mjs`, no dependencies.
import assert from "node:assert/strict";
import test from "node:test";

import {
  checkMonotone,
  checkReport,
  checkShape,
  filesInScope,
  floorOf,
  mergeReports,
  summaryTable,
  scopeLock,
  summarise,
  touchesFile,
  writeFrom,
} from "./mutation-ratchet.mjs";

const ROOM = "src/games/room-model.ts";
const STREAK = "src/games/streak-model.ts";
const row = (floor, mutants = 100) => ({
  floor,
  mutants,
  killed: floor,
  survived: mutants - floor,
  timeouts: 0,
  ignored: 0,
});
const floors = (over = {}) => ({
  measured: {
    command: "c",
    date: "2026-12-01",
    tool: "oxmutate@2.19.0",
    node: "v24",
  },
  ignoreBudget: 3,
  files: { [ROOM]: row(90), [STREAK]: row(80) },
  ...over,
});
const ledger = (survivors = []) => ({ survivors });
const mutant = (id, status, line = 1, mutatorName = "EqualityOperator") => ({
  id,
  status,
  mutatorName,
  location: { start: { line } },
});
/** A report where `file` has `killed` killed mutants and the given survivors. */
const report = (file, killed, survivors = []) => ({
  files: {
    [file]: {
      mutants: [
        ...Array.from({ length: killed }, (_, i) => mutant(`k${i}`, "Killed")),
        ...survivors.map((s, i) =>
          mutant(s.id ?? `s${i}`, "Survived", s.line ?? i + 1),
        ),
      ],
    },
  },
});

test("an unchanged floor file passes", () => {
  assert.deepEqual(
    checkMonotone(floors(), floors(), { exclude: [] }, { exclude: [] }),
    [],
  );
  assert.deepEqual(checkShape(floors(), ledger()), []);
});

test("lowering a floor by one is red, raising one is green", () => {
  const lower = floors({ files: { [ROOM]: row(89), [STREAK]: row(80) } });
  assert.match(
    checkMonotone(floors(), lower, {}, {})[0],
    /room-model.ts: floor 89 is below 90/,
  );
  const higher = floors({ files: { [ROOM]: row(95), [STREAK]: row(80) } });
  assert.deepEqual(checkMonotone(floors(), higher, {}, {}), []);
});

test("a floor that was null on the base can be set to anything: it is being measured", () => {
  const unmeasured = floors({
    files: { [ROOM]: row(null), [STREAK]: row(80) },
    ignoreBudget: null,
  });
  assert.deepEqual(checkMonotone(unmeasured, floors(), {}, {}), []);
});

test("deleting a file from the floor file is red", () => {
  const gone = floors({ files: { [ROOM]: row(90) } });
  assert.match(
    checkMonotone(floors(), gone, {}, {})[0],
    /streak-model.ts: removed/,
  );
});

test("raising the ignore budget is red, lowering it is green", () => {
  assert.match(
    checkMonotone(floors(), floors({ ignoreBudget: 4 }), {}, {})[0],
    /ignoreBudget 4 is above 3/,
  );
  assert.deepEqual(
    checkMonotone(floors(), floors({ ignoreBudget: 2 }), {}, {}),
    [],
  );
});

test("a new exclusion is red, and so is one with no reason", () => {
  const head = { exclude: [{ file: "src/games/qr-model.ts", reason: "slow" }] };
  assert.match(
    checkMonotone(floors(), floors(), { exclude: [] }, head)[0],
    /qr-model.ts: newly excluded/,
  );
  const bare = { exclude: [{ file: "src/games/qr-model.ts", reason: "" }] };
  assert.ok(
    checkMonotone(floors(), floors(), bare, bare).some((e) =>
      /needs a reason/.test(e),
    ),
  );
  assert.deepEqual(checkMonotone(floors(), floors(), head, head), []);
});

test("the scope lock names a model that is neither in scope nor excluded", () => {
  const scope = {
    include: ["src/games/*-model.ts", "src/patterns/*-model.ts"],
    exclude: [{ file: "src/charts/time-slider-model.ts", reason: "r" }],
  };
  assert.deepEqual(
    scopeLock(
      ["src/games/room-model.ts", "src/charts/time-slider-model.ts"],
      scope,
    ),
    [],
  );
  const found = scopeLock(
    ["src/games/room-model.ts", "src/rooms/new-model.ts"],
    scope,
  );
  assert.equal(found.length, 1);
  assert.match(found[0], /src\/rooms\/new-model.ts/);
});

test("files in scope come from the globs and respect the exclusions", () => {
  const scope = {
    include: ["src/games/*-model.ts", "src/games/daily.ts"],
    exclude: [{ file: "src/games/qr-model.ts", reason: "r" }],
  };
  assert.deepEqual(
    filesInScope(
      [
        "src/games/room-model.ts",
        "src/games/qr-model.ts",
        "src/games/daily.ts",
        "src/games/x.tsx",
        "src/games/deep/a-model.ts",
      ],
      scope,
    ),
    ["src/games/room-model.ts", "src/games/daily.ts"],
  );
});

test("a report at or above the floor with no stray survivor passes", () => {
  assert.deepEqual(
    checkReport(
      report(
        ROOM,
        90,
        Array.from({ length: 10 }, (_, i) => ({ id: `s${i}` })),
      ),
      floors(),
      ledger(
        Array.from({ length: 10 }, (_, i) => ({
          id: `s${i}`,
          class: "equivalent",
          reason: "r",
        })),
      ),
    ),
    [],
  );
});

test("a score below the floor is red", () => {
  const errors = checkReport(
    report(
      ROOM,
      80,
      Array.from({ length: 20 }, (_, i) => ({ id: `s${i}` })),
    ),
    floors(),
    ledger(Array.from({ length: 20 }, (_, i) => ({ id: `s${i}` }))),
  );
  assert.ok(errors.some((e) => /score 80.0 is below the floor 90/.test(e)));
});

test("a survivor that is not in the ledger is red, with file, line, mutator and a fix", () => {
  const errors = checkReport(
    report(ROOM, 99, [{ id: "new", line: 412 }]),
    floors(),
    ledger(),
  );
  assert.equal(errors.length, 1);
  assert.match(
    errors[0],
    /room-model.ts:412 EqualityOperator survived and is not in the ledger. fix:/,
  );
});

test("one survivor fixed and another added at the same score is still red", () => {
  const errors = checkReport(
    report(ROOM, 99, [{ id: "other", line: 7 }]),
    floors(),
    ledger([{ id: "old", class: "killable" }]),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /room-model.ts:7/);
});

test("a run that scores nothing is never green", () => {
  assert.match(
    checkReport({ files: {} }, floors(), ledger())[0],
    /scores nothing/,
  );
  const empty = { files: { [ROOM]: { mutants: [] } } };
  assert.ok(
    checkReport(empty, floors(), ledger()).some((e) =>
      /no mutants scored/.test(e),
    ),
  );
});

test("a file whose mutant count fell under half of the recorded one is red", () => {
  const few = report(ROOM, 40, []);
  assert.ok(
    checkReport(few, floors(), ledger()).some((e) =>
      /under half of the 100 recorded/.test(e),
    ),
  );
  const enough = report(ROOM, 100, []);
  assert.deepEqual(checkReport(enough, floors(), ledger()), []);
});

test('the headroom rule: beating the floor by 2 points while touching the file says "raise the floor"', () => {
  const r = report(ROOM, 100, []); // 100% against a floor of 90
  assert.ok(
    checkReport(r, floors(), ledger(), {
      touched: ["packages/ui/src/games/room-model.ts"],
    }).some((e) => /raise the floor with/.test(e)),
  );
  assert.ok(
    checkReport(r, floors(), ledger(), {
      touched: ["packages/ui/__tests__/games-room-access.test.tsx"],
    }).some((e) => /raise the floor with/.test(e)),
    "the test named for the model counts as touching it",
  );
  assert.deepEqual(
    checkReport(r, floors(), ledger(), { touched: [] }),
    [],
    "untouched: no demand",
  );
  assert.deepEqual(
    checkReport(r, floors(), ledger(), {
      touched: ["packages/ui/src/games/streak-model.ts"],
    }),
    [],
  );
});

test("timeouts count as detected, NoCoverage as escaped, and ignored mutants do not count at all", () => {
  const r = {
    files: {
      [ROOM]: {
        mutants: [
          mutant("a", "Killed"),
          mutant("b", "Timeout"),
          mutant("c", "NoCoverage"),
          mutant("d", "Ignored"),
          mutant("e", "CompileError"),
        ],
      },
    },
  };
  const s = summarise(r)[ROOM];
  assert.equal(s.mutants, 3);
  assert.equal(s.timeouts, 1);
  assert.equal(s.survived, 1);
  assert.equal(s.ignored, 1);
  assert.ok(Math.abs(s.score - 66.666) < 0.01);
});

test("a floor is the score rounded down, never above it", () => {
  assert.equal(floorOf(91.99), 91);
  assert.equal(floorOf(100), 100);
  assert.equal(floorOf(66.666), 66);
  for (const score of [0, 12.5, 77.7, 99.99])
    assert.ok(floorOf(score) <= score);
});

test("--write raises floors, never lowers one, and is idempotent", () => {
  const meta = {
    command: "npm run mutate",
    tool: "oxmutate@2.19.0",
    node: "v24",
    date: "2026-12-02",
  };
  const first = writeFrom(
    report(ROOM, 95, [
      { id: "s1" },
      { id: "s2" },
      { id: "s3" },
      { id: "s4" },
      { id: "s5" },
    ]),
    floors(),
    ledger(),
    meta,
  );
  assert.equal(first.floors.files[ROOM].floor, 95);
  const lowerRun = writeFrom(
    report(
      ROOM,
      50,
      Array.from({ length: 50 }, (_, i) => ({ id: `s${i}` })),
    ),
    first.floors,
    first.ledger,
    meta,
  );
  assert.equal(
    lowerRun.floors.files[ROOM].floor,
    95,
    "a worse run does not lower the floor",
  );
  const again = writeFrom(
    report(ROOM, 95, [
      { id: "s1" },
      { id: "s2" },
      { id: "s3" },
      { id: "s4" },
      { id: "s5" },
    ]),
    first.floors,
    first.ledger,
    meta,
  );
  assert.deepEqual(again, first);
});

test("--write brings new survivors in as untriaged, and lets a killed one leave", () => {
  const meta = { command: "c", tool: "t", node: "n", date: "2026-12-02" };
  const withNew = writeFrom(
    report(ROOM, 99, [{ id: "fresh", line: 9 }]),
    floors(),
    ledger([
      {
        id: "gone",
        file: ROOM,
        line: 1,
        mutator: "m",
        class: "killable",
        since: "x",
      },
    ]),
    meta,
  );
  assert.deepEqual(
    withNew.ledger.survivors.map((s) => [s.id, s.class]),
    [["fresh", "untriaged"]],
  );
  assert.ok(
    checkShape(withNew.floors, withNew.ledger).some((e) => /untriaged/.test(e)),
    "an untriaged survivor is red on main",
  );
});

test("the shape check: unknown keys, equivalent without a reason, duplicate ids, a bad class", () => {
  assert.ok(
    checkShape({ ...floors(), extra: 1 }, ledger()).some((e) =>
      /unknown key "extra"/.test(e),
    ),
  );
  assert.ok(
    checkShape(
      floors({ files: { [ROOM]: { ...row(90), bonus: 1 } } }),
      ledger(),
    ).some((e) => /unknown key "bonus"/.test(e)),
  );
  assert.ok(
    checkShape(
      floors({ files: { [ROOM]: { ...row(90), floor: "90" } } }),
      ledger(),
    ).some((e) => /must be a number or null/.test(e)),
  );
  assert.ok(
    checkShape(
      floors(),
      ledger([{ id: "a", file: ROOM, line: 1, class: "equivalent" }]),
    ).some((e) => /needs a reason/.test(e)),
  );
  assert.ok(
    checkShape(
      floors(),
      ledger([{ id: "a", class: "unreachable", reason: "  " }]),
    ).some((e) => /needs a reason/.test(e)),
  );
  assert.ok(
    checkShape(
      floors(),
      ledger([
        { id: "a", class: "killable" },
        { id: "a", class: "killable" },
      ]),
    ).some((e) => /duplicate id/.test(e)),
  );
  assert.ok(
    checkShape(floors(), ledger([{ id: "a", class: "shrug" }])).some((e) =>
      /class must be one of/.test(e),
    ),
  );
  assert.deepEqual(
    checkShape(
      floors(),
      ledger([
        {
          id: "a",
          class: "equivalent",
          reason: "the values are never equal here",
        },
      ]),
    ),
    [],
  );
});

test("a model and the test named for it are the same file for the headroom rule", () => {
  assert.ok(touchesFile("packages/ui/src/games/room-model.ts", ROOM));
  assert.ok(
    touchesFile("packages/ui/__tests__/games-room-access.test.tsx", ROOM),
  );
  assert.ok(!touchesFile("packages/ui/src/games/streak-model.ts", ROOM));
});

test("the pull-request lane holds survivors to the ledger and nothing else: no floor, no count, no headroom", () => {
  const few = report(ROOM, 3, [{ id: "fresh", line: 5 }]); // 3 of 4: far below any floor, and a tiny count
  const errors = checkReport(few, floors(), ledger(), {
    lane: "pr",
    touched: [ROOM],
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /room-model.ts:5 EqualityOperator survived/);
  assert.deepEqual(
    checkReport({ files: {} }, floors(), ledger(), { lane: "pr" }),
    [],
    "a diff with no scoped line scores nothing, and that is fine",
  );
  assert.ok(
    checkReport({ files: {} }, floors(), ledger(), { lane: "full" }).length > 0,
    "the full run may not",
  );
});

test("shards merge into one report: a file keeps the mutants of every shard", () => {
  const a = report(ROOM, 2, [{ id: "x" }]);
  const b = report(ROOM, 3, []);
  b.files[ROOM].mutants.forEach((m, i) => (m.id = `b${i}`));
  const merged = mergeReports([a, b, report(STREAK, 1)]);
  assert.equal(merged.files[ROOM].mutants.length, 6);
  assert.equal(summarise(merged)[ROOM].mutants, 6);
  assert.deepEqual(Object.keys(merged.files).sort(), [ROOM, STREAK].sort());
});

test("the summary table names every file with its score, floor and headroom", () => {
  const table = summaryTable(
    report(
      ROOM,
      95,
      Array.from({ length: 5 }, (_, i) => ({ id: `s${i}` })),
    ),
    floors({ files: { [ROOM]: row(90) } }),
  );
  assert.match(
    table,
    /\| src\/games\/room-model.ts \| 100 \| 95 \| 5 \| 0 \| 95.0 \| 90 \| 5.0 \|/,
  );
  assert.match(
    summaryTable(report(STREAK, 1), floors({ files: {} })),
    /recorded when measured/,
  );
});
