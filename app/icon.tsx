import { ImageResponse } from 'next/og'

/**
 * The favicon mark.
 *
 * This replaces `app/icon.png`, which was the full 331x220 wordmark. Next emits
 * whatever it finds as `<link rel="icon" sizes="331x220">`, so browsers were
 * shrinking a wide logo into a square tab slot and rendering it as a smear. The
 * "x" is the same glyph the hero accents in `components/sections/Hero.tsx`, so
 * the tab reads as the brand at 16px.
 */
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#05070C',
          color: '#00B7FF',
          fontSize: 24,
          fontWeight: 700,
        }}
      >
        x
      </div>
    ),
    { ...size },
  )
}
