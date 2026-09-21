import { ImageResponse } from 'next/og'
import { brandCard, OG_SIZE } from '@/lib/og'

/**
 * The homepage share card.
 *
 * This replaces `metadata.openGraph.images`, which pointed at
 * `/images/og-image.png` — a file that never existed, so every share of the
 * homepage rendered with no image. File-based metadata takes priority over the
 * `metadata` object, and it cannot go stale the way a hardcoded path can.
 */
export const alt = 'xCalibur Labz — custom software and web development'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    brandCard({
      eyebrow: 'Software Studio',
      title: 'We build software that drives results.',
      subtitle:
        'Custom software, web apps and e-commerce platforms — from first idea to launch.',
    }),
    { ...size },
  )
}
