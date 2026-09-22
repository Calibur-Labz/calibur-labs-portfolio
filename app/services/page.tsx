import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import SectionLabel from '@/components/ui/SectionLabel'
import GradientText from '@/components/ui/GradientText'
import MaintenanceScreen from '@/components/MaintenanceScreen'
import { readSiteSettingsSafe } from '@/lib/settings'
import { services } from '@/lib/data'
import { BRAND, SITE_URL, jsonLdScript, sharedOpenGraph, sharedTwitter } from '../shared-metadata'

/**
 * The services hub.
 *
 * Two jobs: it is the page someone lands on searching for the company's range
 * rather than one specific service, and it is the internal link hub that gives
 * the six service pages a parent. Without it each service page would hang off
 * the homepage with no route between them.
 */

const TITLE = 'Software Development Services'
const DESCRIPTION =
  'Web and mobile development, UI/UX design, cloud and DevOps, AI integration and custom CMS, ERP and POS systems — built by xCalibur Labz in Colombo, Sri Lanka.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/services' },
  openGraph: {
    ...sharedOpenGraph,
    url: '/services',
    title: `${TITLE} | ${BRAND}`,
    description: DESCRIPTION,
  },
  twitter: {
    ...sharedTwitter,
    title: `${TITLE} | ${BRAND}`,
    description: DESCRIPTION,
  },
}

/**
 * `ItemList` tells a crawler these six pages are one set rather than six
 * unrelated URLs that happen to share a prefix.
 */
const hubJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}/services#page`,
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/services`,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'ItemList',
      '@id': `${SITE_URL}/services#list`,
      itemListElement: services.map((service, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: service.title,
        url: `${SITE_URL}/services/${service.slug}`,
      })),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}/services#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE_URL}/services` },
      ],
    },
  ],
}

export default async function ServicesPage() {
  const { maintenance, emergencyPhone } = await readSiteSettingsSafe()
  if (maintenance) return <MaintenanceScreen phone={emergencyPhone} />

  return (
    <>
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(hubJsonLd) }}
      />
      <main>
        <section style={{ background: '#05070C', padding: '150px 0 70px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
            <SectionLabel>What We Build</SectionLabel>
            <GradientText
              as="h1"
              style={{
                display: 'block',
                fontSize: 'clamp(30px, 5vw, 52px)',
                fontWeight: 800,
                lineHeight: 1.12,
                letterSpacing: '-0.03em',
                margin: '0 0 24px',
                maxWidth: '760px',
                textWrap: 'balance',
              }}
            >
              End-to-end software development services
            </GradientText>
            <p
              style={{
                fontSize: '18px',
                lineHeight: 1.78,
                color: '#93A6BC',
                maxWidth: '680px',
                margin: 0,
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              }}
            >
              Six things we do, and what each one actually involves. We work with
              clients across Sri Lanka and Australia — from a first build to the
              system a business runs on.
            </p>
          </div>
        </section>

        <section style={{ background: '#0A0F16', padding: '10px 0 90px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
            <div
              style={{
                display: 'grid',
                gap: '18px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                paddingTop: '50px',
              }}
            >
              {services.map((service) => (
                <Link
                  key={service.id}
                  href={`/services/${service.slug}`}
                  className="service-hub-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '28px',
                    borderRadius: '16px',
                    background: '#0C121C',
                    border: '1px solid #17222F',
                    textDecoration: 'none',
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: '26px', color: '#00B7FF', marginBottom: '16px' }}>
                    {service.icon}
                  </span>
                  <h2
                    style={{
                      margin: '0 0 10px',
                      fontSize: '20px',
                      fontWeight: 700,
                      color: '#E9F1F8',
                      fontFamily: 'var(--font-syne), system-ui, sans-serif',
                    }}
                  >
                    {service.title}
                  </h2>
                  <p
                    style={{
                      margin: '0 0 18px',
                      color: '#93A6BC',
                      fontSize: '15px',
                      lineHeight: 1.7,
                      fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                    }}
                  >
                    {service.description}
                  </p>
                  <span
                    style={{
                      marginTop: 'auto',
                      color: '#00B7FF',
                      fontSize: '14px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                    }}
                  >
                    Read more →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
