/**
 * The canonical Interlace two-bar mark.
 *
 * Inlined rather than imported because this app consumes the synced
 * `.interlace/` baseline, not `@interlace/ui` — and this app's baseline copy
 * predates the one that exports `InterlaceMark`. Geometry is identical to
 * `packages/ui/src/patterns/brand-logo.tsx`; bar fills read the
 * `--brand-mark-bar-*` tokens from global.css so the pair stays AA-safe in
 * both themes.
 *
 * Extracted from layout.shared.tsx so the nav lockup and the 404 page cannot
 * drift apart. Delete this in favour of the baseline export once the landing
 * app's `.interlace/` is resynced.
 */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      <g transform="rotate(-30 50 50)">
        <rect
          x="10"
          y="18"
          width="62"
          height="28"
          rx="14"
          fill="var(--brand-mark-bar-o)"
        />
        <rect
          x="28"
          y="54"
          width="62"
          height="28"
          rx="14"
          fill="var(--brand-mark-bar-g)"
        />
      </g>
    </svg>
  );
}
