import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  COVERAGE,
  DATA_STATES,
  MATRIX,
  behaviorFor,
  hasBehavior,
} from '@/lib/behavior';
import { extractPropsTables } from '@/lib/component-metadata';

/**
 * The Behavior section is the site's differentiation claim: none of the nine
 * registries benchmarked in DESIGN-SYSTEM-PLAN.md §5.x publishes a keyboard
 * path, a measured contrast table, an sr-only data equivalent or a coverage
 * number. A claim like that is only worth making if it cannot rot, so this
 * suite asserts the generated map against the real sources rather than against
 * a snapshot of itself.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTRY_ROOT = join(HERE, '../..');
const REPO_ROOT = join(REGISTRY_ROOT, '../..');

const behaviorMap = JSON.parse(
  await readFile(join(REGISTRY_ROOT, 'public/data/behavior-map.json'), 'utf8'),
) as {
  components: Record<string, ReturnType<typeof behaviorFor>>;
  sources: Record<string, string | string[]>;
};

const storyMap = JSON.parse(
  await readFile(join(REGISTRY_ROOT, 'public/data/story-map.json'), 'utf8'),
) as Record<string, { storyIds: string[] }>;

const entries = Object.entries(behaviorMap.components).filter(
  (entry): entry is [string, NonNullable<ReturnType<typeof behaviorFor>>] =>
    entry[1] !== null,
);

const exists = async (path: string) => {
  try {
    await access(join(REPO_ROOT, path));
    return true;
  } catch {
    return false;
  }
};

describe('behavior map', () => {
  it('covers the registry', () => {
    expect(entries.length).toBeGreaterThan(100);
  });

  it('cites source files that exist', async () => {
    const cited = [
      behaviorMap.sources.keyboardLock,
      behaviorMap.sources.contrast,
      behaviorMap.sources.dataStates,
      behaviorMap.sources.coverage,
      ...(behaviorMap.sources.themes as string[]),
    ] as string[];
    for (const path of cited) {
      expect(await exists(path), `${path} is cited but missing`).toBe(true);
    }
  });

  it('resolves every component source path to a real file', async () => {
    for (const [name, behavior] of entries) {
      if (!behavior.sourcePath) continue;
      expect(
        await exists(behavior.sourcePath),
        `${name} → ${behavior.sourcePath} does not exist; the page links to it as the source of truth`,
      ).toBe(true);
    }
  });

  describe('keyboard paths', () => {
    const withKeyboard = entries.filter(([, b]) => b.keyboard);

    it('exist for the overlay + nav primitives', () => {
      const names = withKeyboard.map(([name]) => name);
      for (const required of [
        'dialog',
        'select',
        'dropdown-menu',
        'context-menu',
        'tabs',
        'popover',
        'sheet',
      ]) {
        expect(names, `${required} lost its published keyboard path`).toContain(
          required,
        );
      }
    });

    it('point at a story that exists, and press at least one key', () => {
      for (const [name, behavior] of withKeyboard) {
        const path = behavior.keyboard!;
        expect(
          storyMap[name]?.storyIds ?? [],
          `${name} publishes story ${path.storyId}, which is not in story-map.json`,
        ).toContain(path.storyId);

        const keys = path.steps.reduce((n, s) => n + s.keys.length, 0);
        expect(
          keys,
          `${name} publishes a "keyboard path" that presses nothing — that is an interaction script, not a keyboard path`,
        ).toBeGreaterThan(0);
        for (const step of path.steps) {
          expect(step.title.trim()).not.toBe('');
        }
      }
    });

    it('locks Escape where the lock actually runs it', () => {
      const locked = withKeyboard
        .filter(([, b]) => b.keyboard!.escapeLocked)
        .map(([name]) => name);
      expect(locked).toContain('dialog');
      expect(locked).toContain('popover');
      // `MUST_ASSERT_ESCAPE` also names ThemeSwitcher, which is NOT in
      // `KEYBOARD_DRIVEN` — the lock's loop never reaches it. Publishing it
      // would claim a gate that does not run.
      expect(locked).not.toContain('theme-switcher');
    });
  });

  describe('measured contrast', () => {
    it('measures every pair in every theme × scheme', () => {
      expect(MATRIX.length).toBeGreaterThanOrEqual(4);
      for (const [name, behavior] of entries) {
        for (const row of behavior.contrast) {
          expect(
            row.ratios,
            `${name}: ${row.fg} on ${row.bg} is half-measured`,
          ).toHaveLength(MATRIX.length);
          expect(row.worst).toBe(Math.min(...row.ratios));
        }
      }
    });

    it('never publishes a pair below its WCAG floor', () => {
      const failures = entries.flatMap(([name, behavior]) =>
        behavior.contrast
          .filter((row) => !row.passes)
          .map(
            (row) =>
              `${name}: ${row.fg} on ${row.bg} = ${row.worst}:1 (floor ${row.floor}:1)`,
          ),
      );
      expect(failures).toEqual([]);
    });

    it('orders rows tightest-first', () => {
      for (const [name, behavior] of entries) {
        const worsts = behavior.contrast.map((row) => row.worst);
        expect(
          [...worsts].sort((a, b) => a - b),
          `${name}'s contrast table buries its tightest pair`,
        ).toEqual(worsts);
      }
    });
  });

  describe('state union', () => {
    it('matches the model', () => {
      const names = DATA_STATES.map((s) => s.name);
      expect(names).toContain('not-counted');
      expect(names).toContain('truncated');
      expect(names).toContain('first-measurement');
      for (const [name, behavior] of entries) {
        for (const state of behavior.states) {
          expect(names, `${name} publishes unknown state ${state}`).toContain(
            state,
          );
        }
      }
    });

    it('is published for the components that consume it', () => {
      for (const name of ['data-state', 'meter', 'stat-strip']) {
        expect(behaviorFor(name)?.states.length ?? 0).toBe(DATA_STATES.length);
      }
    });
  });

  describe('coverage', () => {
    it('publishes the glob next to the number', () => {
      expect(Object.values(COVERAGE.thresholds)).toEqual([100, 100, 100, 100]);
      // The claim is "100% over these directories", never a bare "100%".
      expect(COVERAGE.include.length).toBeGreaterThan(0);
      expect(COVERAGE.include.join(' ')).toContain('src/charts/');
    });

    it('marks charts in the gate and primitives out of it', () => {
      expect(behaviorFor('time-series')?.coverage.inGate).toBe(true);
      expect(behaviorFor('dialog')?.coverage.inGate).toBe(false);
    });
  });

  it('renders no Behavior heading for items with nothing to say', () => {
    // A "Behavior" section over four empty cells teaches the reader the
    // section is decorative.
    expect(hasBehavior(behaviorFor('cn'))).toBe(false);
    expect(hasBehavior(behaviorFor('dialog'))).toBe(true);
  });
});

describe('API reference', () => {
  const sourceOf = async (name: string) => {
    const item = JSON.parse(
      await readFile(join(REGISTRY_ROOT, 'public/r', `${name}.json`), 'utf8'),
    ) as { files: { content: string }[] };
    return item.files.map((f) => f.content).join('\n');
  };

  /**
   * These six rendered NO API table at all before the inline-signature pass:
   * they type themselves in the parameter list rather than in a `<Name>Props`
   * declaration, which the first parser did not look for. Four of the nine
   * benchmarked registries have no props table anywhere — shipping empty ones
   * would put us in that bucket by accident.
   */
  it.each(['select', 'tabs', 'checkbox', 'switch', 'input', 'accordion'])(
    '%s has a props table',
    async (name) => {
      const tables = extractPropsTables(await sourceOf(name));
      expect(tables.length).toBeGreaterThan(0);
      expect(
        tables.some(
          (t) => t.props.length > 0 || t.extendsElement || t.extendsComponent,
        ),
      ).toBe(true);
    },
  );

  it('names the Base UI part a thin skin passes through to', async () => {
    const tables = extractPropsTables(await sourceOf('select'));
    const trigger = tables.find((t) => t.typeName === 'SelectTrigger');
    expect(trigger?.extendsComponent).toBe('Select.Trigger');
    expect(trigger?.props.find((p) => p.name === 'size')?.defaultValue).toBe(
      "'default'",
    );
  });

  it('keeps declared props types winning over signatures', async () => {
    // `badge` declares `BadgeProps`; it must not sprout a second table per
    // sub-component and bury the real one.
    const tables = extractPropsTables(await sourceOf('badge'));
    expect(tables.map((t) => t.typeName)).toContain('BadgeProps');
  });
});
