import { describe, expect, it } from 'vitest';

import { refToName } from '@/lib/registry';

/**
 * `refToName` decides whether a `registryDependencies` URL points back at OUR
 * registry (link it locally) or at someone else's (leave it external). It used
 * to answer that with `ref.startsWith('https://ds.interlace.tools')`, which a
 * lookalike host defeats — `https://ds.interlace.tools.example.com/r/x.json`
 * shares the prefix but not the origin (CodeQL js/incomplete-url-substring-
 * sanitization). These lock the origin comparison that replaced it.
 */
describe('refToName origin check', () => {
  it.each([
    ['https://ds.interlace.tools/r/button.json', 'button'],
    ['https://ds.interlace.tools/r/tag-list.json', 'tag-list'],
  ])('resolves %s to a local item', (ref, expected) => {
    expect(refToName(ref)).toBe(expected);
  });

  it.each([
    // A different registry entirely.
    ['https://ui.shadcn.com/r/button.json'],
    // Lookalike host — shares the prefix, different origin.
    ['https://ds.interlace.tools.example.com/r/button.json'],
    // Our host appearing in a query string, not as the origin.
    ['https://example.com/?u=https://ds.interlace.tools/r/button.json'],
    // Scheme downgrade — same host, different origin.
    ['http://ds.interlace.tools/r/button.json'],
    // Not a URL at all.
    ['not-a-url'],
    ['/r/button.json'],
  ])('refuses %s', (ref) => {
    expect(refToName(ref)).toBeNull();
  });
});
