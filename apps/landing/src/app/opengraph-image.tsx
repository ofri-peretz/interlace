import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Interlace — TypeScript-native developer tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "80px",
        background:
          "linear-gradient(135deg, #0f0a1a 0%, #1a0f2e 60%, #2d1b4d 100%)",
        color: "white",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "8px 20px",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          borderRadius: "999px",
          background: "rgba(124, 58, 237, 0.18)",
          color: "#c4b5fd",
          fontSize: "24px",
          marginBottom: "32px",
        }}
      >
        interlace.tools
      </div>
      <div
        style={{
          fontSize: "88px",
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          marginBottom: "24px",
        }}
      >
        TypeScript-native
        <br />
        <span style={{ color: "#a78bfa" }}>developer tools.</span>
      </div>
      <div
        style={{
          fontSize: "32px",
          color: "rgba(255, 255, 255, 0.72)",
          maxWidth: "900px",
          lineHeight: 1.3,
        }}
      >
        ESLint plugins · Serverless plugins · Every claim measured.
      </div>
    </div>,
    { ...size },
  );
}
