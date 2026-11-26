// Writes a file so a reader never sees it half written.
//
// The pre-push hook runs `turbo run typecheck test build`, so registry tests
// (consumer-contract, description-lock, behavior-map…) read
// public/r/*.json and public/data/*.json while `prebuild` is rewriting them.
// A plain writeFile truncates first, and a test that read in that window
// failed with "Unexpected end of JSON input" yet passed alone. Writing a
// temporary file beside the target and renaming it over the target is atomic
// on one filesystem: a reader gets the old bytes or the new ones.

import { rename, writeFile as fsWriteFile } from "node:fs/promises";
import path from "node:path";

let counter = 0;

/** Same signature as fs/promises writeFile, for a path target. */
export async function writeFile(file, data, options) {
  const tmp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${counter++}.tmp`,
  );
  await fsWriteFile(tmp, data, options);
  await rename(tmp, file);
}
