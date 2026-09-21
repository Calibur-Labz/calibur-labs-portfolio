import { ImageResponse } from 'next/og'
import { brandCard, OG_SIZE } from '@/lib/og'
import { services } from '@/lib/data'
import { getServiceBySlug } from '@/lib/services'

/**
 * A share card per service, generated at build time from the same copy the page
 * uses. A new service in `lib/data.ts` gets a correct card without anyone
 * opening a design tool.
 */
/*
 * The image route needs its own `generateStaticParams` — it does not inherit the
 * one on `page.tsx`. Without it the six cards are rendered on demand, which
 * means a crawler or a link unfurler waits on Satori instead of being handed a
 * cached PNG.
 */
export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }))
}

export const alt = 'xCalibur Labz service'
export const size = OG_SIZE
export const contentType = 'image/png'

// In Next 16 `params` on an image route is a Promise and must be awaited.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const service = getServiceBySlug(slug)

  return new ImageResponse(
    brandCard({
      eyebrow: service?.title ?? 'Services',
      title: service?.h1 ?? 'Custom software, built properly',
      subtitle: service?.description,
    }),
    { ...size },
  )
}
