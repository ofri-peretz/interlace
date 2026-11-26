/**
 * `add` hands every flag it does not own to shadcn, and so must hand over the value a flag takes:
 * `--cwd ./web` is a folder, not a component named "./web".
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_REGISTRY, planFromArgv } from '../src/plan.js';

const argv = (...args: string[]) => (planFromArgv(args) as { argv: string[] }).argv;
const button = `${DEFAULT_REGISTRY}/r/button.json`;

describe('add: the value of a flag shadcn takes', () => {
  it('passes --cwd and its value through untouched', () => {
    expect(argv('add', 'button', '--cwd', './web')).toEqual(['add', button, '--cwd', './web']);
    expect(argv('add', '--cwd', './web', 'button')).toEqual(['add', '--cwd', './web', button]);
  });

  it('does the same for -c, --path and -p', () => {
    expect(argv('add', 'button', '-c', 'apps/web')).toEqual(['add', button, '-c', 'apps/web']);
    expect(argv('add', 'button', '--path', 'src/ui')).toEqual(['add', button, '--path', 'src/ui']);
    expect(argv('add', 'button', '-p', 'src/ui')).toEqual(['add', button, '-p', 'src/ui']);
  });

  it('still resolves every component name around it', () => {
    expect(argv('add', 'button', '--cwd', './web', 'card', '@shadcn/input')).toEqual([
      'add',
      button,
      '--cwd',
      './web',
      `${DEFAULT_REGISTRY}/r/card.json`,
      '@shadcn/input',
    ]);
  });

  it('passes --cwd=./web as it is, and a flag with no value after it', () => {
    expect(argv('add', 'button', '--cwd=./web')).toEqual(['add', button, '--cwd=./web']);
    expect(argv('add', 'button', '--overwrite')).toEqual(['add', button, '--overwrite']);
  });

  it('passes a value flag that is last, with nothing after it, for shadcn to complain about', () => {
    expect(argv('add', 'button', '--cwd')).toEqual(['add', button, '--cwd']);
  });

  it('does not take a value as the only thing add was asked to install', () => {
    expect(planFromArgv(['add', '--cwd', './web'])).toEqual({ kind: 'error', message: 'add needs at least one component name' });
  });

  it('does the same for init', () => {
    expect(argv('init', '--cwd', './web')).toEqual(['init', '--cwd', './web']);
  });
});
