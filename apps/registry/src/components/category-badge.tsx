import { categoryById } from '@/lib/categories';

/**
 * Categorical hues, deliberately NOT the semantic status tokens — a category
 * is not a state, and mapping `blog` onto `--destructive` would be a lie the
 * colour tells.
 *
 * Light-mode text is `-700`, not `-600`. Measured on the real page: `-600` on
 * its own `/10` tint scores 2.94–3.98:1, under the 4.5:1 AA floor for body
 * text, i.e. every one of these chips was failing. `-700` lands at 4.66–5.29:1
 * across all nine hues. Dark mode stays `-300` (9.35–11.66:1).
 *
 * If you add a hue: check it at `/10` tint before shipping. Six of the nine
 * failed at `-600`, so the palette default is not a safe assumption here.
 */
const TONE: Record<string, string> = {
  foundation: 'border-primary/40 bg-primary/10 text-primary',
  a11y: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  form: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  overlay: 'border-chart-2/40 bg-chart-2/10 text-chart-2',
  feedback: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
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
