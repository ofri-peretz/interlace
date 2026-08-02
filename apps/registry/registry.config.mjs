/**
 * Constants shared by every registry script.
 *
 * `HOMEPAGE` in particular is load-bearing: it's the origin baked into each
 * item's `registryDependencies`, so build-registry, validate-registry and
 * e2e-install must all agree on it or the E2E harness silently tests the
 * production registry instead of the local one.
 */
export const HOMEPAGE = 'https://ds.interlace.tools';

export const AUTHOR = 'ofri-peretz <https://github.com/ofri-peretz>';

/** Absolute reference to an item in THIS registry — never a bare name. */
export const itemRef = (name) => `${HOMEPAGE}/r/${name}.json`;
