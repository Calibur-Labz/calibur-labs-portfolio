import { ImageResponse } from 'next/og'
import { brandCard, OG_SIZE } from '@/lib/og'

/**
 * ORBI's share card.
 *
 * The page declares a `summary_large_image` Twitter card, which wants roughly
 * 1.91:1. It was being handed `/images/orbi.png` — a 1254x1254 square — so every
 * platform cropped or letterboxed it. This renders at the right ratio.
 */
export const alt = 'ORBI — an AI website companion with a personality'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    brandCard({
      eyebrow: 'Product',
      title: 'ORBI — a site companion with a personality',
      subtitle:
        'An AI assistant who greets visitors, guides them through your pages and answers questions about your business.',
    }),
    { ...size },
  )
}
