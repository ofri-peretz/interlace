/**
 * Constants shared by every registry script.
 *
 * `HOMEPAGE` in particular is load-bearing: it's the origin baked into each
 * item's `registryDependencies`, so build-registry, validate-registry and
 * e2e-install must all agree on it or the E2E harness silently tests the
 * production registry instead of the local one.
 */
export const HOMEPAGE = 'https://ds.interlace.tools';

/**
 * The origin baked into `registryDependencies` by THIS build.
 *
 * Defaults to production, which is what makes `build-registry.mjs --check`
 * meaningful: the committed artifacts have exactly one correct form, and any
 * deviation is drift.
 *
 * The shadcn CLI cannot resolve a dependency relative to the URL it fetched
 * the parent from — a relative ref is treated as a local filesystem path
 * (`path.resolve` against cwd), not as a URL. So an item served from a branch
 * origin still names production in its dependency list, and installing from a
 * branch build assembles a tree out of two registries at once.
 *
 * There are two ways out, and the registry uses both because they cover
 * different situations:
 *
 *   1. AT SERVE TIME — `src/app/api/r/[...slug]/route.ts` substitutes the
 *      requesting origin on the way out. This is the default and needs nobody
 *      to remember anything: any deploy, preview or local, is self-consistent.
 *
 *   2. AT BUILD TIME — `REGISTRY_ORIGIN` bakes a different origin into the
 *      artifacts themselves. For when the JSON is consumed WITHOUT that server
 *      in front of it: a static file drop, an artifact uploaded to object
 *      storage, an offline mirror.
 *
 * Setting `REGISTRY_ORIGIN` makes `--check` fail by construction (the built
 * items no longer match the committed ones). That is intended: it means
 * "these bytes are a throwaway build for another origin", and CI never sets it.
 */
export const ORIGIN = process.env.REGISTRY_ORIGIN || HOMEPAGE;

export const AUTHOR = 'ofri-peretz <https://github.com/ofri-peretz>';

/** Absolute reference to an item in THIS registry — never a bare name. */
export const itemRef = (name) => `${ORIGIN}/r/${name}.json`;
