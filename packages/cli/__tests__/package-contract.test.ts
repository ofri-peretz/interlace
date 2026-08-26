/**
 * The `npx interlace-ui` contract.
 *
 * This package exists to be run one way — `npx interlace-ui` — and every part
 * of that string is load-bearing metadata, not code: the npm package NAME is
 * what npx resolves, the `bin` KEY is the command it installs, the `bin` VALUE
 * has to be inside `files` or the published tarball does not contain the thing
 * it points at, and `private` would stop the package existing on npm at all.
 *
 * None of that is exercised by any other test, and all of it fails only for
 * someone who is not us, after publish. So it is asserted here.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DEFAULT_REGISTRY } from '../src/plan.js';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(PKG_ROOT, '../..');

const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')) as {
  name: string;
  private?: boolean;
  type?: string;
  bin?: Record<string, string>;
  files?: string[];
  dependencies?: Record<string, string>;
  publishConfig?: { access?: string };
  engines?: { node?: string };
};

const libTsconfig = JSON.parse(
  fs.readFileSync(path.join(PKG_ROOT, 'tsconfig.lib.json'), 'utf8'),
) as { compilerOptions: { outDir: string; rootDir: string } };

describe('npx interlace-ui', () => {
  // `npx <x>` resolves the npm package named <x>. Rename the package and the
  // documented command silently installs someone else's.
  it('is published under the name npx resolves', () => {
    expect(pkg.name).toBe('interlace-ui');
  });

  it('installs a bin of the same name', () => {
    expect(Object.keys(pkg.bin ?? {})).toEqual(['interlace-ui']);
  });

  it('is publishable', () => {
    expect(pkg.private).toBeUndefined();
    expect(pkg.publishConfig?.access).toBe('public');
  });

  it('ships the file the bin points at', () => {
    const target = pkg.bin!['interlace-ui']!;
    const topLevel = target.replace(/^\.\//, '').split('/')[0];
    expect(pkg.files).toContain(topLevel);
  });

  // Verified without requiring a build, so the check cannot be skipped by
  // running the suite on a clean tree: the bin path is DERIVED from the same
  // tsconfig that produces it, which is what a rename of src/index.ts breaks.
  it('points at the artifact this package actually builds', () => {
    const { outDir, rootDir } = libTsconfig.compilerOptions;
    const entry = path.join(PKG_ROOT, rootDir, 'index.ts');
    expect(fs.existsSync(entry), `${rootDir}/index.ts is the bin entry and must exist`).toBe(true);
    expect(pkg.bin!['interlace-ui']).toBe(`${outDir}/index.js`);
  });

  it('when built, the bin is present and executable', () => {
    const target = path.join(PKG_ROOT, pkg.bin!['interlace-ui']!);
    if (!fs.existsSync(target)) return; // unbuilt tree; the derivation above holds the line
    expect(fs.statSync(target).mode & 0o111).toBeGreaterThan(0);
  });

  // `npx` downloads the whole dependency tree before it runs anything. Every
  // runtime dependency is latency a first-time user pays at the exact moment
  // they are deciding whether this registry is worth adopting — and the CLI
  // needs nothing that node: does not already provide.
  it('has no runtime dependencies', () => {
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
  });

  it('declares ESM and an engines floor that has node:util parseArgs', () => {
    expect(pkg.type).toBe('module');
    expect(pkg.engines?.node).toBe('>=20.11');
  });
});

describe('release contract', () => {
  /**
   * This package introduces `npm publish` to a repo that deliberately had none.
   * The risk that creates is not that the CLI ships — it is that the DESIGN
   * SYSTEM follows it onto npm, which VERSIONING_PHILOSOPHY § 2 rules out:
   * publishing the components would create a second distribution channel with
   * a different upgrade model for the same files.
   *
   * So the boundary is asserted from the side that just moved.
   */
  it('publishes the CLI and still refuses to publish the design system', () => {
    const ui = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'packages/ui/package.json'), 'utf8'),
    ) as { private?: boolean };

    expect(pkg.private).toBeUndefined();
    expect(ui.private).toBe(true);
  });

  it('the release script covers both packages', () => {
    const root = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    // ui is tagged, the CLI is published; dropping either half is silent.
    expect(root.scripts.release).toContain('release-tag.mjs');
    expect(root.scripts.release).toContain('release-cli.mjs');
    for (const s of ['scripts/release-tag.mjs', 'scripts/release-cli.mjs']) {
      expect(fs.existsSync(path.join(REPO_ROOT, s)), `${s} is missing`).toBe(true);
    }
  });
});

describe('registry origin', () => {
  /**
   * The CLI's default origin and the registry build's `HOMEPAGE` are the same
   * fact stored twice — they must be, because the CLI is published and cannot
   * import from `apps/registry`. Two copies of one constant is exactly the
   * shape that drifts, and the failure is silent: the CLI would keep installing
   * happily from an origin the registry no longer publishes to.
   */
  it('matches the origin the registry is built for', async () => {
    const config = (await import(
      path.join(REPO_ROOT, 'apps/registry/registry.config.mjs')
    )) as { HOMEPAGE: string };
    expect(DEFAULT_REGISTRY).toBe(config.HOMEPAGE);
  });
});
