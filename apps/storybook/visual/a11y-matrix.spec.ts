import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { MODES, storiesFor, type Mode } from './matrix';
import { stage } from './stage';

/**
 * Accessibility in the reading conditions the story-by-story axe gate
 * (`.storybook/test-runner.ts`) never sees. That gate scans every story in
 * its own light or dark scheme at desktop width. This one takes each
 * component's default story through the other conditions of the matrix:
 *
 *   - axe, WCAG 2.2 AA plus best practice, in phone, right-to-left, 150% text
 *     and more contrast. More contrast promises AAA, so there the AAA
 *     contrast rule (`color-contrast-enhanced`) is enforced as well.
 *   - Reflow (WCAG 1.4.10): at phone width, and at 150% text on a phone, the
 *     page never scrolls sideways. A table or code block may scroll inside
 *     its own box; the page may not.
 *   - Visible focus (WCAG 2.4.7): the first stops reached with Tab must each
 *     change pixels when focused. Implementation-agnostic: a ring, an
 *     outline, a fill change all count; nothing visible does not.
 *
 * Known failures live in `a11y-known.json`, as "mode/story-id": [rule ids].
 * It is a ratchet, not an allowlist to grow: a new failure fails the run, and
 * so does a listed failure that has been fixed, so the list only shrinks.
 * Fixed one? Delete its line in the same PR.
 */

const KNOWN_FILE = fileURLToPath(new URL('./a11y-known.json', import.meta.url));
const KNOWN: Record<string, string[]> = JSON.parse(readFileSync(KNOWN_FILE, 'utf8'));

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** The conditions this spec adds. Light and dark are the test-runner's. */
const A11Y_MODES = MODES.filter((m) => m.name !== 'light' && m.name !== 'dark');
const REFLOW_MODES = new Set(['phone', 'text-150']);
const LIGHT = MODES.find((m) => m.name === 'light') as Mode;

/** How many Tab stops the focus check walks per story. */
const FOCUS_STOPS = 6;

const AXE_SOURCE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

type Finding = { rule: string; detail: string };

async function axeFindings(page: Page, mode: Mode): Promise<Finding[]> {
  // The preview's a11y addon scans every story on visit with its own axe,
  // and axe refuses a second run while one is in flight. Use the page's axe
  // when it has one, and wait for its run to finish rather than race it.
  if (!(await page.evaluate(() => 'axe' in window))) {
    await page.addScriptTag({ content: AXE_SOURCE });
  }
  const extra = mode.name === 'contrast-more' ? ['color-contrast-enhanced'] : [];
  const violations = await page.evaluate(
    async ({ tags, extra }) => {
      // @ts-expect-error: injected above
      const axe = window.axe as {
        run: (
          ctx: Element | null,
          opts: Record<string, unknown>,
        ) => Promise<{
          violations: Array<{ id: string; help: string; nodes: Array<{ target: string[] }> }>;
        }>;
      };
      const rules: Record<string, { enabled: boolean }> = {};
      for (const id of extra) rules[id] = { enabled: true };
      const opts = { runOnly: { type: 'tag', values: tags }, rules };
      const root = document.querySelector('#storybook-root');
      let r: Awaited<ReturnType<typeof axe.run>> | undefined;
      for (let i = 0; i < 100 && !r; i++) {
        try {
          r = await axe.run(root, opts);
        } catch (e) {
          if (!String(e).includes('already running')) throw e;
          await new Promise((res) => setTimeout(res, 100));
        }
      }
      if (!r) throw new Error('axe stayed busy for 10s');
      return r.violations.map((v) => ({
        id: v.id,
        help: v.help,
        targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      }));
    },
    { tags: AXE_TAGS, extra },
  );
  return violations.map((v) => ({ rule: v.id, detail: `${v.help}: ${v.targets.join(', ')}` }));
}

async function reflowFinding(page: Page): Promise<Finding[]> {
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  return over > 1
    ? [{ rule: 'reflow', detail: `the page scrolls sideways by ${over}px` }]
    : [];
}

async function focusFindings(page: Page): Promise<Finding[]> {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < FOCUS_STOPS; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const root = document.getElementById('storybook-root');
      if (!el || el === document.body || !root?.contains(el)) return null;
      const r = el.getBoundingClientRect();
      const name =
        el.getAttribute('aria-label') ||
        (el.textContent ?? '').trim().slice(0, 40) ||
        el.getAttribute('data-slot') ||
        '';
      return {
        key: `${el.tagName}:${Math.round(r.x)}:${Math.round(r.y)}`,
        label: `<${el.tagName.toLowerCase()}> ${name}`.trim(),
        box: { x: r.x, y: r.y, width: r.width, height: r.height },
      };
    });
    if (!stop || seen.has(stop.key)) break;
    seen.add(stop.key);
    if (stop.box.width < 1 || stop.box.height < 1) continue;
    // Room for a ring drawn outside the box with an offset.
    const pad = 8;
    const vp = page.viewportSize() ?? { width: 1280, height: 800 };
    const x = Math.max(0, stop.box.x - pad);
    const y = Math.max(0, stop.box.y - pad);
    const clip = {
      x,
      y,
      width: Math.min(vp.width - x, stop.box.width + pad * 2),
      height: Math.min(vp.height - y, stop.box.height + pad * 2),
    };
    if (clip.width < 1 || clip.height < 1) continue;
    const focused = await page.screenshot({ clip, animations: 'disabled' });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const blurred = await page.screenshot({ clip, animations: 'disabled' });
    if (focused.equals(blurred)) {
      findings.push({ rule: 'focus-visible', detail: `no visible change when ${stop.label} takes focus` });
    }
    // Put focus back so the next Tab continues from here.
    await page.evaluate((key) => {
      const all = document.querySelectorAll<HTMLElement>('#storybook-root *');
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (`${el.tagName}:${Math.round(r.x)}:${Math.round(r.y)}` === key) {
          el.focus({ preventScroll: true });
          return;
        }
      }
    }, stop.key);
  }
  return findings;
}

function judge(key: string, findings: Finding[]): void {
  const known = new Set(KNOWN[key] ?? []);
  const found = new Set(findings.map((f) => f.rule));
  const fresh = findings.filter((f) => !known.has(f.rule));
  const fixed = [...known].filter((r) => !found.has(r));
  const lines: string[] = [];
  if (fresh.length) {
    lines.push(`New accessibility failures in ${key}:`);
    for (const f of fresh) lines.push(`  [${f.rule}] ${f.detail}`);
  }
  if (fixed.length) {
    lines.push(
      `Fixed in ${key}: ${fixed.join(', ')}. Remove ${fixed.length === 1 ? 'it' : 'them'} ` +
        `from visual/a11y-known.json so it cannot come back.`,
    );
  }
  expect(lines, lines.join('\n')).toEqual([]);
}

for (const mode of A11Y_MODES) {
  test.describe(mode.name, () => {
    for (const story of storiesFor(mode)) {
      test(`${story.title} › ${story.name}`, async ({ page }) => {
        await stage(page, story.id, mode);
        const findings = [
          ...(REFLOW_MODES.has(mode.name) ? await reflowFinding(page) : []),
          ...(await axeFindings(page, mode)),
        ];
        judge(`${mode.name}/${story.id}`, findings);
      });
    }
  });
}

test.describe('focus', () => {
  for (const story of storiesFor(LIGHT).filter((s) => !s.reference)) {
    test(`${story.title} › ${story.name}`, async ({ page }) => {
      await stage(page, story.id, LIGHT);
      judge(`focus/${story.id}`, await focusFindings(page));
    });
  }
});
