import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type ComponentMetadata,
  extractMetadata,
} from './component-metadata';

/**
 * Server-side helper to load registry-item JSON during page rendering.
 * The build runs `scripts/build-registry.mjs` (prebuild step) to populate
 * `public/r/*.json` from `packages/ui/src/primitives/*.tsx`. Pages read those
 * JSON files to render previews and source.
 */

export type RegistryFile = {
  path: string;
  target: string;
  type: string;
  content: string;
};

/** Published per-item contract facts — see `metaFor` in build-registry.mjs. */
export type RegistryItemMeta = {
  tier: string;
  client: boolean;
  minViewport: number | null;
  /** Declares `loading?: boolean` — the DS-wide skeleton opt-in. */
  loading: boolean;
};

export type RegistryItem = {
  name: string;
  type: string;
  title: string;
  description: string;
  author?: string;
  categories?: string[];
  meta?: RegistryItemMeta;
  docs?: string;
  dependencies?: string[];
  /** Absolute URLs into this registry — resolve with `refToName`. */
  registryDependencies?: string[];
  files: RegistryFile[];
};

export type EnrichedItem = RegistryItem & {
  metadata: ComponentMetadata;
};

export type IndexEntry = Pick<
  RegistryItem,
  'name' | 'type' | 'title' | 'description' | 'categories' | 'meta'
>;

export type RegistryIndex = {
  name: string;
  homepage: string;
  items: IndexEntry[];
};

const HOMEPAGE = 'https://ds.interlace.tools';

/**
 * `registryDependencies` are absolute URLs (a bare name would send the shadcn
 * CLI to ui.shadcn.com). Map one back to a local item name for linking;
 * returns null for a reference into someone else's registry.
 */
export const refToName = (ref: string): string | null => {
  const m = ref.match(/\/r\/([^/]+)\.json$/);
  // Compare the parsed origin, not a string prefix: `startsWith(HOMEPAGE)`
  // also accepts `https://ds.interlace.tools.example.com/r/x.json`.
  let sameOrigin = false;
  try {
    sameOrigin = new URL(ref).origin === new URL(HOMEPAGE).origin;
  } catch {
    sameOrigin = false;
  }
  return m && sameOrigin ? m[1] : null;
};

const PUBLIC_R = join(process.cwd(), 'public', 'r');

export const loadIndex = async (): Promise<RegistryIndex> => {
  const raw = await readFile(join(PUBLIC_R, 'index.json'), 'utf8');
  return JSON.parse(raw) as RegistryIndex;
};

export const loadItem = async (name: string): Promise<RegistryItem | null> => {
  try {
    const raw = await readFile(join(PUBLIC_R, `${name}.json`), 'utf8');
    return JSON.parse(raw) as RegistryItem;
  } catch {
    return null;
  }
};

const INDEX_FILES = new Set(['index.json', 'registry.json']);

export const listItemNames = async (): Promise<string[]> => {
  const entries = await readdir(PUBLIC_R);
  return entries
    // Neither index payload is a registry item — `registry.json` is the name
    // the shadcn CLI resolves (and the directory requires), `index.json` the
    // alias this app reads. Neither has a `files` array, so letting either
    // through crashes the /c/[name] prerender.
    .filter((f) => f.endsWith('.json') && !INDEX_FILES.has(f))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
};

export const loadEnrichedItem = async (
  name: string,
): Promise<EnrichedItem | null> => {
  const item = await loadItem(name);
  if (!item) return null;
  // Every file, not just the first: `button`'s cva lives in the companion
  // `button-variants.ts` that ships alongside it, so reading only files[0]
  // showed the button page no variants at all.
  const content = item.files.map((f) => f.content).join('\n');
  return { ...item, metadata: extractMetadata(content) };
};

