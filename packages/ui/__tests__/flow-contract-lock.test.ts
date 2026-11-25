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
 * 2. Every part has one spelling. A flow only a client component can
 *    compose ships a namespace (`LiveRoom.Lobby`) and no part flat; a flow a
 *    server component can compose ships flat parts (`MultiStepFormStep`)
 *    and no dot aliases, because React cannot dot into a client module
 *    from a server component.
 * 3. Every part's displayName is the name a consumer writes
 *    (`'LiveRoom.Lobby'`, `'MultiStepFormStep'`).
 * 4. Its stories import the flow and walk it whole in one story, `Journey`,
 *    with a `play` function.
 *
 * Hooks (`use*`), models, label and prop types stay flat: they are not parts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');
const SRC = join(REPO_ROOT, 'packages/ui/src');
const STORIES = join(REPO_ROOT, 'apps/storybook/src/stories');

type Flow =
  | { source: string; shape: 'namespace'; name: string; stories: string }
  | { source: string; shape: 'flat'; name: string; parts: readonly string[]; stories: string };

/** Every flow: its source, its shape, its parts and its stories. */
const FLOWS: readonly Flow[] = [
  { source: 'games/live-room.tsx', shape: 'namespace', name: 'LiveRoom', stories: 'games/LiveRoom.stories.tsx' },
  {
    source: 'patterns/multi-step-form.tsx',
    shape: 'flat',
    name: 'MultiStepForm',
    parts: ['MultiStepForm', 'MultiStepFormStep', 'MultiStepFormSummary'],
    stories: 'blocks/MultiStepForm.stories.tsx',
  },
  {
    source: 'patterns/social-sign-in.tsx',
    shape: 'flat',
    name: 'SocialSignIn',
    parts: ['SocialSignIn'],
    stories: 'blocks/SocialSignIn.stories.tsx',
  },
];

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

  describe.each(FLOWS)('$name ($source)', (flow) => {
    const src = read(join(SRC, flow.source));
    const keys: [name: string, component: string][] =
      flow.shape === 'namespace'
        ? parts(src, flow.name).map(([key, component]) => [`${flow.name}.${key}`, component])
        : flow.parts.map((part) => [part, part]);

    it('documents its phases in a ## Flow map', () => {
      expect(header(src)).toMatch(/^ \* ## Flow$/m);
      expect(header(src), 'the map is a table: | Phase | … |').toMatch(/^ \* \| Phase /m);
      for (const [name] of keys) expect(header(src), `the map or anatomy names ${name}`).toContain(name);
    });

    it('gives every part one spelling', () => {
      const exported = valueExports(src);
      if (flow.shape === 'namespace') {
        expect(keys.length, `const ${flow.name} = { Part: Component, … }`).toBeGreaterThan(0);
        expect(exported).toContain(flow.name);
        const components = new Set(keys.map(([, component]) => component));
        const flat = exported.filter(
          (name) => components.has(name) || (/^[A-Z][a-z]/.test(name) && name !== flow.name),
        );
        expect(flat, `Write these as ${flow.name}.<Part> and drop the flat export`).toEqual([]);
      } else {
        for (const part of flow.parts) expect(exported, `export ${part}`).toContain(part);
        expect(src, 'no dot aliases on a flow a server component can compose').not.toMatch(/Object\.assign\(/);
      }
    });

    it.each(keys.length ? keys : [['(none)', '(none)']])(
      '%s has the displayName a consumer writes',
      (name, component) => {
        expect(src).toContain(`${component}.displayName = '${name}';`);
      },
    );

    it('has a Journey story that walks the flow', () => {
      const story = read(join(STORIES, flow.stories));
      expect(story).toMatch(new RegExp(`import \\{[^}]*\\b${flow.name}\\b[^}]*\\} from`));
      const journey = /export const Journey: Story = \{([\s\S]*?)\n\};/.exec(story)?.[1] ?? '';
      expect(journey, 'export const Journey: Story = { render, play }').toMatch(/\bplay:/);
    });
  });
});
