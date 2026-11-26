import { describe, expect, it } from 'vitest';

import { summarize, type Result } from '../src/check.js';
import { renderCheck, renderCheckJson } from '../src/render.js';

const r = (file: string, status: Result['status'], extra: Partial<Result> = {}): Result => ({ file, item: 'i', status, allowed: false, ...extra });
const text = (results: Result[], allow: Record<string, string> = {}, strict = false) => {
  const s = summarize(results, allow, strict);
  return renderCheck(s.results, s.summary, { registry: 'https://r.example', strict });
};

describe('renderCheck', () => {
  it('says so when nothing in the project comes from the registry', () => {
    expect(text([])).toBe('No file in this project comes from the Interlace registry.');
  });

  it('is short when everything matches', () => {
    expect(text([r('a.tsx', 'match'), r('b.tsx', 'match')])).toBe('2 files from https://r.example: 2 match, 0 behind, 0 modified, 0 ahead, 0 missing\nNo drift.');
  });

  it('names each file that is not a match, in words, with versions where it has them', () => {
    const out = text([
      r('a.tsx', 'match'),
      r('b.tsx', 'modified'),
      r('c.tsx', 'ahead', { localVersion: '2.0.0', releasedVersion: '1.0.0' }),
      r('d.tsx', 'missing'),
    ]);
    expect(out).toContain('b.tsx  modified locally');
    expect(out).toContain('c.tsx  ahead of any release  (2.0.0, release 1.0.0)');
    expect(out).toContain('d.tsx  missing');
    expect(out).not.toContain('a.tsx  matches');
    expect(out).toContain('Drift in 3 files.');
  });

  it('says one file, not "1 files"', () => {
    expect(text([r('b.tsx', 'modified')])).toContain('Drift in 1 file.');
  });

  it('says a file behind the release is not drift, unless strict', () => {
    expect(text([r('a.tsx', 'behind', { localVersion: '1.0.0', releasedVersion: '1.1.0' })])).toContain('Files behind the release are not drift');
    const strict = text([r('a.tsx', 'behind')], {}, true);
    expect(strict).toContain('Drift in 1 file.');
  });

  it('marks allowed files with their reason, and says when one can be removed from the list', () => {
    const out = text([r('a.tsx', 'match'), r('b.tsx', 'ahead'), r('c.tsx', 'modified')], { 'a.tsx': 'was ahead', 'b.tsx': 'pr 227', 'c.tsx': '' });
    expect(out).toContain('b.tsx  ahead of any release  [allowed: pr 227]');
    expect(out).toContain('c.tsx  modified locally  [allowed]');
    expect(out).toContain('note: a.tsx now matches a release; remove it from the allow list');
    expect(out).toContain('No drift.');
  });
});

describe('renderCheckJson', () => {
  it('is JSON for a machine: ok, counts, the failing files, the stale ones and every result', () => {
    const s = summarize([r('a.tsx', 'match'), r('b.tsx', 'modified')], {}, false);
    const out = renderCheckJson(s.results, s.summary, 'https://r.example');
    expect(out.endsWith('\n')).toBe(true);
    const json = JSON.parse(out);
    expect(json).toMatchObject({
      registry: 'https://r.example',
      ok: false,
      counts: { match: 1, behind: 0, modified: 1, ahead: 0, missing: 0 },
      failing: ['b.tsx'],
      stale: [],
    });
    expect(json.results).toHaveLength(2);
  });
});
