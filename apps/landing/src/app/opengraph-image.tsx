import { ImageResponse } from "next/og";
import numbers from "@/data/interlace-numbers.json";

export const runtime = "edge";
export const alt =
  "Interlace — ship JavaScript with fewer bugs and less busywork. Open-source ESLint plugins, burgee CLI framework, Serverless plugins.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// This card is what a LinkedIn / X share of interlace.tools shows, so it says
// what the hero says. Brand palette only (BRAND_PHILOSOPHY §3): warm
// near-black, burnt orange hue 41 — the old purple card was off-brand.
export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background:
          "radial-gradient(ellipse at 50% 0%, #3a1a0a 0%, #120d0b 65%)",
        color: "#fafaf9",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* The two-bar mark, same geometry and dark-mode fills as
            src/components/brand-mark.tsx. */}
        <svg viewBox="0 0 100 100" width="44" height="44">
          <g transform="rotate(-30 50 50)">
            <rect x="10" y="18" width="62" height="28" rx="14" fill="#f4794a" />
            <rect x="28" y="54" width="62" height="28" rx="14" fill="#0d9460" />
          </g>
        </svg>
        <div style={{ fontSize: "32px", fontFamily: "monospace", fontWeight: 600 }}>
          interlace.tools
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: "72px",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
          }}
        >
          Ship JavaScript with
        </div>
        <div
          style={{
            fontSize: "72px",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            color: "#fbb99a",
          }}
        >
          fewer bugs and less busywork.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "28px",
          color: "rgba(250, 250, 249, 0.72)",
        }}
      >
        <span>ESLint plugins · burgee · Serverless plugins</span>
        <span style={{ fontFamily: "monospace" }}>
          {`${numbers.plugins.total} plugins · ${numbers.rules.total} rules · MIT`}
        </span>
      </div>
    </div>,
    { ...size },
  );
}
