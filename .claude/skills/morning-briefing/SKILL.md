---
name: morning-briefing
description: Overnight digest of the ofri-peretz repos — red main CI, new issues, PRs waiting on you. Read-only. Made to run from /loop, a desktop scheduled task, or /schedule.
model: sonnet
argument-hint: [hours back, default 24]
---

Budget: at most ~8k tokens. If you run out, report what you have and stop. Read-only: open, merge,
push or comment on nothing.

Window: the last ${ARGUMENTS:-24} hours.

1. Repos: `gh repo list ofri-peretz --no-archived --limit 100 --json name,pushedAt` — only those
   pushed inside the window.
2. For each, in one `gh` call apiece:
   - main's latest CI: `gh run list -R ofri-peretz/<r> --branch main --limit 1 --json conclusion,name,url`
   - new issues: `gh issue list -R ofri-peretz/<r> --search "created:>=<window start>" --json number,title,url`
   - open PRs that need the owner (review requested, failing, or conflicting):
     `pr-blockers` for any PR whose rollup is red or mergeable=CONFLICTING.
3. Write the digest, most urgent first, three sections, links clickable, nothing else:
   **Red on main** · **Needs your call** (PRs blocked on a human decision) · **New issues**.
   An empty section is one line saying so.
4. If anything is red on main, send one PushNotification naming the repo and failing check.
