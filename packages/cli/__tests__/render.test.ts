import { describe, expect, it } from 'vitest';

import { DEFAULT_REGISTRY } from '../src/plan.js';
import { renderHelp, renderInfo, renderList, type IndexItem } from '../src/render.js';

const R = DEFAULT_REGISTRY;

const items: IndexItem[] = [
  { name: 'button', type: 'registry:ui', title: 'Button' },
  { name: 'card', type: 'registry:ui', title: 'Card' },
  { name: 'theme', type: 'registry:style', title: 'Theme' },
  { name: 'cn', type: 'registry:lib', title: 'cn' },
];

describe('renderList', () => {
  it('says so when the registry is empty', () => {
    expect(renderList([])).toBe('This registry is empty.');
  });

  // Order is a decision, not an accident: nothing a consumer installs compiles
  // without the theme, so the theme is listed before the components.
  it('orders theme before utilities before components', () => {
    const out = renderList(items);
    expect(out.indexOf('Theme (1)')).toBeLessThan(out.indexOf('Utilities (1)'));
    expect(out.indexOf('Utilities (1)')).toBeLessThan(out.indexOf('Components (2)'));
  });

  it('lists every item exactly once and reports the total', () => {
    const out = renderList(items);
    for (const i of items) expect(out.split(i.name).length - 1).toBeGreaterThanOrEqual(1);
    expect(out).toContain('4 items.');
  });

  it('closes with the command that acts on what was just listed', () => {
    expect(renderList(items)).toContain('interlace-ui add <name>');
  });

  // A registry that grows a type we have no label for must not silently drop
  // it from the only command that can enumerate the registry.
  it('lists an unknown item type under Other rather than hiding it', () => {
    const out = renderList([...items, { name: 'mystery', type: 'registry:future' }]);
    expect(out).toContain('Other (1)');
    expect(out).toContain('mystery');
    expect(out).toContain('5 items.');
  });

  it('tolerates an item with no title', () => {
    expect(renderList([{ name: 'bare', type: 'registry:ui' }])).toContain('bare');
  });
});

describe('renderInfo', () => {
  const item = {
    name: 'button',
    type: 'registry:ui',
    title: 'Button',
    description: 'A button.',
    dependencies: ['@base-ui/react'],
    registryDependencies: [`${R}/r/theme.json`],
    files: [{ path: 'registry/interlace-ui/button.tsx', target: 'components/ui/button.tsx' }],
  };

  it('shows title, description, deps and files', () => {
    const out = renderInfo(item, R);
    expect(out).toContain('Button  (button)');
    expect(out).toContain('A button.');
    expect(out).toContain('@base-ui/react');
    expect(out).toContain('components/ui/button.tsx');
  });

  // A long absolute URL per dependency is noise; the consumer wants the name,
  // and to know they do not have to install it themselves.
  it('shortens registry dependencies to names and says they are automatic', () => {
    const out = renderInfo(item, R);
    expect(out).toContain('theme');
    expect(out).not.toContain(`${R}/r/theme.json`);
    expect(out).toContain('(installed for you)');
  });

  // The anti-lock-in promise, printed where someone deciding whether to adopt
  // will actually read it.
  it('prints the equivalent plain-shadcn command', () => {
    expect(renderInfo(item, R)).toContain(`npx shadcn@latest add ${R}/r/button.json`);
  });

  it('falls back to the name when there is no title, and omits empty sections', () => {
    const out = renderInfo({ name: 'bare', type: 'registry:ui' }, R);
    expect(out).toContain('bare  (bare)');
    expect(out).not.toContain('npm dependencies');
    expect(out).not.toContain('registry dependencies');
    expect(out).not.toContain('files');
  });

  it('uses the file path when a target is not declared', () => {
    const out = renderInfo(
      { name: 'x', type: 'registry:ui', files: [{ path: 'registry/x.ts' }] },
      R,
    );
    expect(out).toContain('registry/x.ts');
  });
});

describe('renderHelp', () => {
  it('documents every command the CLI accepts', () => {
    const out = renderHelp();
    for (const c of ['init', 'add', 'list', 'info']) expect(out).toContain(c);
  });

  it('names the default registry so --registry is understandable', () => {
    expect(renderHelp()).toContain(R);
  });

  it('states that plain shadcn works too', () => {
    expect(renderHelp()).toContain('npx shadcn@latest add');
  });
});
