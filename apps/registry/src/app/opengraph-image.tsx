import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt =
  'Interlace UI — accessible React components for shadcn, tested in dark mode and right-to-left.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Same palette and mark as the interlace.tools card, so a shared ds link reads as part of Interlace.
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        background:
          'radial-gradient(ellipse at 50% 0%, #3a1a0a 0%, #120d0b 65%)',
        color: '#fafaf9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <svg viewBox="0 0 100 100" width="44" height="44">
          <g transform="rotate(-30 50 50)">
            <rect x="10" y="18" width="62" height="28" rx="14" fill="#f4794a" />
            <rect x="28" y="54" width="62" height="28" rx="14" fill="#0d9460" />
          </g>
        </svg>
        <div
          style={{ fontSize: '32px', fontFamily: 'monospace', fontWeight: 600 }}
        >
          ds.interlace.tools
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontSize: '72px',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
          }}
        >
          Interlace UI
        </div>
        <div
          style={{
            fontSize: '44px',
            fontWeight: 600,
            lineHeight: 1.15,
            marginTop: '16px',
            color: '#fbb99a',
          }}
        >
          Accessible React components for shadcn.
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: '28px',
          color: 'rgba(250, 250, 249, 0.72)',
        }}
      >
        Tested in dark mode and right-to-left · MIT · part of interlace.tools
      </div>
    </div>,
    { ...size },
  );
}
