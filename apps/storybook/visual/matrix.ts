import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The guard-rail matrix: which stories, in which reading conditions.
 *
 * Shared by `matrix.spec.ts` (pixels) and `a11y-matrix.spec.ts` (axe, reflow,
 * focus), so both gates walk the same ground.
 *
 * Stories are DISCOVERED from the built Storybook's `index.json`, never
 * listed here: a component added tonight is covered tonight. One story per
 * stories file, the first one, which by convention is the component's
 * default. Opt a whole file out with the `no-visual` tag on its meta, and say
 * why in a comment next to the tag (a live clock, a video, a WebGL canvas).
 */

export type Mode = {
  /** Folder name for baselines and part of the test title. */
  name: string;
  viewport: { width: number; height: number };
  /** Storybook globals, as the `globals=` URL parameter spells them. */
  globals: Record<string, string>;
  /** Reference pages (tokens, contracts) are shot in this mode too. */
  reference?: boolean;
  /**
   * Checked by axe only, never shot. For a condition whose layout another
   * mode already pins, where only the colours can differ.
   */
  axeOnly?: boolean;
};

const WIDE = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

export const MODES: readonly Mode[] = [
  { name: 'light', viewport: WIDE, globals: { theme: 'light' }, reference: true },
  { name: 'dark', viewport: WIDE, globals: { theme: 'dark' } },
  { name: 'phone', viewport: PHONE, globals: { theme: 'light' } },
  { name: 'rtl', viewport: WIDE, globals: { theme: 'light', interlaceDir: 'rtl' } },
  // 150% on a phone: the size and the width where reflow breaks first.
  { name: 'text-150', viewport: PHONE, globals: { theme: 'light', interlaceTextSize: '2xl' } },
  { name: 'contrast-more', viewport: WIDE, globals: { theme: 'light', interlaceContrast: 'more' } },
  // The same AAA promise in the dark scheme. Its layout is contrast-more's,
  // so it is held by axe alone, not by a second set of screenshots.
  {
    name: 'contrast-more-dark',
    viewport: WIDE,
    globals: { theme: 'dark', interlaceContrast: 'more' },
    axeOnly: true,
  },
];

type IndexEntry = {
  id: string;
  type: 'story' | 'docs';
  title: string;
  name: string;
  importPath: string;
  tags?: string[];
};

const INDEX = fileURLToPath(new URL('../storybook-static/index.json', import.meta.url));

export type Story = { id: string; title: string; name: string; reference: boolean };

/**
 * Sections that document the system rather than ship a component: token
 * tables, variant catalogues, utility demos. They change whenever any token
 * does, so they are shot once, in light. Every component gets every
 * condition.
 */
const REFERENCE_SECTIONS = new Set(['Foundations', 'Tokens', 'Utilities', 'Contracts']);

/** The stories a mode shoots. */
export function storiesFor(mode: Mode): Story[] {
  return primaryStories().filter((s) => mode.reference || !s.reference);
}

/** The first story of every stories file, in index order. */
export function primaryStories(): Story[] {
  let raw: string;
  try {
    raw = readFileSync(INDEX, 'utf8');
  } catch {
    throw new Error(
      'No storybook-static/index.json. Build Storybook first: ' +
        '`npx turbo run build-storybook --filter=@interlace/storybook`.',
    );
  }
  const entries = Object.values((JSON.parse(raw) as { entries: Record<string, IndexEntry> }).entries);
  const seen = new Set<string>();
  const out: Story[] = [];
  for (const e of entries) {
    if (e.type !== 'story' || seen.has(e.importPath)) continue;
    seen.add(e.importPath);
    if (e.tags?.includes('no-visual')) continue;
    out.push({
      id: e.id,
      title: e.title,
      name: e.name,
      reference: REFERENCE_SECTIONS.has(e.title.split('/')[0]),
    });
  }
  return out;
}

export function storyUrl(id: string, mode: Mode): string {
  const globals = Object.entries(mode.globals)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
  return `/iframe.html?id=${id}&viewMode=story&globals=${globals}`;
}
