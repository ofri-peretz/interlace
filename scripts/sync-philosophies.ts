/**
 * sync-philosophies.ts
 *
 * Projects every `docs/philosophies/*_PHILOSOPHY.md` into its consumer
 * surface:
 *
 *   1. Storybook MDX pages under `apps/storybook/src/stories/philosophy/`
 *
 * `docs/philosophies/` is the single source of truth. Generated MDX carries
 * a hash of its source in the header, so `philosophy-sync-lock.test.ts`
 * refuses to ship a `.md` edit that wasn't re-projected.
 *
 * Ported from the eslint monorepo (`scripts/sync-philosophies.ts`), where
 * these docs used to live. Differences from that original:
 *   - sources read from `docs/philosophies/`, not the repo root
 *   - the fumadocs surface (`apps/docs/content/docs/design/`) is NOT emitted;
 *     interlace has no published design section yet. To add one, restore
 *     `renderDocsMdx`/`renderDocsLanding`/`renderDocsMeta` from the eslint
 *     copy and point DOCS_OUT at `apps/landing/content/docs/design`.
 *   - repo-relative links degrade to code spans (Storybook can't resolve them)
 *
 * Usage:
 *   npm run sync:philosophies            — regenerate
 *   npm run sync:philosophies -- --check — exit non-zero if any output drifts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(REPO_ROOT, 'docs/philosophies');
const SB_OUT = path.join(REPO_ROOT, 'apps/storybook/src/stories/philosophy');

const CHECK_MODE = process.argv.includes('--check');

// Slug → lucide-react icon name.
const ICON_BY_SLUG: Record<string, string> = {
  ux: 'Sparkles',
  breakpoint: 'MonitorSmartphone',
  layout: 'Layout',
  typography: 'Type',
  color: 'Palette',
  motion: 'Wand2',
  loading: 'Loader',
  cta: 'MousePointerClick',
  form: 'ClipboardList',
  error: 'AlertTriangle',
  keyboard: 'Keyboard',
  a11y: 'Accessibility',
  pagination: 'ListOrdered',
  'data-table': 'Table',
  visualization: 'LineChart',
  search: 'Search',
  'code-example': 'Code2',
  docs: 'BookOpen',
  versioning: 'GitBranch',
  url: 'Link2',
  'deep-linking': 'Link',
  seo: 'Globe',
  i18n: 'Languages',
  interop: 'Plug',
  auth: 'Lock',
  security: 'Shield',
  analytics: 'BarChart3',
  utm: 'Tag',
};

// Named clusters that organise the philosophies. Adding a new philosophy:
// assign it to a cluster here — the Storybook nested title and the index
// page both derive from this single map.
interface Category {
  label: string;
  /** Short hint shown under the category heading on the index page. */
  hint: string;
  slugs: string[];
}

const CATEGORIES: Category[] = [
  {
    label: 'Foundations',
    hint: 'The visual contract. Every primitive consumes these tokens and rhythms.',
    slugs: ['ux', 'layout', 'breakpoint', 'typography', 'color', 'motion'],
  },
  {
    label: 'Interaction & States',
    hint: 'How a primitive responds to a person — focus, loading, error, conversion.',
    slugs: ['cta', 'loading', 'keyboard', 'a11y', 'error'],
  },
  {
    label: 'Content Patterns',
    hint: 'How information is presented inside the surface.',
    slugs: [
      'code-example',
      'search',
      'pagination',
      'data-table',
      'visualization',
      'form',
    ],
  },
  {
    label: 'Navigation & Routing',
    hint: 'How URLs, anchors, and shared links behave.',
    slugs: ['url', 'deep-linking', 'seo'],
  },
  {
    label: 'Reach',
    hint: 'How a component travels across languages and tooling.',
    slugs: ['i18n', 'interop'],
  },
  {
    label: 'Trust',
    hint: 'Auth, app-layer security, and the UI surface of secure-by-default.',
    slugs: ['auth', 'security'],
  },
  {
    label: 'Observability',
    hint: 'How a deployed surface measures itself — pageviews, funnels, identity, cross-property journeys.',
    slugs: ['analytics', 'utm'],
  },
  {
    label: 'Documentation',
    hint: 'How the design system explains itself, and how it changes under consumers.',
    slugs: ['docs', 'versioning'],
  },
];

const CATEGORY_BY_SLUG: Record<string, Category> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.slugs.map((s) => [s, c])),
);

const ORDER: string[] = CATEGORIES.flatMap((c) => c.slugs);

interface Philosophy {
  /** Absolute path to the source `.md`. */
  sourcePath: string;
  /** Slug derived from filename, e.g. `layout`, `code-example`. */
  slug: string;
  /** Display title — first `# Heading` line. */
  title: string;
  /** One-line description for the index list. */
  description: string;
  /** Full body, with the first `# Heading` stripped. */
  body: string;
  /** First 12 hex chars of SHA-256 over source content. */
  hash: string;
  /** Lucide icon name. */
  icon: string;
}

function slugFromFilename(file: string): string {
  // A11Y_PHILOSOPHY.md → a11y ; CODE_EXAMPLE_PHILOSOPHY.md → code-example
  return file
    .replace(/_PHILOSOPHY\.md$/i, '')
    .toLowerCase()
    .replace(/_/g, '-');
}

function titleCase(slug: string): string {
  const acronyms = new Set(['cta', 'ux', 'url', 'seo', 'a11y', 'i18n', 'auth']);
  if (acronyms.has(slug)) return slug.toUpperCase();
  return slug
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');
}

function deriveDescription(body: string): string {
  // First paragraph after the title that isn't a callout, table, or list.
  for (const para of body.split(/\n\s*\n/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (/^[#>|\-*]/.test(trimmed) || trimmed.startsWith('```')) continue;
    const flat = trimmed
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\s+/g, ' ');
    const sentence = flat.split(/(?<=[.!?])\s/)[0];
    return sentence.length > 160 ? sentence.slice(0, 157) + '…' : sentence;
  }
  return 'Design philosophy.';
}

function rewriteCrossLinks(markdown: string): string {
  // `[label](FOO_PHILOSOPHY.md)` / `[label](./FOO_PHILOSOPHY.md)` (+ #anchor)
  // → the Storybook page id `philosophy-<slug>--docs`.
  let out = markdown.replace(
    /\[([^\]]+)\]\(\.?\/?([A-Z][A-Z0-9_]*)_PHILOSOPHY\.md(#[^)]+)?\)/g,
    (_m, label: string, name: string, anchor = '') =>
      `[${label}](?path=/docs/philosophy-${slugFromFilename(`${name}_PHILOSOPHY.md`)}--docs)`,
  );
  // Repo-relative links (`](../../packages/ui/FOO.md)`, `](../follow-ups/x.md)`)
  // have no Storybook target — a rendered dead link is worse than plain text,
  // so degrade to a code span naming the path.
  out = out.replace(
    /\[`?([^\]`]+)`?\]\((\.\.?\/[^)]+)\)/g,
    (_m, label: string) => `\`${label}\``,
  );
  return out;
}

function escapeForMdx(markdown: string): string {
  // MDX2+ parses `<` followed by an identifier-start char as JSX. Escape the
  // `<` that are content (followed by space/digit/operator); leave real tags.
  // Fenced code blocks pass through untouched.
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (line.trim().startsWith('```')) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(/<(?=[\s\d=!])/g, '&lt;');
    })
    .join('\n');
}

function loadPhilosophy(sourcePath: string): Philosophy {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 12);
  const slug = slugFromFilename(path.basename(sourcePath));

  const lines = raw.split('\n');
  const titleIdx = lines.findIndex((l) => /^#\s+\S/.test(l));
  const title =
    titleIdx >= 0 ? lines[titleIdx].replace(/^#\s+/, '').trim() : titleCase(slug);
  const body = (titleIdx >= 0 ? lines.slice(titleIdx + 1) : lines)
    .join('\n')
    .trimStart();

  return {
    sourcePath,
    slug,
    title,
    description: deriveDescription(body),
    body,
    hash,
    icon: ICON_BY_SLUG[slug] ?? 'BookText',
  };
}

function renderStorybookMdx(p: Philosophy): string {
  const safeBody = escapeForMdx(rewriteCrossLinks(p.body));
  const cat = CATEGORY_BY_SLUG[p.slug];
  // Storybook nests by `/` in the title: "Philosophy/Foundations/UX" becomes
  // Philosophy → Foundations → UX in the sidebar. Uncategorised falls back
  // to a flat Philosophy/<Title>.
  const nestedTitle = cat
    ? `Philosophy/${cat.label}/${titleCase(p.slug)}`
    : `Philosophy/${titleCase(p.slug)}`;
  return `import { Meta } from '@storybook/addon-docs/blocks';

<Meta title=${JSON.stringify(nestedTitle)} />

{/* AUTO-GENERATED — run \`npm run sync:philosophies\` after editing the source.
    source: ${path.relative(REPO_ROOT, p.sourcePath)}
    hash: ${p.hash} */}

# ${p.title}

${safeBody.trimEnd()}
`;
}

function renderStorybookIndex(philosophies: Philosophy[]): string {
  const bySlug = new Map(philosophies.map((p) => [p.slug, p]));
  // Storybook slugifies a nested title into `philosophy-<cat>-<slug>--docs`.
  const sbSlug = (cat: string, slug: string) =>
    `philosophy-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${slug}--docs`;

  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const cat of CATEGORIES) {
    const members = cat.slugs
      .map((s) => bySlug.get(s))
      .filter((p): p is Philosophy => !!p);
    if (members.length === 0) continue;
    const list = members
      .map((p) => {
        seen.add(p.slug);
        return `- **[${p.title}](?path=/docs/${sbSlug(cat.label, p.slug)})** — ${p.description}`;
      })
      .join('\n');
    blocks.push(`## ${cat.label}\n\n${cat.hint}\n\n${list}`);
  }
  const orphans = philosophies.filter((p) => !seen.has(p.slug));
  if (orphans.length > 0) {
    blocks.push(
      `## Other\n\nUncategorised — assign a cluster in \`scripts/sync-philosophies.ts\`.\n\n` +
        orphans.map((p) => `- **${p.title}** — ${p.description}`).join('\n'),
    );
  }

  return `import { Meta } from '@storybook/addon-docs/blocks';

<Meta title="Philosophy" />

# Design philosophies

The Interlace design system ships **${philosophies.length} look-and-feel contracts**,
grouped into ${CATEGORIES.length} clusters. Each lives in \`docs/philosophies/\`
and is the single source of truth; this section projects them so they're
discoverable from inside Storybook alongside the live components they govern.

If you're shipping a component change and can't point to the principle
behind it, reconsider.

${blocks.join('\n\n')}
`;
}

function writeIfChanged(file: string, content: string): boolean {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
  if (existing === content) return false;
  if (CHECK_MODE) {
    process.stderr.write(`drift: ${path.relative(REPO_ROOT, file)}\n`);
    return true;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  process.stdout.write(`wrote: ${path.relative(REPO_ROOT, file)}\n`);
  return true;
}

function main(): void {
  if (!fs.existsSync(SRC_DIR)) {
    process.stderr.write(`error: ${path.relative(REPO_ROOT, SRC_DIR)} not found\n`);
    process.exit(1);
  }
  const sources = fs
    .readdirSync(SRC_DIR)
    .filter((f) => /^[A-Z][A-Z0-9_]*_PHILOSOPHY\.md$/.test(f))
    .map((f) => path.join(SRC_DIR, f))
    .sort();

  if (sources.length === 0) {
    process.stderr.write(
      `error: no *_PHILOSOPHY.md files in ${path.relative(REPO_ROOT, SRC_DIR)}\n`,
    );
    process.exit(1);
  }

  const philosophies = sources.map(loadPhilosophy);
  const orderIdx = (s: string) => {
    const i = ORDER.indexOf(s);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  philosophies.sort((a, b) => orderIdx(a.slug) - orderIdx(b.slug));

  let drift = 0;
  for (const p of philosophies) {
    if (writeIfChanged(path.join(SB_OUT, `${p.slug}.mdx`), renderStorybookMdx(p)))
      drift++;
  }
  if (writeIfChanged(path.join(SB_OUT, 'Index.mdx'), renderStorybookIndex(philosophies)))
    drift++;

  if (CHECK_MODE && drift > 0) {
    process.stderr.write(
      `\n${drift} projection(s) drifted. Run \`npm run sync:philosophies\` to update.\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `\nsynced ${philosophies.length} philosophies → storybook (${drift} changed)\n`,
  );
}

main();
