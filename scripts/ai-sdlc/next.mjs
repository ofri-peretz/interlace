#!/usr/bin/env node
// The AI-SDLC as a loop: reads every intent in a repo and prints the next step of each, and
// who takes it. A program decides the stage, so Claude never reads intent files to find out.
//
//   node scripts/ai-sdlc/next.mjs [repo] [slug…]  only those intents when slugs are given (a loop
//                                             passes the ones its request created; old intents never
//                                             marked shipped must not be rebuilt)
//                                             exit 1: agent work remains, the first line is next
//                                             exit 0: nothing for an agent (done, or waiting on a human)
//
// That exit code is the loop's stop condition: `/goal node <this file> exits 0`.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const INTENT_DIRS = ['.sdlc/intents', 'docs/intents'];

/** `**Status:** approved · …` or `Status: approved.` → 'approved'. */
export function statusOf(text) {
  return /status:\**\s*`?([a-z]+)/i.exec(text)?.[1]?.toLowerCase() ?? 'draft';
}

/** The acceptance check a spec names: `**Check:** \`cmd\``. */
export function checkOf(spec) {
  return /\*\*Check:\*\*\s*`([^`]+)`/i.exec(spec ?? '')?.[1] ?? null;
}

/**
 * One intent → its next step. `who` is 'agent', 'human' or null (finished).
 * Stages and gates follow docs/ai-sdlc/AI-SDLC.md; a human owns both gates (rule 3).
 */
export function step({ slug, status, spec, branchOpen }) {
  if (status === 'shipped' || status === 'dropped') return { slug, stage: 'done', who: null };
  if (status === 'draft') return { slug, stage: '1 Plan', who: 'agent', next: 'Fill every section of intent.md, then set Status: review.' };
  if (status === 'review' && spec === null)
    return { slug, stage: '2 Design', who: 'agent', next: 'Write spec.md beside the intent. Name its acceptance check as **Check:** `<command that exits 0 when done>`.' };
  if (status === 'review') return { slug, stage: '2 Design→Build gate', who: 'human', next: 'Accept spec.md: set Status: approved.' };
  if (status === 'approved' && branchOpen) return { slug, stage: '5 Deploy gate', who: 'human', next: `Review and merge the PR from sdlc/${slug}.` };
  if (status === 'approved') {
    const check = checkOf(spec);
    return {
      slug,
      stage: '3 Build → 4 Test',
      who: 'agent',
      next: check
        ? `/goal \`${check}\` exits 0 — build on branch sdlc/${slug}, have a separate reviewer check it, open the PR with Status: shipped.`
        : `spec.md names no **Check:**. Add one (the check comes before the build), then build on branch sdlc/${slug}.`,
    };
  }
  return { slug, stage: '?', who: 'human', next: `Unknown Status "${status}" in intent.md.` };
}

function openBranches(repo) {
  try {
    const out = execFileSync('git', ['ls-remote', '--heads', 'origin', 'sdlc/*'], { cwd: repo, encoding: 'utf8', timeout: 15_000 });
    return new Set(out.split('\n').map((l) => l.split('refs/heads/sdlc/')[1]).filter(Boolean));
  } catch {
    return new Set(); // ponytail: offline or no origin → treat every branch as not yet pushed
  }
}

export function plan(repo, only = []) {
  const branches = openBranches(repo);
  const steps = [];
  for (const dir of INTENT_DIRS.map((d) => join(repo, d)).filter(existsSync)) {
    for (const slug of readdirSync(dir).filter((s) => !s.startsWith('_') && (only.length === 0 || only.includes(s))).sort()) {
      const intent = join(dir, slug, 'intent.md');
      if (!existsSync(intent)) continue;
      const specFile = join(dir, slug, 'spec.md');
      steps.push(
        step({
          slug,
          status: statusOf(readFileSync(intent, 'utf8')),
          spec: existsSync(specFile) ? readFileSync(specFile, 'utf8') : null,
          branchOpen: branches.has(slug),
        }),
      );
    }
  }
  return steps;
}

// Real paths: run from $TMPDIR, Node names /var/… as /private/var/… and a string compare misses.
if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  const [repo = '.', ...only] = process.argv.slice(2);
  const steps = plan(resolve(repo), only);
  const agent = steps.filter((s) => s.who === 'agent');
  const human = steps.filter((s) => s.who === 'human');
  for (const s of [...agent, ...human]) console.log(`${s.who.padEnd(5)}  ${s.stage.padEnd(22)}  ${s.slug}\n       ${s.next}`);
  console.log(`\n${agent.length} for an agent, ${human.length} waiting on a human, ${steps.length - agent.length - human.length} done.`);
  process.exit(agent.length > 0 ? 1 : 0);
}
