import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
/**
 * Toggle `pill` variant locks (R26) — the DS's one chip-shaped toggle,
 * extracted from TimelineMap.Filter. Three contracts:
 *
 *  1. Class contract: the strand-a pressed tint, the greyscale-safe
 *     border identity, and the 24px SC 2.5.8 floor (`xs`) — pinned so a
 *     token cleanup or a cva reshuffle breaks here before it breaks
 *     every chip surface downstream.
 *  2. tailwind-merge resolution: the variant must actually BEAT the
 *     base's accent washes (the base sets data-[pressed]:bg-accent; a
 *     pill rendering accent instead of strand tint is the exact fork
 *     this variant exists to prevent).
 *  3. TimelineMap.Filter consumes it — the birthplace of the styling
 *     holds no local pill classes anymore.
 */
import { describe, expect, it } from 'vitest';

import { cn } from '../src/lib/cn.js';
import { Toggle, toggleVariants } from '../src/primitives/toggle.js';

describe('toggleVariants pill/xs', () => {
  // Through cn(), exactly as the component applies it — raw cva output
  // still carries the base classes; tailwind-merge is what resolves the
  // conflicts, so the merged string is the real contract.
  const classes = cn(toggleVariants({ variant: 'pill', size: 'xs' }));

  it('carries the strand-a pressed tint', () => {
    expect(classes).toContain('data-[pressed]:border-strand-a/50');
    expect(classes).toContain('data-[pressed]:bg-strand-a/10');
    expect(classes).toContain('data-[pressed]:text-foreground');
  });

  it('resolves the base accent washes away (tailwind-merge, last wins)', () => {
    expect(classes).not.toContain('data-[pressed]:bg-accent');
    expect(classes).not.toContain('hover:bg-muted');
  });

  it('owns its adjunct spacing: gap-1 beats the base gap-2', () => {
    // 4px label↔count — the spacing TimelineMap.Filter shipped with
    // (was ml-1 per child); the visual baseline pins it in pixels.
    const tokens = classes.split(/\s+/);
    expect(tokens).toContain('gap-1');
    expect(tokens).not.toContain('gap-2');
  });

  it('is a bordered, rounded-full pill — identity survives greyscale', () => {
    expect(classes).toContain('rounded-full');
    expect(classes).toContain('border-border');
    expect(classes).not.toContain('rounded-md');
  });

  it('xs sits on the 24px SC 2.5.8 floor via min-height, not height', () => {
    const tokens = classes.split(/\s+/);
    expect(tokens).toContain('min-h-6');
    expect(tokens).toContain('text-xs');
    // min-height, never a fixed height: a wrapped label must grow the
    // pill, not clip. (Token-exact check — `\bh-6\b` would false-match
    // inside "min-h-6".)
    expect(tokens).not.toContain('h-6');
  });
});

describe('Toggle pill behavior', () => {
  it('renders aria-pressed and flips it through Base UI', async () => {
    const user = userEvent.setup();
    const { getByRole } = render(
      <Toggle variant="pill" size="xs">
        Guides
      </Toggle>,
    );
    const button = getByRole('button', { name: 'Guides' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await user.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('the styling has one home', () => {
  it('TimelineMap.Filter renders Toggle pills, not local chip classes', async () => {
    const [{ readFileSync }, path] = await Promise.all([
      import('node:fs'),
      import('node:path'),
    ]);
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/patterns/timeline-map.tsx'),
      'utf-8',
    );
    expect(source).toContain("import { Toggle } from '../primitives/toggle.js'");
    expect(source).toContain('variant="pill"');
    // The literal pill recipe must not survive in the pattern — that is
    // the fork this extraction removed.
    expect(source).not.toContain('rounded-full border px-2.5');
  });
});
