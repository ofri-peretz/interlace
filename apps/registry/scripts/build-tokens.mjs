#!/usr/bin/env node
/**
 * Project the brand palette into `public/tokens/interlace.tokens.json`, a
 * Design Tokens Community Group (DTCG) file that Figma plugins, Tokens Studio,
 * Style Dictionary and other design tools import.
 *
 * DERIVED, not forked. `packages/ui/styles/brand/*.css` stays the one place a
 * colour is written; this script reads it and `--check` fails the build when
 * the JSON drifts, so the file a designer imports and the CSS a developer
 * installs cannot disagree.
 *
 * Shape: one group per theme, one per scheme inside it, one token per
 * `--interlace-*` name with the prefix dropped:
 *
 *   interlace.light.primary  →  { $type: "color", $value: { colorSpace: "oklch", components: [L, C, H], hex } }
 *   interlace.light.ring     →  { $type: "color", $value: "{interlace.light.primary}" }   (an alias)
 *   interlace.light.radius   →  { $type: "dimension", $value: { value: 0.75, unit: "rem" } }
 *
 * `hex` is the sRGB fallback the DTCG colour format allows; the oklch value
 * is chosen so the two paint the same pixel (see color-math.ts in the ui
 * package, which pins that against Chromium).
 */

import { readFile, mkdir } from 'node:fs/promises';
// Atomic, so registry tests running beside prebuild never read half a file.
import { writeFile } from './write-atomic.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(REGISTRY_ROOT, '..', '..');
const BRAND_DIR = path.join(REPO_ROOT, 'packages/ui/styles/brand');
const OUT_FILE = path.join(REGISTRY_ROOT, 'public/tokens/interlace.tokens.json');

const CHECK_ONLY = process.argv.includes('--check');
const rel = (p) => path.relative(REPO_ROOT, p);

const fail = (message) => {
  throw new Error(`build-tokens: ${message}`);
};

/** The theme × scheme matrix, spelled exactly as the brand files spell it. */
const THEME_SELECTORS = {
  interlace: {
    light: { file: 'interlace.css', selector: ":root,\n  [data-scheme='light']" },
    dark: { file: 'interlace.css', selector: ".dark,\n  [data-scheme='dark']" },
  },
  harbor: {
    light: { file: 'harbor.css', selector: "[data-theme='harbor'],\n  [data-theme='harbor'] [data-scheme='light']" },
    dark: {
      file: 'harbor.css',
      selector:
        "[data-theme='harbor'].dark,\n  [data-theme='harbor'][data-scheme='dark'],\n" +
        "  [data-theme='harbor'] .dark,\n  [data-theme='harbor'] [data-scheme='dark']",
    },
  },
};

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const readBlock = (css, selector, file) => {
  const at = css.indexOf(`${selector} {`);
  if (at === -1)
    fail(`selector \`${selector.replace(/\n/g, '\\n')}\` no longer appears in ${file}.`);
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return stripComments(css.slice(open + 1, i));
    }
  }
  return fail(`unbalanced braces after \`${selector}\` in ${file}`);
};

const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055);

/** oklch → sRGB hex, the conversion a browser makes when it paints. */
const oklchToHex = (L, C, H) => {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l3 = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return `#${[
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ]
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};

const toToken = (value, theme, scheme, name) => {
  const alias = /^var\(\s*--interlace-([a-z0-9-]+)\s*\)$/.exec(value);
  if (alias) return { $type: 'color', $value: `{${theme}.${scheme}.${alias[1]}}` };

  const oklch = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(value);
  if (oklch) {
    const L = parseFloat(oklch[1]) / (oklch[2] ? 100 : 1);
    const C = parseFloat(oklch[3]);
    const H = parseFloat(oklch[4]);
    return {
      $type: 'color',
      $value: {
        colorSpace: 'oklch',
        components: [L, C, H],
        hex: oklchToHex(L, C, H),
      },
    };
  }

  const dimension = /^(-?[\d.]+)(px|rem)$/.exec(value);
  if (dimension) {
    return {
      $type: 'dimension',
      $value: { value: parseFloat(dimension[1]), unit: dimension[2] },
    };
  }

  return fail(
    `--interlace-${name} in ${theme} · ${scheme} is \`${value}\`, which has no DTCG form here. ` +
      'Write it as oklch(), a var() alias or a px/rem length, or teach this script the new form.',
  );
};

const build = async () => {
  const sources = new Map();
  const tokens = {
    $description:
      'Interlace brand tokens, generated from packages/ui/styles/brand/*.css. Do not edit by hand.',
  };
  for (const [theme, schemes] of Object.entries(THEME_SELECTORS)) {
    tokens[theme] = {};
    for (const [scheme, { file, selector }] of Object.entries(schemes)) {
      if (!sources.has(file)) sources.set(file, await readFile(path.join(BRAND_DIR, file), 'utf8'));
      const block = readBlock(sources.get(file), selector, file);
      const group = {};
      for (const [, name, value] of block.matchAll(/--interlace-([a-z0-9-]+)\s*:\s*([^;\s][^;]*);/g)) {
        group[name] = toToken(value.trim(), theme, scheme, name);
      }
      if (Object.keys(group).length < 20)
        fail(`${theme} · ${scheme} produced only ${Object.keys(group).length} tokens.`);
      tokens[theme][scheme] = group;
    }
  }
  return `${JSON.stringify(tokens, null, 2)}\n`;
};

const main = async () => {
  const next = await build();
  if (CHECK_ONLY) {
    const current = await readFile(OUT_FILE, 'utf8').catch(() => '');
    if (current !== next) {
      fail(
        `${rel(OUT_FILE)} is out of date with the brand CSS. Run node apps/registry/scripts/build-tokens.mjs.`,
      );
    }
    console.log(`build-tokens --check: up to date`);
    return;
  }
  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, next);
  console.log(`build-tokens: wrote ${rel(OUT_FILE)}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
