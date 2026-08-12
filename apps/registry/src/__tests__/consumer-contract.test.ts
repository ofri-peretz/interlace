import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectThemeClaims, parseThemeKeys } from '../../token-namespace.mjs';

const R_DIR = path.join(process.cwd(), 'public', 'r');

const loadAll = async () => {
  const names = (
    JSON.parse(await readFile(path.join(R_DIR, 'index.json'), 'utf8')) as {
      items: { name: string }[];
    }
  ).items.map((i) => i.name);
  return Promise.all(
    names.map(async (name) =>
      JSON.parse(await readFile(path.join(R_DIR, `${name}.json`), 'utf8')),
    ),
  );
};

const depNames = (item: { registryDependencies?: string[] }) =>
  new Set(
    (item.registryDependencies ?? []).map((d) =>
      d.split('/').pop()!.replace(/\.json$/, ''),
    ),
  );

/**
 * What an item must satisfy to install into an app that ALREADY has a
 * `components.json` — i.e. every real adopter.
 *
 * That qualifier is the whole point. `shadcn init` writes `lib/utils.ts` as
 * part of scaffolding, so a harness that runs it first cannot observe a
 * missing `cn` dependency; the E2E did exactly that, and 102 items shipped
 * importing `@/lib/utils` while zero of them declared `cn`.
 */
describe('installability into a pre-existing shadcn app', () => {
  it('declares a registry dependency for every lib alias it imports', async () => {
    const items = await loadAll();
    const aliasToItem = new Map<string, string>([
      ['@/lib/utils', 'cn'],
      ['@/hooks/use-reduced-motion', 'use-reduced-motion'],
      ['@/lib/theme-tokens', 'theme-tokens'],
      ['@/hooks/use-theme', 'use-theme'],
      ['@/lib/theme-script', 'theme-script'],
    ]);

    const offenders: string[] = [];
    for (const item of items) {
      const declared = depNames(item);
      const ownTargets = new Set(
        (item.files ?? []).map(
          (f: { target: string }) => `@/${f.target.replace(/\.tsx?$/, '')}`,
        ),
      );
      for (const file of item.files ?? []) {
        for (const [, spec] of (file.content ?? '').matchAll(
          /from\s+['"]([^'"]+)['"]/g,
        )) {
          const dep = aliasToItem.get(spec);
          if (dep && !declared.has(dep) && !ownTargets.has(spec)) {
            offenders.push(`${item.name} imports ${spec} without depending on ${dep}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has cn declared by the many items that use it', async () => {
    // A guard on the guard: if the alias map above ever stopped matching, the
    // test would pass vacuously. `cn` is imported by most of the registry.
    const items = await loadAll();
    const withCn = items.filter((i) => depNames(i).has('cn'));
    expect(withCn.length).toBeGreaterThan(100);
  });
});

/**
 * The version banner is the only mechanism the DS has for telling a consumer
 * which copy of a component they hold, and the prerequisite for any upgrade
 * diff. It has to survive `shadcn add`, which prints its AST with
 * `sourceFile.getText()` — a call that discards ALL leading trivia — after a
 * transform that deletes the `'use client'` statement when `rsc: false`.
 *
 * Net effect: a banner at the top of the file is always lost, and one attached
 * to `'use client'` is lost in the CLI's default configuration. Only a banner
 * after the first import is inside the preserved range.
 */
describe('version banner survives shadcn add', () => {
  it('sits after the first import, never before the first token', async () => {
    const items = await loadAll();
    const misplaced: string[] = [];
    for (const item of items) {
      const file = item.files?.[0];
      if (!file?.content || !file.target?.match(/\.tsx?$/)) continue;
      const bannerAt = file.content.indexOf(`// @interlace/${item.name} v`);
      if (bannerAt === -1) continue;
      const firstImport = file.content.search(/^import\s/m);
      if (firstImport === -1) continue;
      if (bannerAt < firstImport) {
        misplaced.push(`${item.name}: banner precedes the first import`);
      }
    }
    expect(misplaced).toEqual([]);
  });

  it('stamps a banner on every versioned component file', async () => {
    const items = await loadAll();
    const unbannered = items
      .filter(
        (i) =>
          i.meta?.version &&
          i.files?.[0]?.target?.match(/\.tsx?$/) &&
          !new RegExp(`@interlace/${i.name} v`).test(i.files[0].content),
      )
      .map((i) => i.name);
    expect(unbannered).toEqual([]);
  });
});

/**
 * The same dropped range costs far more than the banner.
 *
 * Every source in `packages/ui/src` opens with its own documentation — the
 * `## Anatomy` section (76 files) and the R1–R26 compliance table (90 files)
 * that `src/lib/component-metadata.ts` renders on the component pages. All of
 * it sits before the first token, so `sourceFile.getText()` discarded the lot:
 * `data-state` shipped 14,887 bytes of `content` and arrived as a 9,741-byte
 * file, the 5,146-byte difference being exactly the header.
 *
 * `relocateDocHeader` moves that trivia below the first import in the EMITTED
 * copy only — the sources keep their headers on top, where they read better.
 * The invariant that makes it work is the one locked here: in a published
 * item, NOTHING but a `'use client'` directive may precede the first import.
 */
describe('component documentation survives shadcn add', () => {
  /** Text before the first import — the exact range the CLI throws away. */
  const beforeFirstImport = (content: string) => {
    const at = content.search(/^import\s/m);
    return at === -1 ? null : content.slice(0, at);
  };

  it('leaves no comment above the first import in any emitted file', async () => {
    const items = await loadAll();
    const offenders: string[] = [];
    for (const item of items) {
      for (const file of item.files ?? []) {
        if (!file.content || !file.target?.match(/\.tsx?$/)) continue;
        const head = beforeFirstImport(file.content);
        if (head === null) continue; // no import — covered by the test below
        if (/\/\*|\/\//.test(head)) {
          offenders.push(`${item.name} → ${file.target}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the header somewhere in the file when there is no import', async () => {
    // `lib/theme-tokens.ts` is the only such file. Its header has nowhere safe
    // above to go, so it is appended instead — inside the preserved range.
    const items = await loadAll();
    const tokens = items.find((i) => i.name === 'theme-tokens');
    const content = tokens?.files?.[0]?.content ?? '';
    expect(beforeFirstImport(content)).toBeNull();
    expect(content).toMatch(/@interlace\/ui — the theme contract\./);
  });

  it('still ships the Anatomy and R-rule sources the pages parse', async () => {
    // A guard on the guard: moving the trivia must not drop it. These counts
    // come from the sources, so a relocation that silently ate a header would
    // show up here rather than as an empty component page.
    const items = await loadAll();
    const contentOf = (i: { files?: { content?: string }[] }) =>
      (i.files ?? []).map((f) => f.content ?? '').join('\n');
    const withAnatomy = items.filter((i) => contentOf(i).includes('## Anatomy'));
    const withRRules = items.filter((i) => /\|\s*R\d+\s*\|/.test(contentOf(i)));
    expect(withAnatomy.length).toBeGreaterThan(70);
    expect(withRRules.length).toBeGreaterThan(85);
  });
});

/**
 * The `theme` item must ship the barrel, not just the leaves. It exists
 * because a skipped file "silently degraded half the contract"; withholding it
 * handed every consumer that exact problem, plus a cascade order whose last
 * step (a theme AFTER interlace-theme) is not guessable.
 */
describe('theme item ships the CSS barrel', () => {
  it('includes index.css alongside every leaf it imports', async () => {
    const theme = JSON.parse(await readFile(path.join(R_DIR, 'theme.json'), 'utf8'));
    const targets = theme.files.map((f: { target: string }) => f.target);
    expect(targets).toContain('styles/interlace/index.css');

    const barrel = theme.files.find(
      (f: { target: string }) => f.target === 'styles/interlace/index.css',
    );
    const imported = [...barrel.content.matchAll(/@import\s+["']\.\/([^"']+)["']/g)].map(
      (m) => `styles/interlace/${m[1]}`,
    );
    expect(imported.length).toBeGreaterThan(0);
    // Relative specifiers must resolve where the files actually land.
    for (const spec of imported) expect(targets).toContain(spec);
  });

  it('does not claim a stylesheet count it is not shipping', async () => {
    const theme = JSON.parse(await readFile(path.join(R_DIR, 'theme.json'), 'utf8'));
    // The post-install docs said "Five stylesheets" for an entire release in
    // which the item shipped six.
    expect(theme.docs).toContain(`${theme.files.length} stylesheets`);
    expect(theme.docs).not.toMatch(/\bFive stylesheets\b/);
  });

  it('warns about the token namespace where the CLI will print it', async () => {
    const theme = JSON.parse(await readFile(path.join(R_DIR, 'theme.json'), 'utf8'));
    expect(theme.docs).toContain('--color-accent');
    expect(theme.docs).toContain('@theme inline');
  });
});

describe('token-namespace parser', () => {
  it('ignores declarations nested inside @keyframes', () => {
    const css = `
      @theme inline {
        --color-accent: #fff;
        @keyframes spin {
          from { --not-a-token: 1; transform: rotate(0deg); }
        }
        --color-ring: #000;
      }
    `;
    expect(parseThemeKeys(css).map((k) => k.name)).toEqual([
      '--color-accent',
      '--color-ring',
    ]);
  });

  it('records whether the block was inline', () => {
    expect(parseThemeKeys('@theme { --radius-sm: 1px; }')[0].inline).toBe(false);
    expect(parseThemeKeys('@theme inline { --color-x: red; }')[0].inline).toBe(true);
  });

  it('finds every stylesheet the DS ships', async () => {
    const claims = await collectThemeClaims();
    const files = new Set(claims.map((c: { file: string }) => c.file));
    // The published collision list is only trustworthy if it read the real
    // files — an empty or partial parse would render an empty table.
    expect(files.has('interlace-theme.css')).toBe(true);
    expect(files.has('foundation.css')).toBe(true);
    expect(claims.some((c: { name: string }) => c.name === '--color-accent')).toBe(true);
    expect(claims.some((c: { name: string }) => c.name === '--breakpoint-sm')).toBe(true);
  });

  it('matches the stylesheets on disk, not a copy', async () => {
    const claims = await collectThemeClaims();
    const css = await readFile(
      path.join(process.cwd(), '../../packages/ui/styles/interlace-theme.css'),
      'utf8',
    );
    const direct = parseThemeKeys(css).length;
    expect(
      claims.filter((c: { file: string }) => c.file === 'interlace-theme.css').length,
    ).toBe(direct);
  });

  it('publishes the raw stylesheets it parsed', async () => {
    // `public/r/styles/` is the no-CLI install path; the barrel has to be
    // there too or that path still requires hand-reconstruction.
    const files = await readdir(path.join(R_DIR, 'styles'));
    expect(files).toContain('index.css');
  });
});
