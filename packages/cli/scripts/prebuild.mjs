/*
 * Drop a stale tsbuildinfo when dist/ is gone.
 *
 * `tsc -b` trusts tsbuildinfo over the filesystem: with the info file present
 * and dist/ deleted it concludes everything is up to date and emits nothing,
 * leaving a package whose `main` points at a file that does not exist. That
 * shape has shipped from this monorepo before.
 *
 * This was `test -d dist || rm -f tsconfig.lib.tsbuildinfo`, which is fine in
 * bash and silently wrong in `cmd.exe`, where neither `test` nor `rm` exists —
 * npm runs scripts through the platform shell, so a Windows contributor got a
 * failing build on `npm install`. Node is the one interpreter guaranteed to be
 * present wherever this package is built.
 */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');

if (!existsSync(path.join(pkgRoot, 'dist'))) {
  rmSync(path.join(pkgRoot, 'tsconfig.lib.tsbuildinfo'), { force: true });
}
