import { describe, expect, it } from "vitest";

import { admit, type Room } from "./control-model";

const room = (over: Partial<Room> = {}): Room => ({
  locked: false,
  count: 1,
  max: 10,
  expiresAt: null,
  ...over,
});

describe("admit", () => {
  it("admits into an open room", () => {
    expect(admit(room(), 0)).toBe("admit");
  });
  it("refuses a locked room, and says locked before anything else", () => {
    expect(admit(room({ locked: true }), 0)).toBe("locked");
    expect(admit(room({ locked: true, count: 10, expiresAt: 0 }), 5)).toBe(
      "locked",
    );
  });
  it("refuses an expired code at the instant it expires, not a millisecond before", () => {
    expect(admit(room({ expiresAt: 100 }), 99)).toBe("admit");
    expect(admit(room({ expiresAt: 100 }), 100)).toBe("expired");
    expect(admit(room({ expiresAt: 100 }), 101)).toBe("expired");
  });
  it("has no expiry when expiresAt is null", () => {
    expect(admit(room({ expiresAt: null }), Number.MAX_SAFE_INTEGER)).toBe(
      "admit",
    );
  });
  it("refuses a full room exactly at the limit, and checks expiry first", () => {
    expect(admit(room({ count: 9 }), 0)).toBe("admit");
    expect(admit(room({ count: 10 }), 0)).toBe("full");
    expect(admit(room({ count: 11 }), 0)).toBe("full");
    expect(admit(room({ count: 10, expiresAt: 0 }), 5)).toBe("expired");
  });
});
