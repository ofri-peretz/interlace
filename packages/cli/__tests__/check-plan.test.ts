import { describe, expect, it } from 'vitest';

import { DEFAULT_REGISTRY, planFromArgv } from '../src/plan.js';
import { renderHelp } from '../src/render.js';

describe('planFromArgv: check', () => {
  it('is a check with nothing switched on', () => {
    expect(planFromArgv(['check'])).toEqual({
      kind: 'check',
      registry: DEFAULT_REGISTRY,
      json: false,
      strict: false,
      allow: [],
      items: [],
    });
  });

  it('reads its own options, in either spelling', () => {
    expect(
      planFromArgv(['check', '--json', '--strict', '--allow', 'a.tsx', '--allow=b.tsx', '--cwd', './web', '--config=ok.json', '--item', 'button', '--registry', 'http://x/']),
    ).toEqual({
      kind: 'check',
      registry: 'http://x/',
      json: true,
      strict: true,
      allow: ['a.tsx', 'b.tsx'],
      cwd: './web',
      config: 'ok.json',
      items: ['button'],
    });
  });

  it('asks for the value of an option that needs one', () => {
    for (const argv of [['check', '--allow'], ['check', '--cwd', '--json'], ['check', '--item='], ['check', '--config']]) {
      expect(planFromArgv(argv)).toMatchObject({ kind: 'error' });
    }
    expect(planFromArgv(['check', '--allow'])).toEqual({ kind: 'error', message: '--allow needs a value' });
  });

  it('refuses what check does not take', () => {
    expect(planFromArgv(['check', 'button'])).toEqual({ kind: 'error', message: 'check does not take button' });
    expect(planFromArgv(['check', '--overwrite'])).toMatchObject({ kind: 'error' });
  });

  it('does not take flags from the commands that pass them on to shadcn', () => {
    const plan = planFromArgv(['add', 'button', '--json', '--strict']);
    expect(plan).toMatchObject({ kind: 'shadcn' });
    expect((plan as { argv: string[] }).argv).toEqual(['add', `${DEFAULT_REGISTRY}/r/button.json`, '--json', '--strict']);
  });

  it('is in the help', () => {
    expect(renderHelp()).toContain('check');
    expect(renderHelp()).toContain('--allow <file>');
  });
});
