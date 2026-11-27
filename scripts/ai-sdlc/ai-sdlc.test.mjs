// node --test scripts/ai-sdlc/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, loadedLines, CONTEXT_BUDGET_LINES } from './audit.mjs';
import { repoOf, emptyStats, add, summarize } from './scorecard.mjs';

const ready = {
  paths: new Set(['AGENTS.md', '.claude/hooks/codegraph.mjs', 'REVIEW.md', '.sdlc/checklist.yaml', '.github/workflows/claude-code-review.yml']),
  claudeMd: '@AGENTS.md\n',
  loaded: 20,
  mcpJson: '{"mcpServers":{"codegraph":{}}}',
  gitignore: '.codegraph/\n',
  hasSecret: true,
};

test('a repo with every context check and review on is not premature', () => {
  const r = evaluate(ready);
  assert.equal(r.contextReady, true);
  assert.equal(r.reviewOn, true);
  assert.equal(r.premature, false);
});

test('review running over a context above budget is premature', () => {
  const r = evaluate({ ...ready, loaded: CONTEXT_BUDGET_LINES + 1 });
  assert.equal(r.contextReady, false);
  assert.equal(r.premature, true);
});

test('codegraph counts only when its index is gitignored and a hook builds it', () => {
  assert.equal(evaluate({ ...ready, gitignore: '' }).checks.codegraph, false);
  const noHook = new Set([...ready.paths].filter((p) => !p.includes('codegraph')));
  assert.equal(evaluate({ ...ready, paths: noHook }).checks.codegraph, false);
});

test('a review workflow without the secret is off, not premature', () => {
  const r = evaluate({ ...ready, loaded: 999, hasSecret: false });
  assert.equal(r.reviewOn, false);
  assert.equal(r.premature, false);
});

test('loaded lines follow @imports one level', () => {
  assert.equal(loadedLines('@AGENTS.md\nx', (p) => (p === 'AGENTS.md' ? 'a\nb\nc' : null)), 5);
});

test('worktrees and clone names map to their repo', () => {
  assert.equal(repoOf('/Users/o/repos/ofriperetz.dev/eslint/.claude/worktrees/x'), 'eslint');
  assert.equal(repoOf('/Users/o/repos/ofriperetz.dev/eslint-wt-1712/packages'), 'eslint');
  assert.equal(repoOf('/Users/o/repos/ofriperetz.dev/blog-public'), 'blog');
  assert.equal(repoOf('/Users/o/repos/ofriperetz.dev/interlace-ds-viz'), 'interlace');
  assert.equal(repoOf('/Users/o/repos/agents/.claude/worktrees/y'), 'agents');
  assert.equal(repoOf('/Users/o/repos/ofriperetz.dev/agents-routines'), null);
  assert.equal(repoOf('/Users/o/repos/campaign-service'), null);
});

test('cache hit, start context and tokens per PR', () => {
  const s = emptyStats();
  const rec = (usage, extra = {}) => ({ sessionId: 's', message: { usage }, ...extra });
  add(s, rec({ input_tokens: 10, cache_creation_input_tokens: 90, cache_read_input_tokens: 0, output_tokens: 5 }), true);
  add(s, rec({ input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 100, output_tokens: 5 }, { isSidechain: true }), false);
  const r = summarize(s, 2);
  assert.equal(r.cacheHit, 0.5);
  assert.equal(r.medianStartContext, 100);
  assert.equal(r.subagentShare, 0.5);
  assert.equal(r.inputPerPR, 100);
  assert.equal(r.freshPerPR, 50);
});

test('a plugin pinned below its latest major is reported', async () => {
  const { lagging } = await import('./audit.mjs');
  const pkg = JSON.stringify({ devDependencies: { 'eslint-plugin-secure-coding': '^3.2.0', 'eslint-plugin-jwt': '^4.0.0', eslint: '^9' } });
  assert.deepEqual(lagging(pkg, { 'eslint-plugin-secure-coding': 6, 'eslint-plugin-jwt': 4 }), ['secure-coding@^3.2.0→6']);
});

import { step, statusOf, checkOf } from './next.mjs';

test('the stage machine walks an intent from draft to done, with a human at both gates', () => {
  const at = (o) => step({ slug: 's', spec: null, branchOpen: false, ...o });
  assert.equal(at({ status: 'draft' }).stage, '1 Plan');
  assert.equal(at({ status: 'review' }).who, 'agent');
  assert.equal(at({ status: 'review', spec: '# spec' }).who, 'human');
  assert.match(at({ status: 'approved', spec: '**Check:** `npm test`' }).next, /^\/goal `npm test` exits 0/);
  assert.match(at({ status: 'approved', spec: '# no check' }).next, /names no \*\*Check:\*\*/);
  assert.equal(at({ status: 'approved', spec: 'x', branchOpen: true }).who, 'human');
  assert.equal(at({ status: 'shipped' }).who, null);
  assert.equal(at({ status: 'dropped' }).who, null);
});

test('status and check are read from both intent spellings in use', () => {
  assert.equal(statusOf('**Status:** approved · **Opened:** 2026-09-07'), 'approved');
  assert.equal(statusOf('Author: x. Status: review.'), 'review');
  assert.equal(statusOf('# no status line'), 'draft');
  assert.equal(checkOf('**Check:** `npx vitest run`'), 'npx vitest run');
  assert.equal(checkOf(null), null);
});

test('next.mjs runs as a command from a symlinked temp dir, the way the skill calls it', async () => {
  const { mkdtempSync, copyFileSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'next-')); // macOS: /var/… is a symlink to /private/var/…
  copyFileSync(new URL('./next.mjs', import.meta.url), join(dir, 'next.mjs'));
  mkdirSync(join(dir, 'repo/.sdlc/intents/x'), { recursive: true });
  writeFileSync(join(dir, 'repo/.sdlc/intents/x/intent.md'), '**Status:** draft\n');
  const r = spawnSync(process.execPath, [join(dir, 'next.mjs'), join(dir, 'repo'), 'x'], { encoding: 'utf8' });
  assert.equal(r.status, 1, 'a draft intent is agent work');
  assert.match(r.stdout, /1 Plan/);
});

test('install reports a user skill that is missing or edited, and none once copied', async () => {
  const { mkdtempSync, cpSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { drift, SKILLS } = await import('./install.mjs');
  const dest = mkdtempSync(join(tmpdir(), 'skills-'));
  assert.deepEqual(drift(dest), SKILLS, 'all missing');
  for (const n of SKILLS) cpSync(new URL(`../../docs/ai-sdlc/skills/${n}`, import.meta.url), join(dest, n), { recursive: true });
  assert.deepEqual(drift(dest), []);
  writeFileSync(join(dest, SKILLS[0], 'SKILL.md'), 'edited by hand');
  assert.deepEqual(drift(dest), [SKILLS[0]]);
});
