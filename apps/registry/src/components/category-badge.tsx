import { categoryById } from "@/lib/categories";

const TONE: Record<string, string> = {
  foundation: "border-primary/40 bg-primary/10 text-primary",
  a11y: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  form: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  overlay: "border-chart-2/40 bg-chart-2/10 text-chart-2",
  feedback:
    "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  navigation:
    "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-300",
  data: "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  blog: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  marketing:
    "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  decorative:
    "border-pink-500/40 bg-pink-500/10 text-pink-600 dark:text-pink-300",
};

const NEUTRAL = "border-border bg-card text-muted-foreground";

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
