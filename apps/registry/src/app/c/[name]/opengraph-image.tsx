import { ImageResponse } from "next/og";

import { categoryById, intentCategoryOf } from "@/lib/categories";
import { listItemNames, loadItem } from "@/lib/registry";

/**
 * Per-component OG card, on the brand chassis.
 *
 * Generated at build time (Node runtime — it reads the registry JSON off
 * disk), one PNG per item, so a link to any component page unfurls with that
 * component's own name, category and install command rather than a generic
 * site card.
 *
 * Chassis rules, matching the article covers: near-black forensic surface,
 * the locked two-bar mark in brand orange/green, monospace for anything a
 * reader could paste. Dark-mode brand hexes are used literally — an OG card
 * has no theme to follow.
 *
 * ponytail: the monospace runs fall back to Satori's bundled Geist Sans — no
 * mono face ships with @vercel/og. Add a `fonts:` entry with a real mono TTF
 * if the wordmark/command need to match the site exactly.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Interlace design system component";

const SURFACE = "#0d1117";
const PANEL = "#161b22";
const BORDER = "#2a313c";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";
const ORANGE = "#f4794a";
const GREEN = "#0d9460";

export async function generateStaticParams() {
  const names = await listItemNames();
  return names.map((name) => ({ name }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const item = await loadItem(name);
  const category = categoryById(intentCategoryOf(item ?? {}));
  const tier = item?.meta?.tier ?? "component";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: SURFACE,
        color: TEXT,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Mark + wordmark lockup */}
      <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        <svg width="52" height="52" viewBox="0 0 100 100">
          <g transform="rotate(-30 50 50)">
            <rect x="10" y="18" width="62" height="28" rx="14" fill={ORANGE} />
            <rect x="28" y="54" width="62" height="28" rx="14" fill={GREEN} />
          </g>
        </svg>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "30px",
            letterSpacing: "-0.02em",
          }}
        >
          interlace
        </span>
        <span style={{ color: MUTED, fontSize: "26px" }}>
          · shadcn registry
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
          {[category?.title ?? "component", tier].map((label) => (
            <span
              key={label}
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: "999px",
                padding: "6px 18px",
                color: MUTED,
                fontFamily: "monospace",
                fontSize: "22px",
              }}
            >
              {label}
            </span>
          ))}
        </div>
        <div
          style={{
            fontSize: "86px",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          {item?.title ?? name}
        </div>
      </div>

      {/* The install command — the one thing a reader might act on */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          background: PANEL,
          border: `1px solid ${BORDER}`,
          borderRadius: "14px",
          padding: "22px 28px",
          fontFamily: "monospace",
          fontSize: "26px",
        }}
      >
        <span style={{ color: ORANGE }}>$</span>
        <span style={{ color: TEXT }}>
          npx shadcn@latest add @interlace/{name}
        </span>
      </div>
    </div>,
    { ...size },
  );
}
