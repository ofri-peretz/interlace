/**
 * Auto-extract per-component metadata from a primitive's source content.
 *
 * Each `packages/ui/src/primitives/<name>.tsx` carries a structured JSDoc
 * header (R1-R26 mapping table, ## Anatomy section, MIN_VIEWPORT rationale)
 * plus the actual primitive code. Rather than authoring this data twice —
 * once in source, once in MDX — we parse the source at render time. The
 * source is the single source of truth (DESIGN_PRINCIPLES #12).
 *
 * All helpers are pure functions on the raw `content` string returned by
 * `loadItem(name).files[0].content`. No filesystem I/O.
 */

export type RRuleEntry = {
  rule: string;
  concept: string;
  location: string;
};

export type CvaVariant = {
  name: string;
  options: string[];
  defaultValue?: string;
};

export type PropEntry = {
  name: string;
  type: string;
  required: boolean;
  description: string | null;
};

export type PropsTable = {
  /** The `<Name>Props` type this came from. */
  typeName: string;
  /** The DOM element whose props are spread in, e.g. `span` — null if none. */
  extendsElement: string | null;
  /** True when the type composes `VariantProps<typeof …>` (see `variants`). */
  hasVariantProps: boolean;
  props: PropEntry[];
};

export type A11yNotes = {
  /** Base UI primitive that owns focus/keyboard behaviour, if any. */
  baseUi: string | null;
  /** ARIA attributes written literally in the source. */
  ariaAttributes: string[];
  /** `role="…"` values written literally in the source. */
  roles: string[];
  /** True when the component gates animation on `useReducedMotion`. */
  respectsReducedMotion: boolean;
  /** True when the source references the shared focus-visible ring contract. */
  hasFocusRing: boolean;
};

export type ComponentMetadata = {
  anatomy: string | null;
  rRules: RRuleEntry[];
  variants: CvaVariant[];
  exports: string[];
  baseUiImport: string | null;
  lucideIcons: string[];
  propsTables: PropsTable[];
  a11y: A11yNotes;
};

// NOTE: `minViewport` and `isClient` are NOT extracted here — they are
// published on each registry item's `meta` by build-registry.mjs, so the site
// reads them off the JSON rather than re-deriving them from source.
const ANATOMY_RE = /##\s*Anatomy\b([\s\S]*?)(?=\n\s*##\s|\n\s*\*\/|$)/;
const R_RULE_ROW_RE = /\*?\s*\|\s*(R\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g;
const EXPORT_RE = /\bexport\s+(?:const|function|class|type)\s+(\w+)/g;
const BASE_UI_IMPORT_RE = /from\s+['"]@base-ui\/react\/([\w-]+)['"]/;
const LUCIDE_IMPORT_BLOCK_RE = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/;

/**
 * Strip JSDoc comment formatting (* prefixes, leading/trailing whitespace,
 * embedded markdown table separators) so anatomy / table content is readable.
 */
const stripJsdoc = (s: string): string =>
  s
    .replace(/^\s*\*\s?/gm, '')
    .replace(/^\s+|\s+$/g, '');

export function extractAnatomy(content: string): string | null {
  const m = content.match(ANATOMY_RE);
  if (!m) return null;
  const body = stripJsdoc(m[1]);
  // Drop any trailing "MIN_VIEWPORT" / R-rule table headers if the anatomy
  // section runs into them (some primitives don't blank-line-separate).
  return body.split(/\n##\s|\n\|\s*Rule\s*\|/)[0]?.trim() || null;
}

export function extractRRules(content: string): RRuleEntry[] {
  const rules: RRuleEntry[] = [];
  // Reset lastIndex on the global regex
  R_RULE_ROW_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = R_RULE_ROW_RE.exec(content)) !== null) {
    const concept = stripJsdoc(match[2]);
    const location = stripJsdoc(match[3]);
    // Skip the table header row.
    if (/^\s*concept\s*$/i.test(concept) || /^[-]+$/.test(concept)) continue;
    rules.push({
      rule: match[1],
      concept,
      location,
    });
  }
  return rules;
}

/**
 * Body of the `{ … }` that starts at or after `from`, without its braces.
 * Returns null when there is no balanced block.
 */
function braceBody(content: string, from: number): string | null {
  const open = content.indexOf('{', from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < content.length; i += 1) {
    if (content[i] === '{') depth += 1;
    else if (content[i] === '}') {
      depth -= 1;
      if (depth === 0) return content.slice(open + 1, i);
    }
  }
  return null;
}

export function extractVariants(content: string): CvaVariant[] {
  // Brace-match rather than pattern-match the closing `}`: the previous
  // terminator regex swallowed the last variant group's closing brace, which
  // made this return [] for EVERY primitive — i.e. no page showed variants.
  const variantsAt = content.search(/\bvariants:\s*\{/);
  if (variantsAt === -1) return [];
  const block = braceBody(content, variantsAt);
  if (!block) return [];

  const variants: CvaVariant[] = [];
  // Each top-level `name: { … }` inside `variants` is one prop.
  const keyRe = /(\w+)\s*:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(block)) !== null) {
    const group = braceBody(block, m.index);
    if (group === null) continue;
    // Skip past this group so nested braces aren't read as another variant.
    keyRe.lastIndex = m.index + group.length;
    // Options are anchored on the preceding comma, so a comment sitting
    // between two of them hides the one after it. The primitives DO carry
    // rationale comments inside cva blocks (see badge's `destructive`), so
    // strip full-line `//` and any `/* */` before matching. Only line-leading
    // `//` is stripped, to leave any `//` inside a class string alone.
    const body = group
      .replace(/^[ \t]*\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const options = Array.from(
      body.matchAll(/(?:^|,)\s*(?:['"]([\w-]+)['"]|(\w+))\s*:/g),
      (mm) => mm[1] ?? mm[2],
    );
    if (options.length > 0) variants.push({ name: m[1], options });
  }

  // Pull default values from defaultVariants if present.
  const defaultsAt = content.search(/\bdefaultVariants:\s*\{/);
  const defaultsBlock =
    defaultsAt === -1 ? null : braceBody(content, defaultsAt);
  if (defaultsBlock) {
    const defaults: Record<string, string> = {};
    for (const dm of defaultsBlock.matchAll(/(\w+):\s*['"]([\w-]+)['"]/g)) {
      defaults[dm[1]] = dm[2];
    }
    for (const v of variants) {
      if (defaults[v.name]) v.defaultValue = defaults[v.name];
    }
  }

  return variants;
}

export function extractExports(content: string): string[] {
  const names = new Set<string>();
  EXPORT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EXPORT_RE.exec(content)) !== null) {
    if (m[1] === 'default') continue;
    names.add(m[1]);
  }
  // Also handle `export { Foo, Bar }` re-export blocks.
  const reExports = content.matchAll(/\bexport\s*\{([^}]+)\}/g);
  for (const r of reExports) {
    for (const part of r[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[1]?.trim() ?? part.trim();
      if (name && /^\w+$/.test(name)) names.add(name);
    }
  }
  return Array.from(names).sort();
}

export function extractBaseUiImport(content: string): string | null {
  const m = content.match(BASE_UI_IMPORT_RE);
  return m ? m[1] : null;
}

export function extractLucideIcons(content: string): string[] {
  const m = content.match(LUCIDE_IMPORT_BLOCK_RE);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((p) => p.trim())
    .filter((p) => /^\w+$/.test(p))
    .sort();
}

/**
 * Extract the props tables from `type <X>Props = …` / `interface <X>Props`.
 *
 * The primitives express their public API as an intersection:
 *
 *   type BadgeProps = React.ComponentProps<'span'> &
 *     VariantProps<typeof badgeVariants> & {
 *       /** doc comment *\/
 *       loading?: boolean;
 *     };
 *
 * so a useful table needs all three parts: the DOM element whose props pass
 * through, whether cva variants are composed in (rendered separately from the
 * `variants` block), and the component's OWN props with their doc comments.
 * Only the own-props arm needs parsing; the other two are one flag each.
 */
const PROPS_DECL_RE = /\b(?:type|interface)\s+(\w*Props)\b/g;
const ELEMENT_PROPS_RE = /React\.ComponentProps(?:WithoutRef)?<\s*'([\w-]+)'/;
const VARIANT_PROPS_RE = /VariantProps<\s*typeof\s+\w+\s*>/;
/** One member of an object-type body, with any preceding JSDoc block. */
const MEMBER_RE =
  /(?:\/\*\*([\s\S]*?)\*\/\s*)?^[ \t]*(\w+)(\??):\s*([^;\n]+);/gm;

/**
 * Slice the full declaration starting at `start`. Brace-counting rather than a
 * terminator regex: a props type ends with `  };` at whatever indentation the
 * file happens to use, and matching on that is how the first version of this
 * silently returned nothing for every primitive.
 */
function sliceDeclaration(content: string, start: number): string {
  let depth = 0;
  let seenBrace = false;
  for (let i = start; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '{') {
      depth += 1;
      seenBrace = true;
    } else if (ch === '}') {
      depth -= 1;
    } else if (ch === ';' && depth === 0) {
      return content.slice(start, i);
    } else if (ch === '\n' && seenBrace && depth === 0) {
      return content.slice(start, i);
    }
  }
  return content.slice(start);
}

export function extractPropsTables(content: string): PropsTable[] {
  const tables: PropsTable[] = [];
  PROPS_DECL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PROPS_DECL_RE.exec(content)) !== null) {
    const body = sliceDeclaration(content, match.index);
    const props: PropEntry[] = [];
    MEMBER_RE.lastIndex = 0;
    let member: RegExpExecArray | null;
    while ((member = MEMBER_RE.exec(body)) !== null) {
      const [, doc, name, optional, type] = member;
      props.push({
        name,
        type: type.trim(),
        required: optional !== '?',
        description: doc ? stripJsdoc(doc).replace(/\s+/g, ' ') || null : null,
      });
    }
    tables.push({
      typeName: match[1],
      extendsElement: body.match(ELEMENT_PROPS_RE)?.[1] ?? null,
      hasVariantProps: VARIANT_PROPS_RE.test(body),
      props,
    });
  }
  // Drop re-export lines (`export type { BadgeProps }`) — they match the
  // declaration regex but carry no API surface.
  return tables.filter(
    (t) => t.props.length > 0 || t.extendsElement || t.hasVariantProps,
  );
}

const ARIA_ATTR_RE = /\b(aria-[a-z]+)\s*[=:]/g;
const ROLE_RE = /\brole\s*[=:]\s*['"]([\w-]+)['"]/g;

export function extractA11yNotes(content: string): A11yNotes {
  const uniqueSorted = (matches: Iterable<RegExpMatchArray>, group: number) =>
    [...new Set([...matches].map((m) => m[group]))].sort();
  return {
    baseUi: extractBaseUiImport(content),
    ariaAttributes: uniqueSorted(content.matchAll(ARIA_ATTR_RE), 1),
    roles: uniqueSorted(content.matchAll(ROLE_RE), 1),
    respectsReducedMotion: /useReducedMotion|prefers-reduced-motion|motion-reduce:/.test(
      content,
    ),
    hasFocusRing: /focus-visible:|FocusRing/.test(content),
  };
}

export function extractMetadata(content: string): ComponentMetadata {
  return {
    anatomy: extractAnatomy(content),
    propsTables: extractPropsTables(content),
    a11y: extractA11yNotes(content),
    rRules: extractRRules(content),
    variants: extractVariants(content),
    exports: extractExports(content),
    baseUiImport: extractBaseUiImport(content),
    lucideIcons: extractLucideIcons(content),
  };
}
