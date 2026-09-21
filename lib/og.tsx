import type { ReactElement } from 'react'

/**
 * The shared artwork for every generated Open Graph card.
 *
 * Cards are generated rather than hand-designed so they cannot drift from the
 * site: a new service page gets a correct card for free, and there is no PNG to
 * forget to update. `opengraph-image` routes are statically optimized, so this
 * runs at build time and costs nothing per request.
 *
 * `ImageResponse` renders through Satori, which supports **flexbox and a subset
 * of CSS only** — no `display: grid`, no custom properties. The brand tokens are
 * therefore repeated as literals here; they mirror `@theme inline` in
 * `app/globals.css`. Every element needs an explicit `display: flex`, because
 * Satori has no block layout to fall back on.
 *
 * No custom font is loaded on purpose. Satori cannot read `next/font/google`
 * output — it needs raw font bytes off disk — and vendoring a .ttf to make the
 * headline match Syne is not worth a binary in the repo for an image nobody
 * views at full size.
 */

/** The 1.91:1 ratio LinkedIn, X, Slack and iMessage all expect. */
export const OG_SIZE = { width: 1200, height: 630 } as const

const VOID = '#05070C'
const HEADING = '#E9F1F8'
const BODY = '#93A6BC'
const ACCENT = '#00B7FF'
const ACCENT_HOVER = '#5EE9FF'

export type BrandCard = {
  /** Small label above the headline, e.g. the section the page belongs to. */
  eyebrow: string
  /** The headline. Keep it under ~60 characters or it will wrap to three lines. */
  title: string
  /** One supporting sentence. Optional — some cards read better without one. */
  subtitle?: string
}

/** Build the card body passed to `new ImageResponse(...)`. */
export function brandCard({ eyebrow, title, subtitle }: BrandCard): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 88px',
        background: VOID,
        // Stands in for the hero's radial glow, which Satori cannot render.
        backgroundImage: `linear-gradient(135deg, ${VOID} 0%, #0A0F16 55%, #0C1826 100%)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div
          style={{
            display: 'flex',
            width: 14,
            height: 14,
            borderRadius: 7,
            background: ACCENT,
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: BODY,
          }}
        >
          {eyebrow}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          fontSize: 76,
          fontWeight: 800,
          lineHeight: 1.08,
          letterSpacing: -2,
          color: HEADING,
          maxWidth: 940,
        }}
      >
        {title}
      </div>

      {subtitle ? (
        <div
          style={{
            display: 'flex',
            marginTop: 30,
            fontSize: 32,
            lineHeight: 1.45,
            color: BODY,
            maxWidth: 880,
          }}
        >
          {subtitle}
        </div>
      ) : null}

      <div style={{ display: 'flex', marginTop: 'auto', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            width: 64,
            height: 5,
            borderRadius: 3,
            backgroundImage: `linear-gradient(90deg, ${ACCENT} 0%, ${ACCENT_HOVER} 100%)`,
          }}
        />
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: HEADING }}>
          <span style={{ color: ACCENT }}>x</span>Calibur Labz
        </div>
      </div>
    </div>
  )
}
