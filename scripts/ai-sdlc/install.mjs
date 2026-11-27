#!/usr/bin/env node
// Installs interlace's loop skills into ~/.claude/skills, so every repo on this machine has them.
// Interlace is the source; the user copies are what Claude Code loads outside this repo.
//
//   node scripts/ai-sdlc/install.mjs           copy docs/ai-sdlc/skills/* into ~/.claude/skills
//   node scripts/ai-sdlc/install.mjs --check   exit 1 when a user copy differs from this checkout
import { cpSync, existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILLS = ['ai-sdlc-loop', 'morning-briefing', 'pr-review', 'docs-drift'];
// Kept out of .claude/skills: there they would load into every interlace session a second time,
// over the always-loaded context ceiling (hookset context). The user copy is the one that loads.
const SRC = fileURLToPath(new URL('../../docs/ai-sdlc/skills/', import.meta.url));

/** Skills whose user copy is missing or differs from interlace's. */
export function drift(dest = join(homedir(), '.claude', 'skills')) {
  return SKILLS.filter((n) => {
    const from = join(SRC, n);
    const to = join(dest, n);
    if (!existsSync(to)) return true;
    return readdirSync(from).some((f) => !existsSync(join(to, f)) || readFileSync(join(from, f), 'utf8') !== readFileSync(join(to, f), 'utf8'));
  });
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  const dest = join(homedir(), '.claude', 'skills');
  const stale = drift(dest);
  if (process.argv.includes('--check')) {
    console.log(stale.length ? `out of date in ${dest}: ${stale.join(', ')} (run npm run ai-sdlc:install)` : 'user skills match interlace');
    process.exit(stale.length ? 1 : 0);
  }
  for (const n of SKILLS) cpSync(join(SRC, n), join(dest, n), { recursive: true });
  console.log(`installed ${SKILLS.join(', ')} into ${dest}`);
}
