/**
 * Combobox + CommandPalette structural lock.
 *
 * WHY A SECOND FILE NEXT TO `combobox-command-render`
 * ---------------------------------------------------
 * The render test drives the state machine and proves the behaviour. It
 * cannot prove the things that have no runtime signature:
 *
 *   - That the keyboard contract is WRITTEN DOWN in the file a consumer
 *     installs. A shadcn-style registry ships the source, not the docs site,
 *     so a behaviour that only exists in a dependency's README is a behaviour
 *     the consumer will not know they have. Half these rows differ from
 *     `Select` (Home/End move the caret, focus never enters the list), which
 *     is exactly the kind of thing a reader assumes rather than checks.
 *   - That the palette still COMPOSES `dialog.tsx` instead of growing its own
 *     copy of a modal. A fork passes every behavioural test on the day it is
 *     written and then drifts.
 *   - That the hit targets are ≥24px (SC 2.5.8). jsdom reports every box as
 *     0×0, so no render test in this package can ever assert a size. The
 *     class is the only evidence available here, and it is real evidence:
 *     the DS has no stylesheet layer that would override it.
 *   - That `ComboboxCompose` keeps the function-child form. The mapped form
 *     renders identically at rest and silently stops filtering.
 *
 * Static source-parse is the same posture as the sibling locks: assert what
 * the SOURCE says, so a refactor that hides the contract behind a helper
 * can't launder past the check.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');
const PRIMITIVES_DIR = join(REPO_ROOT, 'packages/ui/src/primitives');
const STORIES_DIR = join(REPO_ROOT, 'apps/storybook/src/stories/primitives');

const COMBOBOX = readFileSync(join(PRIMITIVES_DIR, 'combobox.tsx'), 'utf-8');
const PALETTE = readFileSync(join(PRIMITIVES_DIR, 'command-palette.tsx'), 'utf-8');

/** Everything above the first `import` — the JSDoc header. */
const header = (source: string): string =>
  source.slice(0, source.indexOf('\nimport '));

/** Everything below it — the code. */
const body = (source: string): string =>
  source.slice(source.indexOf('\nimport '));

describe('combobox + command-palette: the contract is written down', () => {
  /**
   * The rows that differ from `Select`. A reader who ports a Select
   * assumption onto a Combobox writes a broken test and then "fixes" the
   * component to match it, so each of these has to be stated where they will
   * read it.
   */
  const REQUIRED_HEADER_FACTS: ReadonlyArray<
    readonly [file: 'combobox' | 'command-palette', needle: RegExp, why: string]
  > = [
    [
      'combobox',
      /\|\s*Key\s*\|/,
      'the keyboard table itself',
    ],
    [
      'combobox',
      /Home\s*\/\s*End/,
      'Home/End move the CARET here, not the highlight — the opposite of Select',
    ],
    [
      'combobox',
      /aria-activedescendant/,
      'navigation is virtual; focus never enters the list',
    ],
    [
      'combobox',
      /Esc \(closed\)/,
      'Escape on a closed popup clears the field — it is not a no-op',
    ],
    [
      'combobox',
      /Backspace/,
      'Backspace removes the last chip in multiple mode',
    ],
    [
      'command-palette',
      /\|\s*Key\s*\|/,
      'the keyboard table itself',
    ],
    [
      'command-palette',
      /Esc/,
      'Escape must close the palette (WCAG 2.1.2)',
    ],
    [
      'command-palette',
      /aria-activedescendant/,
      'navigation is virtual; focus never enters the list',
    ],
    [
      'command-palette',
      /⌘K|Ctrl\+K/,
      'the open chord, and that it is opt-in',
    ],
  ];

  for (const [file, needle, why] of REQUIRED_HEADER_FACTS) {
    it(`${file}.tsx header states: ${why}`, () => {
      const source = file === 'combobox' ? COMBOBOX : PALETTE;
      expect(
        needle.test(header(source)),
        `${file}.tsx's JSDoc header no longer documents ${why}. The registry ` +
          `ships this file, not the docs site — a contract that is not in the ` +
          `header is a contract the consumer does not have.`,
      ).toBe(true);
    });
  }

  it('both headers declare MIN_VIEWPORT and both files export it', () => {
    for (const [name, source] of [
      ['combobox', COMBOBOX],
      ['command-palette', PALETTE],
    ] as const) {
      expect(header(source)).toMatch(/## MIN_VIEWPORT — 320/);
      expect(source, `${name}.tsx`).toMatch(
        /export const MIN_VIEWPORT = 320 as const;/,
      );
    }
  });
});

describe('command-palette: composed, not forked', () => {
  it('takes its modal from dialog.tsx, not from @base-ui/react/dialog', () => {
    expect(
      /from '\.\/dialog\.js'/.test(PALETTE),
      'command-palette.tsx no longer imports our Dialog. A palette that ' +
        'builds its own modal grows a second set of focus-trap, backdrop and ' +
        'focus-restore decisions that will drift from dialog.tsx.',
    ).toBe(true);
    expect(
      /@base-ui\/react\/dialog/.test(PALETTE),
      'command-palette.tsx imports Base UI Dialog directly. Go through ' +
        "dialog.tsx so there is one set of overlay decisions, not two.",
    ).toBe(false);
  });

  it('runs the combobox root in `inline` mode with `open` pinned', () => {
    // `inline` is why Escape reaches the Dialog at all: Base UI disables its
    // own `useDismiss` and sets `bubbles: true` for the escape key. Drop it
    // and the combobox swallows Escape for a popup that is not there — the
    // dialog survives, and the user is in a surface they cannot leave from
    // the keyboard (WCAG 2.1.2). It also stops the list portalling into a
    // second layer above the panel.
    //
    // `open` is what wires `aria-controls` from the input to the listbox;
    // Base UI gates that attribute on the root's own open state even though
    // an inline list is always open.
    expect(PALETTE).toMatch(/<BaseCombobox\.Root\s+inline\s+open\b/);
  });

  it('closes itself through a real DialogClose, not a hand-rolled setOpen', () => {
    expect(PALETTE).toMatch(/<DialogClose\s+ref=\{closeRef\}/);
    expect(PALETTE).toMatch(/closeOnSelect/);
  });
});

describe('combobox: the filtering trap stays shut', () => {
  it('ComboboxCompose passes a FUNCTION child to ComboboxList', () => {
    // `items.map(...)` renders every row forever. It is not an error and it
    // looks correct at rest, so it reads as "the filter is broken" rather
    // than as "the wrong child shape".
    // Comments stripped first: the source deliberately NAMES the broken form
    // in a warning comment right above the correct one, and a lock that
    // fires on its own documentation teaches the next reader to delete the
    // documentation.
    const compose = COMBOBOX.slice(COMBOBOX.indexOf('function ComboboxCompose'))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    // Plain string surgery rather than a regex: expressing "optional comment,
    // then a function child" as one pattern needs a quantifier inside a
    // quantifier, which is the polynomial-backtracking shape our own
    // `no-redos-vulnerable-regex` rule flags — correctly.
    const OPEN = '<ComboboxList>';
    const at = compose.indexOf(OPEN);
    expect(at, 'ComboboxCompose no longer renders a ComboboxList').toBeGreaterThan(-1);
    const firstChild = compose.slice(at + OPEN.length).trimStart();
    expect(
      firstChild.startsWith('{('),
      'ComboboxCompose no longer gives ComboboxList a function child. ' +
        'Only the function form is wrapped in a Combobox.Collection, and ' +
        'only a Collection filters.',
    ).toBe(true);
    expect(
      /items\.map\(/.test(compose),
      'ComboboxCompose maps its items array. That renders every row no ' +
        'matter what is typed. Use the function-child form.',
    ).toBe(false);
  });

  it('the header documents the trap, with both forms spelled out', () => {
    const doc = header(COMBOBOX);
    expect(doc).toMatch(/## Filtering/);
    expect(doc).toMatch(/items\.map/);
  });
});

describe('every named part carries a data-slot', () => {
  /**
   * Split the code into top-level `function Name(...)` chunks. Anything that
   * renders DOM must be addressable — `data-slot` is the DS's query of
   * record, used by the render tests, by consumer CSS and by the audit
   * tooling.
   */
  const chunks = (source: string) =>
    source
      .split(/\nfunction /)
      .slice(1)
      .map((chunk) => ({
        name: chunk.slice(0, chunk.indexOf('(')).trim(),
        text: chunk,
      }));

  /** Functions that legitimately render no element of their own. */
  const NO_ELEMENT = new Set([
    // Delegates entirely to the parts above it.
    'ComboboxCompose',
    // A hook — returns void.
    'useCommandPaletteHotkey',
  ]);

  for (const [file, source] of [
    ['combobox.tsx', COMBOBOX],
    ['command-palette.tsx', PALETTE],
  ] as const) {
    it(`${file}`, () => {
      const missing = chunks(source)
        .filter(({ name }) => !NO_ELEMENT.has(name))
        .filter(({ text }) => !text.includes('data-slot='))
        .map(({ name }) => name);
      expect(
        missing,
        `These parts render DOM with no data-slot: ${missing.join(', ')}. ` +
          `data-slot is how every other test, every consumer stylesheet and ` +
          `the audit tooling addresses a part.`,
      ).toEqual([]);
    });
  }
});

describe('target sizes clear the 24px floor (WCAG 2.2 SC 2.5.8)', () => {
  /**
   * Tailwind `size-N` is `N * 0.25rem` = `N * 4px` at the default root size.
   * So the floor of 24px is `size-6`. Checked from source because jsdom
   * reports every box as 0×0 — there is no runtime assertion available in
   * this package, and the class is not overridden anywhere in the DS.
   */
  const MIN_TAILWIND_SIZE = 6;

  const PARTS: ReadonlyArray<
    readonly [file: 'combobox' | 'command-palette', fn: string]
  > = [
    ['combobox', 'ComboboxClear'],
    ['combobox', 'ComboboxTrigger'],
    ['combobox', 'ComboboxChipRemove'],
  ];

  for (const [file, fn] of PARTS) {
    it(`${fn} is at least ${MIN_TAILWIND_SIZE * 4}px square`, () => {
      const source = file === 'combobox' ? COMBOBOX : PALETTE;
      const chunk = source.slice(
        source.indexOf(`function ${fn}`),
        source.indexOf('\n}\n', source.indexOf(`function ${fn}`)),
      );
      // The box class on the part itself, not the `size-3`/`size-4` that
      // sizes the icon inside it — those live behind a `[&_svg…]` selector.
      const box = /(?<!\[&_svg[^\]]*\]:)(?<![\w-])size-(\d+)/.exec(
        chunk.replace(/\[&_svg[^\]]*\]:size-\d+/g, ''),
      );
      expect(box, `${fn} declares no size-* box class`).not.toBeNull();
      expect(
        Number(box![1]),
        `${fn} is size-${box![1]} (${Number(box![1]) * 4}px). SC 2.5.8 ` +
          `requires 24px. Do not shrink the target to match the icon — the ` +
          `icon is not the target.`,
      ).toBeGreaterThanOrEqual(MIN_TAILWIND_SIZE);
    });
  }

  it('list rows are padded to a comfortable row height', () => {
    // `py-2` + a `text-sm` line box ≈ 36px; `py-2.5` ≈ 40px. Both clear 24.
    expect(COMBOBOX).toMatch(/function ComboboxItem[\s\S]*?py-2\b/);
    expect(PALETTE).toMatch(/function CommandPaletteItem[\s\S]*?py-2\.5\b/);
  });
});

describe('the stories that carry the keyboard proof', () => {
  const COMBOBOX_STORY = readFileSync(
    join(STORIES_DIR, 'Combobox.stories.tsx'),
    'utf-8',
  );
  const PALETTE_STORY = readFileSync(
    join(STORIES_DIR, 'CommandPalette.stories.tsx'),
    'utf-8',
  );

  /**
   * `overlay-nav-keyboard-lock` already requires a `play` function and an
   * `{Escape}` press on both. What it cannot know is which keys THESE two
   * surfaces owe — a palette that is never typed into and never arrowed
   * through has not been tested at all.
   */
  const REQUIRED_KEYS = ['{ArrowDown}', '{Enter}', '{Escape}'];

  for (const [name, source] of [
    ['Combobox.stories.tsx', COMBOBOX_STORY],
    ['CommandPalette.stories.tsx', PALETTE_STORY],
  ] as const) {
    it(`${name} drives arrow, Enter and Escape`, () => {
      const missing = REQUIRED_KEYS.filter((key) => !source.includes(key));
      expect(
        missing,
        `${name} never presses ${missing.join(', ')}. axe cannot press a ` +
          `key; the play function is the only proof this surface is usable.`,
      ).toEqual([]);
    });

    it(`${name} asserts the highlight travels via aria-activedescendant`, () => {
      expect(
        source.includes('aria-activedescendant'),
        `${name} does not assert aria-activedescendant. Base UI navigates ` +
          `virtually here — an assertion that document.activeElement becomes ` +
          `an option (correct for Select) would be asserting a bug.`,
      ).toBe(true);
    });
  }
});

describe('the parser can fail', () => {
  // Every assertion above is a regex over a string. A parser that quietly
  // stopped matching would make the whole file pass vacuously.
  it('reads both sources, split into a header and a body', () => {
    expect(header(COMBOBOX).length).toBeGreaterThan(1000);
    expect(header(PALETTE).length).toBeGreaterThan(1000);
    expect(body(COMBOBOX)).toContain('export {');
    expect(body(PALETTE)).toContain('export {');
  });

  it('would flag a header that dropped its keyboard table', () => {
    expect(/\|\s*Key\s*\|/.test('no table here')).toBe(false);
  });

  it('would flag a sub-24px target (negative control)', () => {
    const fake = "className={cn('flex size-5 items-center')}";
    const box = /(?<![\w-])size-(\d+)/.exec(fake);
    expect(Number(box![1])).toBeLessThan(6);
  });
});
