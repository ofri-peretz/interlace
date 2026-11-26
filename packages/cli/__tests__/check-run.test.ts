/**
 * `interlace-ui check`, run: a real registry on a local port, a real project in a temp directory.
 * What is asserted is the exit code and what is printed, which is what CI and an agent read.
 */
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { run } from '../src/index.js';

const banner = (name: string, v: string) => `// @interlace/${name} v${v} — Interlace design system.\n`;
const BUTTON = `${banner('button', '3.4.0')}export const button = 1;\n`;
const CARD = `${banner('card', '1.0.0')}export const card = 1;\n`;

const ITEMS: Record<string, unknown> = {
  button: {
    name: 'button',
    meta: { version: '3.4.0' },
    files: [
      { target: 'components/ui/button.tsx', content: BUTTON },
      { target: 'components/ui/button-variants.ts', content: 'export const variants = 1;\n' },
    ],
  },
  card: { name: 'card', meta: { version: '1.0.0' }, files: [{ target: 'components/ui/card.tsx', content: CARD }] },
};

let server: http.Server;
let registry: string;
let missingItem = false;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const name = (req.url ?? '').replace('/r/', '').replace('.json', '');
    const body = name === 'index' ? { items: Object.keys(ITEMS).map((n) => ({ name: n })).concat(missingItem ? [{ name: 'gone' }] : []) } : ITEMS[name];
    if (!body) {
      res.statusCode = 404;
      res.end('{}');
      return;
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  registry = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => void server.close());

let dir: string;
let out: string;
let err: string;

beforeEach(() => {
  missingItem = false;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'interlace-check-'));
  fs.writeFileSync(path.join(dir, 'components.json'), JSON.stringify({ aliases: { ui: '@/components/ui' } }));
  out = '';
  err = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => ((out += String(chunk)), true));
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => ((err += String(chunk)), true));
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

const put = (rel: string, content: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), content);
};
const check = (...args: string[]) => run(['check', '--registry', registry, '--cwd', dir, ...args]);
const clean = () => {
  put('components/ui/button.tsx', BUTTON);
  put('components/ui/button-variants.ts', 'export const variants = 1;\n');
};

describe('check', () => {
  it('exits 0 and says no drift when every file is a release', async () => {
    clean();
    put('components/ui/card.tsx', CARD);
    expect(await check()).toBe(0);
    expect(out).toContain('3 files from');
    expect(out).toContain('3 match');
    expect(out).toContain('No drift.');
  });

  it('exits 0 for a project with no Interlace file in it', async () => {
    expect(await check()).toBe(0);
    expect(out).toContain('No file in this project comes from the Interlace registry.');
  });

  it('treats a file with Windows line endings as a match', async () => {
    put('components/ui/button.tsx', BUTTON.replace(/\n/g, '\r\n'));
    put('components/ui/button-variants.ts', 'export const variants = 1;\r\n');
    expect(await check()).toBe(0);
  });

  it('exits 1 for a file edited after it was copied, and names it', async () => {
    clean();
    put('components/ui/button.tsx', `${BUTTON}// mine\n`);
    expect(await check()).toBe(1);
    expect(out).toContain('components/ui/button.tsx  modified locally');
    expect(out).toContain('Drift in 1 file.');
  });

  it('exits 1 for a file of an installed component that is not there', async () => {
    put('components/ui/button.tsx', BUTTON);
    expect(await check()).toBe(1);
    expect(out).toContain('components/ui/button-variants.ts  missing');
  });

  it('exits 1 for a file copied from something newer than the release', async () => {
    clean();
    put('components/ui/button.tsx', `${banner('button', '3.5.0')}export const button = 2;\n`);
    expect(await check()).toBe(1);
    expect(out).toContain('ahead of any release  (3.5.0, release 3.4.0)');
  });

  it('exits 0 for a file behind the release, and 1 with --strict', async () => {
    clean();
    put('components/ui/button.tsx', `${banner('button', '3.3.0')}export const button = 0;\n`);
    expect(await check()).toBe(0);
    expect(out).toContain('behind the release');
    out = '';
    expect(await check('--strict')).toBe(1);
  });

  it('finds files under src, and where components.json says they live', async () => {
    put('src/components/ui/card.tsx', CARD);
    expect(await check()).toBe(0);
    expect(out).toContain('1 files from');
    fs.writeFileSync(path.join(dir, 'components.json'), JSON.stringify({ aliases: { ui: '@/shared/ui' } }));
    fs.rmSync(path.join(dir, 'src'), { recursive: true });
    put('shared/ui/card.tsx', CARD);
    out = '';
    expect(await check()).toBe(0);
    expect(out).toContain('1 files from');
  });

  it('checks only the items it is asked for', async () => {
    put('components/ui/button.tsx', `${BUTTON}// mine\n`);
    put('components/ui/card.tsx', CARD);
    expect(await check('--item', 'card')).toBe(0);
    expect(await check('--item', 'button')).toBe(1);
  });

  describe('the allow list', () => {
    it('--allow lets a file differ without failing, and the report says so', async () => {
      clean();
      put('components/ui/button.tsx', `${BUTTON}// mine\n`);
      expect(await check('--allow', 'components/ui/button.tsx')).toBe(0);
      expect(out).toContain('[allowed]');
    });

    it('reads .interlace-check.json from the project, with reasons', async () => {
      clean();
      put('components/ui/button.tsx', `${BUTTON}// mine\n`);
      put('.interlace-check.json', JSON.stringify({ allow: { 'components/ui/button.tsx': 'pr 227' } }));
      expect(await check()).toBe(0);
      expect(out).toContain('[allowed: pr 227]');
    });

    it('reads a list from --config, and says when an allowed file is a release again', async () => {
      clean();
      put('ok.json', JSON.stringify({ allow: ['components/ui/button.tsx'] }));
      expect(await check('--config', 'ok.json')).toBe(0);
      expect(out).toContain('note: components/ui/button.tsx now matches a release; remove it from the allow list');
    });

    it('exits 2 for a list it cannot read', async () => {
      put('.interlace-check.json', '{nope');
      expect(await check()).toBe(2);
      expect(err).toContain('could not read the allow list');
      err = '';
      expect(await check('--config', 'missing.json')).toBe(2);
      expect(err).toContain('could not read the allow list');
    });
  });

  describe('--json', () => {
    it('prints one JSON document with ok, counts, failing and every result', async () => {
      clean();
      put('components/ui/button.tsx', `${BUTTON}// mine\n`);
      expect(await check('--json')).toBe(1);
      const json = JSON.parse(out);
      expect(json).toMatchObject({ ok: false, registry, failing: ['components/ui/button.tsx'], counts: { match: 1, modified: 1 } });
      expect(json.results[0]).toMatchObject({ file: 'components/ui/button-variants.ts', item: 'button', status: 'match', allowed: false });
    });

    it('is ok: true when clean', async () => {
      clean();
      expect(await check('--json')).toBe(0);
      expect(JSON.parse(out).ok).toBe(true);
    });
  });

  describe('when it cannot check, it exits 2 and says why', () => {
    it('no components.json', async () => {
      fs.rmSync(path.join(dir, 'components.json'));
      expect(await check()).toBe(2);
      expect(err).toContain('no components.json');
    });

    it('components.json that is not JSON', async () => {
      fs.writeFileSync(path.join(dir, 'components.json'), '{nope');
      expect(await check()).toBe(2);
      expect(err).toContain('not valid JSON');
    });

    it('a components.json with no aliases still works', async () => {
      fs.writeFileSync(path.join(dir, 'components.json'), '{}');
      clean();
      expect(await check('--item', 'button')).toBe(0);
    });

    it('a registry that cannot be reached', async () => {
      expect(await run(['check', '--registry', 'http://127.0.0.1:1', '--cwd', dir])).toBe(2);
      expect(err).toContain('could not read the registry');
    });

    it('an item the index lists but the registry does not have', async () => {
      missingItem = true;
      expect(await check()).toBe(2);
      expect(err).toContain('/r/gone.json responded 404');
    });
  });
});
