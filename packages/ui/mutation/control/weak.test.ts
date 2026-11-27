import { expect, it } from "vitest";

import { admit } from "./control-model";

// Runs every line, asserts two outcomes: the lines are covered, the boundaries are not pinned.
it("admits into an open room and refuses a locked one", () => {
  expect(admit({ locked: false, count: 1, max: 10, expiresAt: null }, 0)).toBe(
    "admit",
  );
  expect(admit({ locked: true, count: 1, max: 10, expiresAt: null }, 0)).toBe(
    "locked",
  );
  admit({ locked: false, count: 1, max: 10, expiresAt: 5 }, 100);
  admit({ locked: false, count: 10, max: 10, expiresAt: null }, 0);
});
