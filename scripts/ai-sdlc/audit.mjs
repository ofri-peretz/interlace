#!/usr/bin/env node
// AI-SDLC baseline audit: reads each repo's default branch through `gh` (never a local
// working tree) and reports which baseline checks it meets. See docs/ai-sdlc/AI-SDLC.md.
//
//   node scripts/ai-sdlc/audit.mjs            # markdown matrix
//   node scripts/ai-sdlc/audit.mjs --json     # machine-readable
//   node scripts/ai-sdlc/audit.mjs --check    # exit 1 if a repo runs Claude review before its context is ready
import { execFileSync } from 'node:child_process';

export const OWNER = 'ofri-peretz';
// ponytail: hand-kept list; the forks under the account are upstream contributions, not ours.
export const REPOS = ['eslint', 'interlace', 'burgee', 'serverless', 'blog', 'subagent-gateway', 'workshops', 'agents', 'impact-ingest'];
// Anthropic: "keep CLAUDE.md under 200 lines" (code.claude.com/docs/en/best-practices).
export const CONTEXT_BUDGET_LINES = 200;
const OUR_PLUGINS = /eslint-plugin-(secure-coding|browser-security|node-security|jwt|express-security|lambda-security|mongodb-security|nestjs-security|vercel-ai-security|pg|maintainability|reliability|modernization|conventions|modularity|operability|react-a11y|react-features|import-next)\b|packages\/eslint-plugin-/;

const gh = (args) => {
  try { return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 256 * 2 ** 20, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return null; }
};
const file = (repo, path) => {
  const out = gh(['api', `repos/${OWNER}/${repo}/contents/${path}`, '-H', 'Accept: application/vnd.github.raw']);
  return out ?? null;
};

// Lines Claude Code loads at session start: CLAUDE.md plus every `@path` it imports (one level).
export function loadedLines(claudeMd, read) {
  if (claudeMd == null) return 0;
  let n = claudeMd.split('\n').length;
  for (const [, p] of claudeMd.matchAll(/^@(\S+)\s*$/gm)) n += (read(p) ?? '').split('\n').length;
  return n;
}

// Pure: turns what was fetched into check results. Exported for the test.
// Our plugins a package.json pins below their latest major on npm: dogfooding a stale major
// means our own repos stop exercising what we ship.
export function lagging(pkg, latestMajor) {
  let deps;
  try { const j = JSON.parse(pkg ?? '{}'); deps = { ...j.dependencies, ...j.devDependencies }; }
  catch { return []; } // ponytail: an unparseable package.json pins nothing we can compare
  return Object.entries(deps)
    .filter(([n, v]) => OUR_PLUGINS.test(n) && latestMajor[n] != null && /\d/.test(v))
    .filter(([n, v]) => Number(v.match(/\d+/)[0]) < latestMajor[n])
    .map(([n, v]) => `${n.replace('eslint-plugin-', '')}@${v}→${latestMajor[n]}`);
}

export function evaluate({ paths, claudeMd, loaded, mcpJson, gitignore, pkg, eslintConfig, hasSecret, latestMajor = {} }) {
  const has = (p) => paths.has(p);
  const anyPrefix = (pre) => [...paths].some((p) => p.startsWith(pre));
  const scripts = (() => { try { return JSON.parse(pkg ?? '{}').scripts ?? {}; } catch { return {}; } })();
  const c = {
    'CLAUDE.md': claudeMd != null,
    'AGENTS.md': has('AGENTS.md'),
    [`context ≤${CONTEXT_BUDGET_LINES} lines`]: claudeMd != null && loaded <= CONTEXT_BUDGET_LINES,
    // The MCP server never builds its own index; burgee hookset's SessionStart hook does, in
    // local and cloud sessions alike. Without it the tool answers "not indexed".
    codegraph: /codegraph/.test(mcpJson ?? '') && /\.codegraph/.test(gitignore ?? '') && has('.claude/hooks/codegraph.mjs'),
    'REVIEW.md': has('REVIEW.md'),
    'checklist (burgee)': has('.sdlc/checklist.yaml'),
    intents: anyPrefix('.sdlc/intents/') || anyPrefix('docs/intents/'),
    'feedback loop': Boolean(scripts.test || scripts['ci:local']) || has('Makefile'),
    lefthook: has('lefthook.yml'),
    evals: has('.github/workflows/evals.yml') || anyPrefix('evals/'),
    'control bands': has('.github/workflows/control-bands.yml'),
    'our eslint plugins': OUR_PLUGINS.test(eslintConfig ?? '') || OUR_PLUGINS.test(pkg ?? ''),
  };
  const behind = lagging(pkg, latestMajor);
  c['plugins on latest major'] = c['our eslint plugins'] && behind.length === 0;
  const contextReady = ['CLAUDE.md', 'AGENTS.md', `context ≤${CONTEXT_BUDGET_LINES} lines`, 'codegraph', 'REVIEW.md', 'checklist (burgee)'].every((k) => c[k]);
  const reviewOn = has('.github/workflows/claude-code-review.yml') && hasSecret;
  return { checks: c, behind, loaded, contextReady, reviewOn, premature: reviewOn && !contextReady };
}

function latestMajors() {
  const names = OUR_PLUGINS.source.match(/\(([^)]+)\)/)[1].split('|').map((n) => `eslint-plugin-${n}`);
  return Object.fromEntries(names.map((n) => {
    try { return [n, Number(execFileSync('npm', ['view', n, 'version'], { encoding: 'utf8' }).split('.')[0])]; }
    catch { return [n, null]; }
  }));
}

function audit(repo, latestMajor) {
  const tree = JSON.parse(gh(['api', `repos/${OWNER}/${repo}/git/trees/HEAD?recursive=1`]) ?? '{"tree":[]}');
  const paths = new Set(tree.tree.map((t) => t.path));
  const claudeMd = paths.has('CLAUDE.md') ? file(repo, 'CLAUDE.md') : null;
  const eslintPath = [...paths].find((p) => /^eslint\.config\.(m?js|ts|cjs)$/.test(p));
  const secrets = gh(['secret', 'list', '-R', `${OWNER}/${repo}`]);
  return {
    repo,
    ...evaluate({
      paths,
      claudeMd,
      loaded: loadedLines(claudeMd, (p) => (paths.has(p) ? file(repo, p) : null)),
      mcpJson: paths.has('.mcp.json') ? file(repo, '.mcp.json') : null,
      gitignore: paths.has('.gitignore') ? file(repo, '.gitignore') : null,
      pkg: paths.has('package.json') ? file(repo, 'package.json') : null,
      eslintConfig: eslintPath ? file(repo, eslintPath) : null,
      // A token that cannot list secrets (CI's) must not read as "no secret": that would make
      // every repo look review-off and the --check vacuous. Unknown counts as on.
      hasSecret: secrets == null || /CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY/.test(secrets),
      latestMajor,
    }),
  };
}

export function toMarkdown(rows) {
  const keys = Object.keys(rows[0].checks);
  const head = `| repo | loaded lines | ${keys.join(' | ')} | context ready | Claude review |`;
  const sep = `| :-- | --: | ${keys.map(() => ':-:').join(' | ')} | :-: | :-: |`;
  const body = rows.map((r) => {
    const review = r.premature ? '⚠️ on, context not ready' : r.reviewOn ? '✅ on' : r.contextReady ? '⏳ enable' : '— gated';
    return `| ${r.repo} | ${r.loaded} | ${keys.map((k) => (r.checks[k] ? '✅' : '❌')).join(' | ')} | ${r.contextReady ? '✅' : '❌'} | ${review} |`;
  });
  const behind = rows.filter((r) => r.behind.length).map((r) => `- **${r.repo}** pins ${r.behind.join(', ')}`);
  return [head, sep, ...body, '', ...(behind.length ? ['Plugins behind their latest major:', ...behind] : [])].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const latest = latestMajors();
  const rows = REPOS.map((r) => audit(r, latest));
  console.log(process.argv.includes('--json') ? JSON.stringify(rows, null, 2) : toMarkdown(rows));
  if (process.argv.includes('--check') && rows.some((r) => r.premature)) {
    console.error(`Claude review runs before context is ready in: ${rows.filter((r) => r.premature).map((r) => r.repo).join(', ')}`);
    process.exit(1);
  }
}
