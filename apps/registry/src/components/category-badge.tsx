import { categoryById } from '@/lib/categories';

/**
 * Categorical hues, deliberately NOT the semantic status tokens — a category
 * is not a state, and mapping `blog` onto `--destructive` would be a lie the
 * colour tells.
 *
 * WHY THIS FILE IS THE ONE RAW-PALETTE EXCEPTION IN THE REGISTRY
 * -------------------------------------------------------------
 * Every other chip on the storefront moved to semantic tokens (see
 * `min-viewport-badge.tsx`, `client-server-badge.tsx`). This one cannot, and
 * the reason is cardinality, not laziness:
 *
 *   - The status family (`--success` / `--warning` / `--caution` / `--info` /
 *     `--destructive`) is a LADDER of five severities. The category taxonomy
 *     is ten unordered peers. Ranking `form` above `navigation` is meaningless.
 *   - The DS *does* ship a categorical family — `--chart-1..5` — but it is
 *     five slots for ten categories, and it is tuned for series MARKS (a
 *     stroke or fill on the card), not for text. Measured: `text-chart-2` on
 *     `bg-chart-2/10` is 3.86:1 (interlace · light) and 3.69:1 (harbor ·
 *     light) — both under the 4.5:1 AA floor. `overlay` shipped exactly that
 *     pair and was failing AA in light mode in both themes. It is fixed below.
 *   - `--viz-*` is chart chrome (grid / axis / edge / crosshair) and direction
 *     (positive / negative / neutral). None of it is a category vocabulary.
 *
 * So: the DS has no AA-safe ten-slot categorical TEXT token family, and
 * inventing one is a design-system decision, not a storefront cleanup. Until
 * that family exists, these stay raw hues and `registry-contrast-lock.test.ts`
 * measures every one of them against every surface we ship.
 *
 * RUNGS
 * -----
 * Light text is `-700`, dark `-300`, tint `-500/10`. Measured worst-case
 * across 8 surfaces (2 themes × 2 schemes × {background, card}):
 *
 *   emerald 4.64   blue 5.78   indigo 6.78   teal 4.65   cyan 4.60
 *   rose 4.93      violet 6.09  pink 4.90    amber-800 6.26
 *
 * Two fixes over the previous revision, both real AA failures:
 *   - `feedback` was `amber-700` → 4.44:1 on harbor · light · background.
 *     The old lock asserted the `-700` rung, but derived it over pure white;
 *     Harbor's page surface is #f7f9fb, and amber has no margin. Now `-800`.
 *   - `overlay` was `text-chart-2` → 3.86 / 3.69:1 in light (see above).
 *     Now `indigo`, the highest-scoring free hue at 6.78:1 worst-case.
 *
 * If you add a hue: run the lock. Six of nine failed at `-600` once already,
 * and one failed at `-700` on a non-white page. The palette default is not a
 * safe assumption here, and neither is "it passed on white".
 */
const TONE: Record<string, string> = {
  // The one genuine token: `foundation` IS the brand-primary category.
  // Measured 7.15:1 worst-case (harbor · light · background).
  foundation: 'border-primary/40 bg-primary/10 text-primary',
  a11y: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  form: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  overlay:
    'border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  feedback: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  navigation: 'border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  data: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  blog: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  marketing:
    'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  decorative: 'border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300',
};

const NEUTRAL = 'border-border bg-card text-muted-foreground';

type Props = { categoryId: string };

export function CategoryBadge({ categoryId }: Props) {
  const cat = categoryById(categoryId);
  if (!cat) return null;
  return (
    <span
      title={cat.description}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs ${TONE[categoryId] ?? NEUTRAL}`}
    >
      {cat.title.toLowerCase()}
    </span>
  );
}
