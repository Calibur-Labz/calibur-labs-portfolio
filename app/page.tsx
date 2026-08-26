import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Hero from '@/components/sections/Hero'
import Services from '@/components/sections/Services'
import About from '@/components/sections/About'
import BuildWithPrecision from '@/components/sections/BuildWithPrecision'
import WhyChooseUs from '@/components/sections/WhyChooseUs'
import Projects from '@/components/sections/Projects'
import Testimonials from '@/components/sections/Testimonials'
import Contact from '@/components/sections/Contact'
import MaintenanceScreen from '@/components/MaintenanceScreen'
import HashScroll from '@/components/HashScroll'
import OrbiGuide from '@/components/orbi/OrbiGuide'
import { readSiteSettingsSafe } from '@/lib/settings'

/**
 * Who runs this site, in the form a search engine reads.
 *
 * Every field below is already printed in the footer for a human to read — the
 * email, the phone, the city, the LinkedIn page. Nothing here is asserted that
 * a visitor cannot verify by scrolling to the bottom of the page, which is the
 * line between describing a business and inventing one.
 *
 * Deliberately absent: `aggregateRating`, `review`, `award`, `foundingDate`,
 * `numberOfEmployees`, and any `Offer` — the homepage sells services with no
 * published price, and a schema that claims otherwise is a fabrication that
 * happens to be machine-readable.
 *
 * `WebSite` carries no `SearchAction`: there is no site search, and describing
 * one that does not exist would send crawlers to a URL that 404s.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://www.caliburlabz.com'

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'xCalibur Labz',
      url: SITE_URL,
      logo: `${SITE_URL}/images/logo.png`,
      email: 'caliburlabz@gmail.com',
      telephone: '+94765831021',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Galle',
        addressCountry: 'LK',
      },
      sameAs: ['https://www.linkedin.com/company/calibur-labs'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'xCalibur Labz',
      url: SITE_URL,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en',
    },
  ],
}

// Read the maintenance flag fresh on every request so toggling it from the
// admin console takes effect immediately.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const { maintenance, emergencyPhone } = await readSiteSettingsSafe()

  if (maintenance) {
    return <MaintenanceScreen phone={emergencyPhone} />
  }

  return (
    <>
      <Navbar />
      <HashScroll />
      {/* Server-rendered, so it is in the HTML a crawler receives. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />
      <main>
        <Hero />
        <Services />
        <About />
        <BuildWithPrecision />
        <WhyChooseUs />
        <Projects />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
      {/* ORBI — the site companion. Wrapping nothing today; wrap the page in
          Phase 2 if sections need `useOrbi()` to drive it from scroll. */}
      <OrbiGuide />
    </>
  )
}
