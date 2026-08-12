import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { listItemNames } from './registry';

/**
 * The real `npx shadcn add` end-to-end run, read straight from the artifact CI
 * commits (`apps/registry/e2e-install-results.json`, written by
 * `scripts/e2e-install.mjs`).
 *
 * No generated projection here, unlike `behavior-map.json` and `concepts.json`:
 * the results file is ALREADY a committed machine-written JSON in this app, so
 * distilling it into a second one would create the drift this app spends three
 * scripts avoiding. What the page needs is a summary, and a summary computed at
 * render time cannot disagree with its source.
 *
 * The ANSI-laden `log` strings are deliberately not carried into the summary —
 * they are megabytes of terminal output, and the claims a reader cares about
 * ("it type-checked") are assertions over them, not the text itself.
 */

export type InstallProofStep = {
  id: string;
  ok: boolean;
  /** What this step proves, in the terms a reader is deciding on. */
  claim: string;
};

export type InstallProof = {
  ok: boolean;
  /** When CI last ran the install. */
  ranAt: string;
  durationSeconds: number | null;
  /** Items the run installed. */
  itemCount: number;
  /** Files those items wrote into the throwaway app. */
  fileCount: number;
  /** Items that did NOT install. Empty is the whole point. */
  failed: string[];
  /** The DS stylesheets the run confirmed were wired into the app's CSS. */
  sheets: string[];
  steps: InstallProofStep[];
  /** `next build` reported a TypeScript pass over every installed source. */
  typeChecked: boolean;
  /**
   * Items in the registry today that the last run did not cover. Non-empty
   * means the proof is behind the catalogue — which is worth saying out loud
   * rather than rounding "120 items installed" up to "everything works".
   */
  notCovered: number;
  registryItemCount: number;
};

type RawResults = {
  ok?: boolean;
  generatedAt: string;
  durationSeconds?: number;
  itemCount: number;
  steps: Record<string, { ok: boolean; log?: string; sheets?: string[] }>;
  items: Record<string, { installed: boolean; files?: number }>;
};

/** What each step of the harness actually establishes. */
const CLAIMS: Record<string, string> = {
  createNextApp:
    'A brand-new Next.js + Tailwind v4 app, created from scratch — not a fixture kept alive between runs.',
  shadcnInit:
    '`npx shadcn init` accepted this registry: preflight, framework detection, `components.json`.',
  add: 'Every registry item installed through the real `npx shadcn add` CLI, resolving registry dependencies as it went.',
  cssWired:
    'The DS stylesheets landed in the app’s CSS in cascade-correct order.',
  build:
    '`next build` compiled and type-checked the installed sources in a project that has never seen this DS before.',
};

export const loadInstallProof = async (): Promise<InstallProof | null> => {
  let raw: RawResults;
  try {
    raw = JSON.parse(
      await readFile(join(process.cwd(), 'e2e-install-results.json'), 'utf8'),
    ) as RawResults;
  } catch {
    return null;
  }

  const items = Object.entries(raw.items ?? {});
  const steps = Object.entries(raw.steps ?? {}).map(([id, step]) => ({
    id,
    ok: step.ok,
    claim: CLAIMS[id] ?? id,
  }));

  const registryItemCount = (await listItemNames()).length;

  return {
    ok: raw.ok ?? steps.every((s) => s.ok),
    ranAt: raw.generatedAt,
    durationSeconds: raw.durationSeconds ?? null,
    itemCount: raw.itemCount ?? items.length,
    fileCount: items.reduce((n, [, item]) => n + (item.files ?? 0), 0),
    failed: items.filter(([, item]) => !item.installed).map(([name]) => name),
    sheets: raw.steps?.cssWired?.sheets ?? [],
    steps,
    typeChecked: /Finished TypeScript/.test(raw.steps?.build?.log ?? ''),
    registryItemCount,
    notCovered: Math.max(0, registryItemCount - (raw.itemCount ?? items.length)),
  };
};
