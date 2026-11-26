#!/usr/bin/env node
// Claude scorecard: how much context Claude spends per repo, and per merged PR.
// Reads local Claude Code session logs (~/.claude/projects/**/*.jsonl) — nothing leaves the
// machine — and merged-PR counts from `gh`. See docs/ai-sdlc/AI-SDLC.md § Measure.
//
//   node scripts/ai-sdlc/scorecard.mjs [--days 28] [--json]
import { readdirSync, statSync, createReadStream } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { OWNER, REPOS } from './audit.mjs';

// Local clones whose name starts with one of ours but are other repos.
const NOT_OURS = /^agents-(routines|footprint)/;

// cwd → repo: the first path segment under ~/repos or ~/repos/ofriperetz.dev, matched to the
// longest repo-name prefix, so `eslint/.claude/worktrees/x` and `eslint-wt-1712` both count as
// eslint. ponytail: `blog-public` is the local clone name of `blog`.
export function repoOf(cwd) {
  const m = cwd?.match(/\/repos\/(?:ofriperetz\.dev\/)?([^/]+)/);
  if (!m || NOT_OURS.test(m[1])) return null;
  const seg = m[1].replace(/^blog-public/, 'blog');
  return [...REPOS].sort((a, b) => b.length - a.length).find((r) => seg === r || seg.startsWith(`${r}-`) || seg.startsWith(`${r}.`)) ?? null;
}

export function emptyStats() {
  return { sessions: new Set(), input: 0, cacheWrite: 0, cacheRead: 0, output: 0, sidechainOutput: 0, startContext: [] };
}

// One assistant record → stats. Records repeat per content block, so callers dedupe by message.id.
export function add(s, rec, firstInSession) {
  const u = rec.message.usage;
  s.sessions.add(rec.sessionId);
  s.input += u.input_tokens ?? 0;
  s.cacheWrite += u.cache_creation_input_tokens ?? 0;
  s.cacheRead += u.cache_read_input_tokens ?? 0;
  s.output += u.output_tokens ?? 0;
  if (rec.isSidechain) s.sidechainOutput += u.output_tokens ?? 0;
  // Context at the first call of a session = what CLAUDE.md, tools and MCP defs cost before any work.
  if (firstInSession) s.startContext.push((u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0));
}

const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);

export function summarize(s, merged) {
  const inTotal = s.input + s.cacheWrite + s.cacheRead;
  const fresh = s.input + s.cacheWrite;
  return {
    sessions: s.sessions.size,
    inputTokens: inTotal,
    outputTokens: s.output,
    cacheHit: inTotal ? s.cacheRead / inTotal : 0,
    subagentShare: s.output ? s.sidechainOutput / s.output : 0,
    medianStartContext: s.startContext.length ? median(s.startContext) : null,
    mergedPRs: merged,
    inputPerPR: merged ? Math.round(inTotal / merged) : null,
    // Fresh = not served from cache: the tokens the model processed at full price.
    freshPerPR: merged ? Math.round(fresh / merged) : null,
  };
}

async function scan(days) {
  const since = Date.now() - days * 864e5;
  const root = join(homedir(), '.claude', 'projects');
  const stats = Object.fromEntries(REPOS.map((r) => [r, emptyStats()]));
  const seen = new Set();
  const started = new Set();
  for (const dir of readdirSync(root)) {
    for (const f of readdirSync(join(root, dir), { recursive: true })) {
      const path = join(root, dir, f);
      if (!f.endsWith('.jsonl') || statSync(path).mtimeMs < since) continue;
      for await (const line of createInterface({ input: createReadStream(path) })) {
        if (!line.includes('"usage"')) continue;
        let rec;
        try { rec = JSON.parse(line); } catch { continue; }
        const id = rec.message?.id;
        if (!rec.message?.usage || !id || seen.has(id) || Date.parse(rec.timestamp) < since) continue;
        seen.add(id);
        const repo = repoOf(rec.cwd);
        if (!repo) continue;
        const first = !rec.isSidechain && !started.has(rec.sessionId);
        if (first) started.add(rec.sessionId);
        add(stats[repo], rec, first);
      }
    }
  }
  return stats;
}

function mergedPRs(days) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const out = execFileSync('gh', ['search', 'prs', '--owner', OWNER, '--merged', '--merged-at', `>=${since}`, '--limit', '1000', '--json', 'repository'], { encoding: 'utf8' });
  const counts = {};
  for (const { repository } of JSON.parse(out)) counts[repository.name] = (counts[repository.name] ?? 0) + 1;
  return counts;
}

const k = (n) => (n == null ? '—' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
const pct = (x) => `${Math.round(x * 100)}%`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const days = Number(process.argv[process.argv.indexOf('--days') + 1]) || 28;
  const [stats, merged] = [await scan(days), mergedPRs(days)];
  const rows = REPOS.map((r) => ({ repo: r, ...summarize(stats[r], merged[r] ?? 0) }));
  if (process.argv.includes('--json')) console.log(JSON.stringify({ days, rows }, null, 2));
  else {
    console.log(`Last ${days} days. Input tokens include cache reads.\n`);
    console.log('| repo | sessions | input tokens | output tokens | cache hit | subagent share of output | median start context | merged PRs | input tokens / merged PR | fresh input / merged PR |');
    console.log('| :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: |');
    for (const r of rows) console.log(`| ${r.repo} | ${r.sessions} | ${k(r.inputTokens)} | ${k(r.outputTokens)} | ${pct(r.cacheHit)} | ${pct(r.subagentShare)} | ${k(r.medianStartContext)} | ${r.mergedPRs} | ${k(r.inputPerPR)} | ${k(r.freshPerPR)} |`);
  }
}
