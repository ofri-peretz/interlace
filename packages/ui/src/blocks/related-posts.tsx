/**
 * @deprecated since 1.0.0 — removed in 2.0.0. Use
 * `@interlace/ui/patterns/related-posts`. Moved as part of the
 * 5-layer DS architecture (Phase 1). This alias is a one-line re-export so
 * existing consumers (`import { ... } from '@interlace/ui/blocks/related-posts'`)
 * keep working; new code should import from the patterns/ path.
 *
 * A deprecation with no removal release is a permanent one, so this names
 * a real version: the alias disappears in `@interlace/ui` 2.0.0, as a
 * breaking change with a migration note. See
 * `docs/philosophies/VERSIONING_PHILOSOPHY.md`.
 */
export * from '../patterns/related-posts.js';
