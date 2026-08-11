/**
 * `MIN_VIEWPORT` declared by a primitive (DESIGN_PRINCIPLES #14). Rendered as
 * a chip that links to the principle so reviewers can jump straight to the
 * contract.
 *
 * TONE IS A LADDER, NOT A PALETTE
 * -------------------------------
 * The three rungs are "renders everywhere" → "needs a phone-and-up" → "needs a
 * tablet-and-up". That is exactly the shape of the DS status ladder, so the
 * chips use it: `--success` / `--warning` / `--caution`. Deliberately NOT
 * `--destructive` at the top rung — a 768px floor is the least accommodating
 * option we ship, not a broken one, and `--caution` exists precisely as the
 * rung between warning and destructive.
 *
 * These used to be `emerald-` / `amber-` / `rose-` raw palette classes, which
 * broke DESIGN_PRINCIPLES #4 (token-only) on the DS's own storefront. The
 * raw version also carried a real defect: `text-amber-700` on `bg-amber-500/10`
 * measures 4.44:1 over Harbor's off-white `--background` (#f7f9fb) — under the
 * 4.5:1 AA floor. It passed review because the rung was measured over pure
 * white only, and Harbor's page surface is not white.
 *
 * Measured on the token recipe (`text-X` on `bg-X/10`), worst of 8 surfaces
 * (2 themes × 2 schemes × {background, card}):
 *
 *   token         worst   where
 *   --success     6.25    harbor · light · background
 *   --warning     6.85    harbor · dark · card
 *   --caution     7.52    harbor · light · background
 *
 * All clear AA (4.5) and AAA (7.0) except `--success` and `--warning`, which
 * clear AA with margin. `registry-contrast-lock.test.ts` recomputes these from
 * the shipped CSS on every run, so a theme edit cannot silently regress them.
 *
 * No `dark:` variants: the tokens re-resolve per scheme in the cascade, which
 * is the entire reason to use them.
 */
type Props = { value: number };

const TONE: Record<number, string> = {
  320: 'border-success/40 bg-success/10 text-success',
  480: 'border-warning/40 bg-warning/10 text-warning',
  768: 'border-caution/40 bg-caution/10 text-caution',
};

export function MinViewportBadge({ value }: Props) {
  const tone = TONE[value] ?? TONE[320];
  return (
    <span
      title={`Renders cleanly at ${value} CSS px and above. Below it, the preflight contract draws a dev-mode outline.`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs ${tone}`}
    >
      <span aria-hidden>▥</span>
      <span>≥ {value}px</span>
    </span>
  );
}
