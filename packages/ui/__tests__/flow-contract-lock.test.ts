/**
 * Flow contract lock.
 *
 * A flow is a surface an app adopts whole: phases, several parts, and the
 * waiting, empty and error states between them (the live room, a booking,
 * a sign-in). docs/philosophies/FLOW_PHILOSOPHY.md is the standard; this
 * lock holds the parts of it a parser can see:
 *
 * 1. The header carries a `## Flow` map: every phase, the part that shows
 *    it, and what moves it on. That map is the flow's documentation.
 * 2. The flow ships one namespace (`LiveRoom.Lobby`, `LiveRoom.Countdown`).
 *    No part is also exported flat, so there is one way to write it.
 * 3. Every part's displayName is the name a consumer writes
 *    (`'LiveRoom.Lobby'`), so devtools and Storybook show what they typed.
 * 4. Its stories import the namespace and walk the whole flow in one story,
 *    `Journey`, with a `play` function.
 *
 * Hooks (`use*`), models, label and prop types stay flat: they are not parts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');
const SRC = join(REPO_ROOT, 'packages/ui/src');
const STORIES = join(REPO_ROOT, 'apps/storybook/src/stories');

/** Every flow: its source, its namespace and its stories. */
const FLOWS = [
  { source: 'games/live-room.tsx', namespace: 'LiveRoom', stories: 'games/LiveRoom.stories.tsx' },
] as const;

const read = (path: string) => readFileSync(path, 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

/** The header comment: everything before the first import. */
const header = (src: string) => src.slice(0, src.search(/^import /m));

/** `Key: Component` pairs of `const <namespace> = { … }`. */
function parts(src: string, namespace: string): [key: string, component: string][] {
  const body = new RegExp(`const ${namespace} = \\{([^}]*)\\}`).exec(src)?.[1] ?? '';
  return [...body.matchAll(/(\w+):\s*(\w+)/g)].map((m) => [m[1]!, m[2]!]);
}

/** Every name a file exports by value. */
function valueExports(src: string): string[] {
  const listed = [...src.matchAll(/^export \{([^}]*)\}/gm)].flatMap((m) =>
    m[1]!.split(',').map((n) => n.trim().split(/\s+as\s+/).pop()!).filter(Boolean),
  );
  const declared = [...src.matchAll(/^export (?:const|function|class) (\w+)/gm)].map((m) => m[1]!);
  return [...listed, ...declared];
}

describe('flow contract', () => {
  it('every file with a ## Flow map is a registered flow', () => {
    const registered = new Set(FLOWS.map((f) => f.source));
    const unregistered = walk(SRC)
      .filter((path) => /^ \* ## Flow$/m.test(header(read(path))))
      .map((path) => relative(SRC, path))
      .filter((path) => !registered.has(path));
    expect(unregistered, `Add these to FLOWS in this lock:\n${unregistered.join('\n')}`).toEqual([]);
  });

  describe.each(FLOWS)('$namespace ($source)', ({ source, namespace, stories }) => {
    const src = read(join(SRC, source));
    const keys = parts(src, namespace);

    it('documents its phases in a ## Flow map', () => {
      expect(header(src)).toMatch(/^ \* ## Flow$/m);
      expect(header(src), 'the map is a table: | Phase | … |').toMatch(/^ \* \| Phase /m);
    });

    it('exports one namespace with its parts', () => {
      expect(keys.length, `const ${namespace} = { Part: Component, … }`).toBeGreaterThan(0);
      expect(valueExports(src)).toContain(namespace);
    });

    it('exports no part flat beside the namespace', () => {
      const components = new Set(keys.map(([, component]) => component));
      const flat = valueExports(src).filter(
        (name) => components.has(name) || (/^[A-Z][a-z]/.test(name) && name !== namespace),
      );
      expect(flat, `Write these as ${namespace}.<Part> and drop the flat export`).toEqual([]);
    });

    it.each(keys.length ? keys : [['(none)', '(none)']])(
      '%s has the displayName a consumer writes',
      (key, component) => {
        expect(src).toContain(`${component}.displayName = '${namespace}.${key}';`);
      },
    );

    it('has a Journey story that walks the flow', () => {
      const story = read(join(STORIES, stories));
      expect(story).toMatch(new RegExp(`import \\{[^}]*\\b${namespace}\\b[^}]*\\} from`));
      const journey = /export const Journey: Story = \{([\s\S]*?)\n\};/.exec(story)?.[1] ?? '';
      expect(journey, 'export const Journey: Story = { render, play }').toMatch(/\bplay:/);
    });
  });
});
