/**
 * `tsc` emits dist/index.js without the executable bit, and npm only sets it
 * on files listed in `bin` at PACK time — so a local `npm link` or a direct
 * `node_modules/.bin` run from a workspace checkout would fail with EACCES
 * while the published tarball worked. Set it at build time so both behave the
 * same.
 */
import { chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const bin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/index.js');
await chmod(bin, 0o755);
