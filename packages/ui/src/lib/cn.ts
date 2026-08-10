import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The DS type scale, as declared in `styles/foundation.css`.
 *
 * Tailwind v4 generates a `text-<name>` utility for every `--text-<name>` theme
 * key, which collides head-on with `text-<color>`. tailwind-merge cannot tell
 * them apart from the class name alone — `text-ui` looks exactly like a colour
 * utility — so **with no configuration it files our size tokens under
 * `text-color` and deletes them whenever a real colour utility is also
 * present.**
 *
 * That is not theoretical. `twMerge('text-ui-sm font-medium text-foreground')`
 * returns `'font-medium text-foreground'`: the size is gone. It was shipping in
 * the rendered DOM in at least eight places — ProgressLabel, ProgressValue,
 * ToastTitle, ToastDescription, the CodeBlock header, its copy button, its
 * `<pre>` (which lost `text-code`), and `<Typography variant="ui" tone="muted">`,
 * which lost the size that is the entire point of the variant.
 *
 * Keep this list in sync with `--text-*` in `foundation.css`. A token added
 * there and forgotten here does not error — it silently loses its size at the
 * first `cn()` that also sets a colour, which is the worst possible failure
 * mode, so `__tests__/cn-type-scale-lock.test.ts` asserts the two agree.
 */
export const DS_FONT_SIZES = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'body',
  'long',
  'ui',
  'ui-sm',
  'caption',
  'code',
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // Registering these as font-size means tailwind-merge treats them as
      // mutually exclusive with each other (`text-ui text-body` → `text-body`,
      // correct) and orthogonal to colour (`text-ui text-foreground` keeps
      // both, which is the bug this fixes).
      'font-size': DS_FONT_SIZES.map((size) => `text-${size}`),
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
