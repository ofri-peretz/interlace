import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ORIGIN, HOMEPAGE } from '../../registry.config.mjs';
import { originOf, withRequestOrigin } from '../app/api/r/[...slug]/route';

const R_DIR = path.join(process.cwd(), 'public', 'r');

/**
 * The origin contract.
 *
 * A registry item's `registryDependencies` must be absolute URLs — the shadcn
 * CLI has no way to resolve a dependency relative to the URL it fetched the
 * parent from (a relative ref is treated as a local filesystem path). So the
 * committed artifacts name production, and the SERVER is what makes a branch
 * build self-consistent.
 *
 * The failure this locks: serving the committed artifacts from a branch origin
 * without rewriting means the item comes from the branch and every transitive
 * dependency comes from production. Both halves report success; the resulting
 * tree does not compile. `stat-strip` from a local origin pulled production
 * `data-state` — which exports `DataState` where the branch exports
 * `DataStateBadge`.
 */
describe('registry origin rewriting', () => {
  describe('originOf — the origin the CLI actually used', () => {
    it('prefers the forwarded host over the bound one', () => {
      // On Vercel the URL a function sees is internal. Trusting it would bake
      // the wrong host into every dependency — the same bug, one layer down.
      const headers = new Headers({
        host: 'internal-fn.vercel.internal',
        'x-forwarded-host': 'ds-git-branch.vercel.app',
        'x-forwarded-proto': 'https',
      });
      expect(originOf(headers, 'http://127.0.0.1:3000/r/button.json')).toBe(
        'https://ds-git-branch.vercel.app',
      );
    });

    it('takes the first proto when a proxy chain appends more', () => {
      const headers = new Headers({
        host: 'ds-preview.example.com',
        'x-forwarded-proto': 'https,http',
      });
      expect(originOf(headers, 'http://x/r/a.json')).toBe(
        'https://ds-preview.example.com',
      );
    });

    it.each([
      ['localhost:4178', 'http://localhost:4178'],
      ['127.0.0.1:4178', 'http://127.0.0.1:4178'],
      ['[::1]:4178', 'http://[::1]:4178'],
    ])('defaults %s to http, not https', (host, expected) => {
      expect(originOf(new Headers({ host }), 'http://x/r/a.json')).toBe(expected);
    });

    it('defaults a real host to https', () => {
      expect(
        originOf(new Headers({ host: 'ds.interlace.tools' }), 'http://x/r/a.json'),
      ).toBe('https://ds.interlace.tools');
    });

    it('falls back to the request URL when there is no Host header', () => {
      expect(originOf(new Headers(), 'http://127.0.0.1:9999/r/a.json')).toBe(
        'http://127.0.0.1:9999',
      );
    });
  });

  describe('withRequestOrigin', () => {
    it('repoints every dependency of the item from the original report', async () => {
      // `stat-strip` is the reproducer: branch stat-strip + production
      // data-state is a tree that does not compile, from an install that
      // reported success.
      const body = await readFile(path.join(R_DIR, 'stat-strip.json'), 'utf8');
      const before = JSON.parse(body).registryDependencies as string[];
      expect(before.length).toBeGreaterThan(1);

      const after = JSON.parse(
        withRequestOrigin(body, 'http://127.0.0.1:4178'),
      ) as { registryDependencies: string[] };
      expect(after.registryDependencies).toEqual(
        before.map((d) => d.replace(ORIGIN, 'http://127.0.0.1:4178')),
      );
      for (const dep of after.registryDependencies) {
        expect(dep.startsWith('http://127.0.0.1:4178/r/')).toBe(true);
      }
    });

    it('leaves docs links and the version banner canonical', async () => {
      // A blanket string replace also rewrites the `docs` string and the
      // banner inside `files[].content`, so a file installed from a preview
      // would point at a URL that stops existing when the branch merges.
      const body = await readFile(path.join(R_DIR, 'button.json'), 'utf8');
      const after = JSON.parse(withRequestOrigin(body, 'http://127.0.0.1:4178'));
      expect(after.docs).toContain(HOMEPAGE);
      expect(after.files[0].content).toContain(`${HOMEPAGE}/c/button`);
      expect(after.files[0].content).not.toContain('127.0.0.1');
    });

    it('does not touch a dependency pointing at another registry', () => {
      const body = JSON.stringify({
        registryDependencies: [
          `${ORIGIN}/r/theme.json`,
          'https://ui.shadcn.com/r/button.json',
          // Lookalike host — shares the prefix, different origin.
          'https://ds.interlace.tools.example.com/r/x.json',
        ],
      });
      const after = JSON.parse(withRequestOrigin(body, 'https://preview.test'));
      expect(after.registryDependencies).toEqual([
        'https://preview.test/r/theme.json',
        'https://ui.shadcn.com/r/button.json',
        'https://ds.interlace.tools.example.com/r/x.json',
      ]);
    });

    it('is a no-op when the request origin is the baked one', async () => {
      const body = await readFile(path.join(R_DIR, 'button.json'), 'utf8');
      expect(withRequestOrigin(body, ORIGIN)).toBe(body);
    });

    it('returns unparseable bodies untouched', () => {
      expect(withRequestOrigin('not json', 'https://preview.test')).toBe('not json');
    });
  });

  describe('the artifacts the route rewrites', () => {

    it('defaults ORIGIN to the production homepage', () => {
      // `REGISTRY_ORIGIN` is the offline escape hatch. If it leaked into a
      // normal build the drift gate would fail — this states the default.
      expect(ORIGIN).toBe(HOMEPAGE);
    });

    it('leaves no bare or relative registryDependency anywhere', async () => {
      // A relative ref would be read off the consumer's DISK by the CLI, not
      // fetched; a bare name resolves against shadcn's own registry.
      const names = (
        JSON.parse(await readFile(path.join(R_DIR, 'index.json'), 'utf8')) as {
          items: { name: string }[];
        }
      ).items.map((i) => i.name);
      const offenders: string[] = [];
      for (const name of names) {
        const item = JSON.parse(
          await readFile(path.join(R_DIR, `${name}.json`), 'utf8'),
        );
        for (const dep of item.registryDependencies ?? []) {
          if (!dep.startsWith('http')) offenders.push(`${name} → ${dep}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  });
});
