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
