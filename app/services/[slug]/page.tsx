import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ServiceDetail from '@/components/sections/ServiceDetail'
import MaintenanceScreen from '@/components/MaintenanceScreen'
import { readSiteSettingsSafe } from '@/lib/settings'
import { services } from '@/lib/data'
import { getServiceBySlug } from '@/lib/services'
import { BRAND, SITE_URL, jsonLdScript, sharedOpenGraph, sharedTwitter } from '../../shared-metadata'

/**
 * A page per service.
 *
 * Until now the six services were `#services` anchors on the homepage, which
 * meant one URL trying to rank for six unrelated searches — "web development",
 * "POS system", "AI integration" — and ranking for none of them. Each service
 * now has its own URL, title, description, canonical and structured data.
 *
 * Every one of the six is prerendered at build time: the content comes from
 * `lib/data.ts` and never varies by request, so there is no reason for a
 * crawler to wait on a render.
 */

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }))
}

/**
 * Anything not in `lib/data.ts` is a 404 rather than a generated page. Without
 * this, `/services/anything-at-all` would render and be indexable.
 */
export const dynamicParams = false

export async function generateMetadata({
  params,
}: PageProps<'/services/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const service = getServiceBySlug(slug)

  if (!service) return {}

  const url = `/services/${service.slug}`

  return {
    // The root layout's template appends " | xCalibur Labz".
    title: service.metaTitle,
    description: service.metaDescription,
    alternates: { canonical: url },
    // Spread, not replaced — a bare object here would drop `siteName` and
    // `locale` from the root rather than adding to them.
    openGraph: {
      ...sharedOpenGraph,
      url,
      title: `${service.metaTitle} | ${BRAND}`,
      description: service.metaDescription,
    },
    twitter: {
      ...sharedTwitter,
      title: `${service.metaTitle} | ${BRAND}`,
      description: service.metaDescription,
    },
  }
}

/**
 * The structured data for one service.
 *
 * `provider` points at the `@id` the homepage already publishes, so Google
 * resolves these to the same company rather than reading each page as a
 * separate business. The FAQ nodes are generated from the same array the page
 * renders, so a rich result can never show an answer the page does not give.
 *
 * No `Offer` and no `aggregateRating`: there is no published price for these
 * services and no verified review corpus, and inventing either is a fabrication
 * that happens to be machine-readable.
 */
function serviceJsonLd(service: ReturnType<typeof getServiceBySlug> & object) {
  const url = `${SITE_URL}/services/${service.slug}`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: service.metaTitle,
        description: service.metaDescription,
        serviceType: service.title,
        url,
        provider: { '@id': `${SITE_URL}/#organization` },
        areaServed: [
          { '@type': 'Country', name: 'Sri Lanka' },
          { '@type': 'Country', name: 'Australia' },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: service.faq.map((entry) => ({
          '@type': 'Question',
          name: entry.q,
          acceptedAnswer: { '@type': 'Answer', text: entry.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE_URL}/services` },
          { '@type': 'ListItem', position: 3, name: service.title, item: url },
        ],
      },
    ],
  }
}

export default async function ServicePage({ params }: PageProps<'/services/[slug]'>) {
  const { slug } = await params
  const service = getServiceBySlug(slug)

  if (!service) notFound()

  const { maintenance, emergencyPhone } = await readSiteSettingsSafe()
  if (maintenance) return <MaintenanceScreen phone={emergencyPhone} />

  return (
    <>
      <Navbar />
      {/* Server-rendered, so it is in the HTML a crawler receives. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(serviceJsonLd(service)) }}
      />
      <main>
        <ServiceDetail service={service} />
      </main>
      <Footer />
    </>
  )
}
