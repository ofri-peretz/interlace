/*
 * The one way a registry generator writes a file.
 *
 * `npm run prebuild` regenerates public/r, public/data, llms.txt and the rest
 * while turbo runs the test tasks in parallel, and those tests read the same
 * files (registry#test here, @interlace/ui#test from another workspace). A
 * plain `writeFile` truncates the file and then fills it, so a reader that
 * lands in between sees half a file: the flaky pre-push failures that passed
 * when the test ran alone.
 *
 * Two rules close that window:
 *   1. A file whose content would not change is not touched at all. On a clean
 *      tree, which is what a pre-push builds, the generators write nothing.
 *   2. A file that does change is written beside itself under a dot-name and
 *      renamed into place. A rename within one directory is atomic, so a
 *      reader sees the old file or the new one, never a torn one.
 *
 * The temp name starts with a dot and ends in `.tmp`, so the `*.json` filters
 * the tests use never pick it up. generated-write-lock.test.ts keeps every
 * generator on this helper.
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const tempPathFor = (file) =>
  path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${Math.random().toString(36).slice(2, 10)}.tmp`,
  );

/** Writes `content` to `file` atomically, and only when it differs. Returns true when it wrote. */
export const writeGenerated = async (file, content) => {
  const current = await readFile(file, 'utf8').catch(() => null);
  if (current === content) return false;
  await mkdir(path.dirname(file), { recursive: true });
  const temp = tempPathFor(file);
  try {
    await writeFile(temp, content, 'utf8');
    await rename(temp, file);
  } catch (err) {
    await rm(temp, { force: true });
    throw err;
  }
  return true;
};

/** The synchronous twin of `writeGenerated`, for the scripts that run top to bottom. */
export const writeGeneratedSync = (file, content) => {
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (current === content) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = tempPathFor(file);
  try {
    writeFileSync(temp, content, 'utf8');
    renameSync(temp, file);
  } catch (err) {
    rmSync(temp, { force: true });
    throw err;
  }
  return true;
};
