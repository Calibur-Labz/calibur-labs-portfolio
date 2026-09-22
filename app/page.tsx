import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Hero from '@/components/sections/Hero'
import Services from '@/components/sections/Services'
import About from '@/components/sections/About'
import BuildWithPrecision from '@/components/sections/BuildWithPrecision'
import WhyChooseUs from '@/components/sections/WhyChooseUs'
import Projects from '@/components/sections/Projects'
import GlobalReach from '@/components/sections/GlobalReach'
import Testimonials from '@/components/sections/Testimonials'
import Contact from '@/components/sections/Contact'
import MaintenanceScreen from '@/components/MaintenanceScreen'
import HashScroll from '@/components/HashScroll'
import OrbiGuide from '@/components/orbi/OrbiGuide'
import { readSiteSettingsSafe } from '@/lib/settings'
import { services } from '@/lib/data'
import { BRAND, SITE_URL, jsonLdScript, sharedOpenGraph } from './shared-metadata'

/**
 * The homepage canonical.
 *
 * Declared here rather than on the root layout: `alternates` merges shallowly,
 * so a canonical on the layout is inherited verbatim by every page that forgets
 * to override it, pointing the whole site at `/`.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { ...sharedOpenGraph, url: '/' },
}

/**
 * Who runs this site, in the form a search engine reads.
 *
 * Every field below is already printed on the page for a human to read — the
 * email, the phone, the city, the LinkedIn page, the founding year in the hero
 * stats, the two client countries on the Global Reach map. Nothing here is
 * asserted that a visitor cannot verify by scrolling, which is the line between
 * describing a business and inventing one.
 *
 * `ProfessionalService` rather than plain `Organization`: it is a LocalBusiness
 * subtype, so it carries `areaServed` and the address as local-business signals
 * instead of generic company metadata. The `@id` is unchanged, so every node
 * that already references `#organization` still resolves.
 *
 * Deliberately absent: `aggregateRating`, `review`, `award` and any `Offer` —
 * the homepage sells services with no published price, and there is no verified
 * review corpus. A schema that claims otherwise is a fabrication that happens to
 * be machine-readable.
 *
 * `WebSite` carries no `SearchAction`: there is no site search, and describing
 * one that does not exist would send crawlers to a URL that 404s.
 */
const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'ProfessionalService',
      '@id': `${SITE_URL}/#organization`,
      name: BRAND,
      /**
       * The spellings people actually type.
       *
       * The brand has a lowercase x, a z where an s is expected, and a word
       * ("Calibur") that autocorrect pulls toward "Caliber" — so someone who
       * has heard the name once will as often as not search for something
       * that is not it. `alternateName` is the supported way to tell a search
       * engine these all denote one entity, and it does that without putting
       * a single misspelling in front of a human reader.
       *
       * Every entry is a real variant of the name, not a keyword: the domain
       * is caliburlabz.com and the LinkedIn page is /calibur-labs, so the
       * shorter forms are already how this company gets addressed.
       */
      alternateName: [
        'Calibur Labz',
        'Calibur Labs',
        'xCalibur Labs',
        'Caliber Labs',
        'Calibur Lab',
        'Calibur',
      ],
      url: SITE_URL,
      // The wordmark that actually ships. This previously pointed at
      // `/images/logo.png`, which does not exist in `public/` and 404'd.
      logo: `${SITE_URL}/images/logoN.png`,
      image: `${SITE_URL}/images/logoN.png`,
      description:
        'xCalibur Labz builds custom software, web apps and e-commerce platforms for growing businesses — from first idea to launch.',
      email: 'caliburlabz@gmail.com',
      telephone: '+94765831021',
      foundingDate: '2026',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Colombo',
        addressCountry: 'LK',
      },
      // The two countries the Global Reach map marks, and only those.
      areaServed: [
        { '@type': 'Country', name: 'Sri Lanka' },
        { '@type': 'Country', name: 'Australia' },
      ],
      knowsAbout: services.map((service) => service.title),
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: 'caliburlabz@gmail.com',
        telephone: '+94765831021',
        areaServed: ['LK', 'AU'],
        availableLanguage: ['en', 'si'],
      },
      sameAs: ['https://www.linkedin.com/company/calibur-labs'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: BRAND,
      url: SITE_URL,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en',
    },
  ],
}

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
        dangerouslySetInnerHTML={{ __html: jsonLdScript(siteJsonLd) }}
      />
      <main>
        <Hero />
        <Services />
        <About />
        <BuildWithPrecision />
        <WhyChooseUs />
        <Projects />
        <GlobalReach />
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
