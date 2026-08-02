#!/usr/bin/env node
/**
 * Validate every shipped registry artifact against the OFFICIAL shadcn schemas.
 *
 * Validates what is actually served — `public/r/*.json` on disk — not an
 * in-memory rebuild, so a hand-edit or a stale commit fails here too.
 *
 * The schemas under `schema/` are verbatim copies of
 *   https://ui.shadcn.com/schema/registry-item.json
 *   https://ui.shadcn.com/schema/registry.json
 * Refresh them with `npm run schema:refresh --workspace=registry` and commit
 * the diff — a spec change should be a reviewable event, not a silent one.
 *
 * Beyond schema conformance it asserts the invariants the schema can't:
 *   - every `registryDependencies` entry resolves to a real item (or a URL)
 *   - `index.json` covers exactly the on-disk item files
 *   - every item carries title/description/categories (directory-quality bar)
 *
 * Exit code 1 on any violation.
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { Ajv } from 'ajv';

import { HOMEPAGE } from '../registry.config.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_ROOT = path.resolve(SCRIPT_DIR, '..');
const OUT_DIR = path.join(REGISTRY_ROOT, 'public/r');
const SCHEMA_DIR = path.join(REGISTRY_ROOT, 'schema');

const ITEM_SCHEMA_ID = 'https://ui.shadcn.com/schema/registry-item.json';

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

const main = async () => {
  const itemSchema = await readJson(path.join(SCHEMA_DIR, 'registry-item.json'));
  const registrySchema = await readJson(path.join(SCHEMA_DIR, 'registry.json'));

  // Both upstream schemas declare `"$schema": "https://json-schema.org/..."`,
  // but the canonical draft-07 meta-schema id ajv ships is `http://`. Drop the
  // declaration rather than registering an alias — ajv's default dialect for
  // `new Ajv()` is already draft-07.
  delete itemSchema.$schema;
  delete registrySchema.$schema;

  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addSchema(itemSchema, ITEM_SCHEMA_ID);
  const validateItem = ajv.compile(itemSchema);
  const validateRegistry = ajv.compile(registrySchema);

  const errors = [];
  const fail = (where, msg) => errors.push(`${where}: ${msg}`);
  const ajvErrors = (v) =>
    (v.errors ?? [])
      .map((e) => `${e.instancePath || '/'} ${e.message}`)
      .join('; ');

  const fileNames = (await readdir(OUT_DIR))
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .sort();

  const names = new Set(fileNames.map((f) => f.replace(/\.json$/, '')));
  const items = [];

  for (const fileName of fileNames) {
    const item = await readJson(path.join(OUT_DIR, fileName));
    items.push(item);
    const where = `r/${fileName}`;

    if (!validateItem(item)) fail(where, ajvErrors(validateItem));

    // The schema only requires name + type. A registry that wants to be
    // browsable (and listable in the shadcn directory) needs more.
    if (item.name !== fileName.replace(/\.json$/, '')) {
      fail(where, `name "${item.name}" does not match its filename`);
    }
    for (const field of ['title', 'description', 'author', 'categories']) {
      const value = item[field];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        fail(where, `missing ${field}`);
      }
    }
    if (!item.files?.length) fail(where, 'has no files');
    for (const file of item.files ?? []) {
      if (!file.content) fail(where, `file ${file.path} has empty content`);
      if (!file.target) fail(where, `file ${file.path} has no target`);
      // The single check that kills the whole class of "import survived the
      // rewrite" bugs. Package sources use relative specifiers that resolve
      // inside @interlace/ui; none of them resolve in a consumer's tree, so
      // ANY relative import left in shipped content is a broken install —
      // whether it's a cross-tier path, a `../lib/` utility the rewriter
      // doesn't know about, or something added later.
      for (const [, spec] of file.content.matchAll(
        /from\s+['"](\.\.?\/[^'"]+)['"]/g,
      )) {
        fail(where, `unrewritten relative import "${spec}" in ${file.target}`);
      }
    }

    // A dangling registry dependency is a broken install, not a lint nit.
    // A BARE name means "a shadcn/ui core component" to the CLI — referencing
    // one of our own items that way resolves against ui.shadcn.com and fails
    // the install, so our refs must be absolute URLs into this registry.
    for (const dep of item.registryDependencies ?? []) {
      const own = dep.startsWith(`${HOMEPAGE}/r/`);
      if (own) {
        const depName = dep.slice(`${HOMEPAGE}/r/`.length).replace(/\.json$/, '');
        if (!names.has(depName)) {
          fail(where, `registryDependency "${dep}" resolves to no item`);
        }
      } else if (!dep.startsWith('http')) {
        fail(
          where,
          `registryDependency "${dep}" is a bare name — the CLI would resolve it against ui.shadcn.com. Use ${HOMEPAGE}/r/${dep}.json`,
        );
      }
    }
  }

  // ─── index.json ────────────────────────────────────────────────────────
  const index = await readJson(path.join(OUT_DIR, 'index.json'));
  if (!validateRegistry(index)) {
    fail('r/index.json', ajvErrors(validateRegistry));
  }
  const indexed = new Set(index.items.map((i) => i.name));
  for (const name of names) {
    if (!indexed.has(name)) fail('r/index.json', `missing item "${name}"`);
  }
  for (const name of indexed) {
    if (!names.has(name)) fail('r/index.json', `lists absent item "${name}"`);
  }

  if (errors.length) {
    console.error(
      `Registry schema validation FAILED (${errors.length}):\n  ` +
        errors.join('\n  '),
    );
    process.exit(1);
  }

  console.log(
    `OK — ${items.length} item(s) + index.json conform to the shadcn registry schemas.`,
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
