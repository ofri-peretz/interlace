/**
 * "use client" tier indicator. Server primitives are the default in
 * @interlace/ui (DESIGN_PRINCIPLES #11); client tier is reserved for
 * interactivity / hooks / Base UI client surfaces.
 *
 * TOKENS, NOT HUES
 * ----------------
 * Was `sky-` (client) / `emerald-` (server) raw palette — a token-only
 * violation (DESIGN_PRINCIPLES #4) on the DS's own storefront. The mapping to
 * semantics is honest rather than decorative:
 *
 *   server → `--success`  the default tier; shipping server-safe is the win
 *   client → `--info`     a neutral fact about the module, not a problem
 *
 * `--info` is the right token precisely because "this is a client component"
 * is informational. Reaching for `--warning` would tell the reader that the
 * client tier is a smell, which is not what DESIGN_PRINCIPLES #11 says.
 *
 * Measured on the token recipe (`text-X` on `bg-X/10`), worst of 8 surfaces
 * (2 themes × 2 schemes × {background, card}):
 *
 *   token         worst   where
 *   --success     6.25    harbor · light · background
 *   --info        5.94    harbor · light · background
 *
 * Both clear the 4.5:1 AA floor. The raw-hue version measured 4.64 / 5.04 at
 * its worst, so this is an improvement in every one of the 8 surfaces except
 * the dark ones, where it drops from ~10:1 to ~8.4:1 — still far above AA.
 * `registry-contrast-lock.test.ts` recomputes all of it from the shipped CSS.
 *
 * No `dark:` variants: the tokens re-resolve per scheme in the cascade.
 */
type Props = { isClient: boolean };

export function ClientServerBadge({ isClient }: Props) {
  if (isClient) {
    return (
      <span
        title="Renders on the client. Includes the React 'use client' directive — required by hooks / Base UI client surfaces."
        className="border-info/40 bg-info/10 text-info inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs"
      >
        <span aria-hidden>⚡</span>
        <span>client</span>
      </span>
    );
  }
  return (
    <span
      title="Server-component-safe. Renders during SSR / RSC without hydration."
      className="border-success/40 bg-success/10 text-success inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs"
    >
      <span aria-hidden>◐</span>
      <span>server</span>
    </span>
  );
}
