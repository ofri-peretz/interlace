/**
 * cn() property tests.
 *
 * The lock beside this file pins the type-scale bug with hand-picked class lists. Here,
 * generated class lists try to break the same promise in orders and mixes nobody wrote by
 * hand: a DS size token survives any colour utility, and of two size tokens the last wins.
 * No dependency is added (this package is copied into consumers' trees): the generator is a
 * seeded PRNG (mulberry32), so a failure reproduces from the seed and the failing input is in
 * the assertion.
 */

import { describe, expect, it } from "vitest";

import { cn, DS_FONT_SIZES } from "../src/lib/cn";

const RUNS = 500;
const SEED = 0x5eed;

const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
};
type Next = () => number;
const pick = <T>(next: Next, items: readonly T[]): T =>
  items[Math.floor(next() * items.length)] as T;

const SIZES = DS_FONT_SIZES.map((size) => `text-${size}`);
const COLOURS = [
  "text-foreground",
  "text-muted-foreground",
  "text-primary",
  "text-destructive",
  "text-red-500",
  "text-white",
];
/**
 * Utilities from other groups, which neither a size nor a colour may remove. `leading-*` is not
 * one: a DS size pairs its own line-height, so tailwind-merge drops a `leading-*` written BEFORE
 * the size, as it does for `text-lg`. Written after the size, it is kept (the last property).
 */
const OTHERS = [
  "font-medium",
  "tracking-wide",
  "px-2",
  "rounded-md",
  "truncate",
];
const LEADINGS = [
  "leading-none",
  "leading-tight",
  "leading-snug",
  "leading-relaxed",
];

const shuffle = <T>(next: Next, items: readonly T[]): T[] =>
  items
    .map((item) => ({ item, key: next() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);

const forAll = (check: (next: Next) => void): void => {
  const next = random(SEED);
  for (let run = 0; run < RUNS; run += 1) check(next);
};

describe("cn() (properties)", () => {
  it("keeps a DS size, a colour and every other utility, in any order", () => {
    forAll((next) => {
      const size = pick(next, SIZES);
      const colour = pick(next, COLOURS);
      const others = OTHERS.filter(() => next() < 0.5);
      const input = shuffle(next, [size, colour, ...others]);
      const kept = cn(...input).split(" ");
      expect({
        input,
        kept: [size, colour, ...others].filter((one) => kept.includes(one)),
      }).toEqual({
        input,
        kept: [size, colour, ...others],
      });
    });
  });

  it("keeps only the last of two DS sizes, and only the last of two colours", () => {
    forAll((next) => {
      const [first, last] = [pick(next, SIZES), pick(next, SIZES)];
      const [early, late] = [pick(next, COLOURS), pick(next, COLOURS)];
      const input = [
        first,
        early,
        ...OTHERS.filter(() => next() < 0.5),
        last,
        late,
      ];
      const kept = cn(...input).split(" ");
      const sizes = kept.filter((one) => SIZES.includes(one));
      const colours = kept.filter((one) => COLOURS.includes(one));
      expect({ input, sizes, colours }).toEqual({
        input,
        sizes: [last],
        colours: [late],
      });
    });
  });

  it("keeps a leading-* written after the DS size, so a consumer can still set line height", () => {
    forAll((next) => {
      const size = pick(next, SIZES);
      const leading = pick(next, LEADINGS);
      const input = [size, pick(next, COLOURS), leading];
      expect({
        input,
        kept: cn(...input)
          .split(" ")
          .includes(leading),
      }).toEqual({ input, kept: true });
    });
  });
});
