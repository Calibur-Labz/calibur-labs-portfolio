import { ImageResponse } from 'next/og'

/**
 * The home-screen icon iOS uses when someone saves the site.
 *
 * Apple does not round-trip transparency or padding well, so this fills the
 * whole 180x180 with the brand surface rather than leaving the OS to letterbox
 * a logo on white.
 */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: 'linear-gradient(135deg, #05070C 0%, #0C1826 100%)',
          color: '#00B7FF',
          fontSize: 116,
          fontWeight: 700,
        }}
      >
        x
      </div>
    ),
    { ...size },
  )
}
