#!/usr/bin/env node
/**
 * Parse packages/ui/styles/interlace-theme.css and emit a JSON catalogue
 * of every semantic token + its concrete value in light + dark mode.
 *
 * Output: apps/registry/public/r/semantics-catalogue.json
 *
 * Shape:
 *   {
 *     light: { "--background": "#ffffff", "--foreground": "#0a0a0f", ... },
 *     dark:  { "--background": "#0a0a0f", "--foreground": "#ededf2", ... },
 *     brand: { light: { "--interlace-primary": "#6d28d9", ... }, dark: {...} }
 *   }
 *
 * Consumed by apps/registry/src/app/semantics-catalog/page.tsx which
 * renders the table at build time (RSC fetches from disk via
 * fs.readFileSync at module init).
 *
 * Re-runs as part of the registry build script's prebuild step. Safe to
 * run standalone: `node apps/registry/scripts/build-semantics-catalog.mjs`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../..');
const INTERLACE_THEME_PATH = resolve(
  REPO_ROOT,
  'packages/ui/styles/interlace-theme.css',
);
// NOT inside public/r/ — the `/c/[name]` dynamic route maps names to
// JSON files under public/r/, and a non-registry-item shape there
// crashes prerender. The catalogue is consumed only by
// apps/registry/src/app/semantics-catalog/page.tsx via fs.readFileSync,
// so it lives under public/data/ instead. Still publicly fetchable
// (Next serves public/*) but outside the registry's name-mapped tree.
const OUTPUT_PATH = resolve(
  REPO_ROOT,
  'apps/registry/public/data/semantics-catalogue.json',
);

const css = readFileSync(INTERLACE_THEME_PATH, 'utf-8');

/**
 * Extract `:root { --foo: bar; ... }` and `.dark, [data-theme='dark'] { ... }`
 * (or variants thereof) blocks AS THEY APPEAR INSIDE specific @layer
 * blocks. We need to differentiate `interlace.brand` (raw hex values) from
 * `interlace.semantics` (alias bindings to the brand layer).
 */
function extractLayerBlocks(source, layerName) {
  // Match `@layer <layerName> { ...content with balanced braces... }`.
  // CSS Cascade Layer blocks can nest, so we hand-walk braces instead of
  // relying on a regex with greedy/lazy quantifiers.
  const marker = `@layer ${layerName} {`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  let depth = 0;
  let i = start + marker.length - 1; // position the `{`
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return source.slice(start + marker.length, i);
}

/**
 * Within a layer block, extract every `<selector> { --token: value; ... }`
 * group. Returns { selector: { token: value } } where token is the
 * `--*` name including the leading dashes.
 */
function extractRulesInLayer(layerSource) {
  // CSS comments would otherwise be slurped into the selector text by
  // the rule regex (`/* …LIGHT… */\n :root` becomes one match). Strip
  // them first.
  const sanitized = layerSource.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  // Match `<selectors> { ... }` non-nested. interlace-theme.css doesn't
  // currently nest, so a simple regex is enough; if nesting lands later
  // this will need a real parser.
  const ruleRe = /([^{}@]+?)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(sanitized)) !== null) {
    const selectors = m[1].trim();
    const body = m[2];
    const tokens = {};
    const tokenRe = /(--[a-z][a-z0-9-]*)\s*:\s*([^;]+);/gi;
    let tm;
    while ((tm = tokenRe.exec(body)) !== null) {
      tokens[tm[1]] = tm[2].trim();
    }
    rules.push({ selectors, tokens });
  }
  return rules;
}

function rulesToMode(rules, modePredicate) {
  const out = {};
  for (const rule of rules) {
    if (!modePredicate(rule.selectors)) continue;
    Object.assign(out, rule.tokens);
  }
  return out;
}

// Selector list normalisation: split by commas, trim each, then ask
// "does it look like a light surface" / "does it look like a dark surface".
// `:root, .dark, [data-theme='dark']` is BOTH (semantic bindings apply to
// every theme), so we accept it for both modes.
const splitSelectors = (sel) =>
  sel.split(',').map((s) => s.trim()).filter(Boolean);

const isLightSelector = (sel) => {
  const parts = splitSelectors(sel);
  return parts.some((p) => /^:root\b/.test(p));
};
const isDarkSelector = (sel) => {
  const parts = splitSelectors(sel);
  return parts.some(
    (p) =>
      /^\.dark\b/.test(p) ||
      /^\[data-theme=['"]dark['"]\]/.test(p),
  );
};

// String.indexOf — pass the layer name literally, not regex-escaped.
const brandLayer = extractLayerBlocks(css, 'interlace.brand');
const semanticsLayer = extractLayerBlocks(css, 'interlace.semantics');

if (!brandLayer || !semanticsLayer) {
  console.error(
    'build-semantics-catalog: could not find @layer interlace.brand and/or @layer interlace.semantics in interlace-theme.css. Did Phase 1 land?',
  );
  process.exit(1);
}

const brandRules = extractRulesInLayer(brandLayer);
const semanticRules = extractRulesInLayer(semanticsLayer);

if (process.env.DEBUG_SEMANTICS_CATALOG) {
  console.log('brand rules:', brandRules.map((r) => ({ selectors: r.selectors, tokenCount: Object.keys(r.tokens).length })));
  console.log('semantic rules:', semanticRules.map((r) => ({ selectors: r.selectors, tokenCount: Object.keys(r.tokens).length })));
}

const catalogue = {
  brand: {
    light: rulesToMode(brandRules, isLightSelector),
    dark: rulesToMode(brandRules, isDarkSelector),
  },
  semantics: {
    light: rulesToMode(semanticRules, isLightSelector),
    dark: rulesToMode(semanticRules, isDarkSelector),
  },
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(catalogue, null, 2) + '\n');

const totalBrand = Object.keys(catalogue.brand.light).length;
const totalSemantics = Object.keys(catalogue.semantics.light).length;
console.log(
  `build-semantics-catalog: ${totalBrand} brand tokens, ${totalSemantics} semantic aliases → ${OUTPUT_PATH.replace(REPO_ROOT + '/', '')}`,
);
