import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import OrbiProduct from '@/components/sections/OrbiProduct'
import MaintenanceScreen from '@/components/MaintenanceScreen'
import OrbiGuide from '@/components/orbi/OrbiGuide'
import { readSiteSettingsSafe } from '@/lib/settings'
import { orbiFaq, orbiPackages, setupPriceUsd } from '@/lib/data'
import { SITE_URL, jsonLdScript, sharedOpenGraph, sharedTwitter } from '../shared-metadata'

/**
 * The cheapest setup fee actually charged, read from the same table the page
 * prints — the offer price on a tier that has one, the list price otherwise.
 *
 * The description used to say "$490" as a literal, which is a second copy of a
 * price — and the last time this price moved, every literal copy of it went
 * stale. A meta description promising a figure the page no longer charges is
 * the worst place for that to happen, because it is what someone reads before
 * they arrive. That applies doubly to a discount: "from $490" beside a card
 * charging $390 is a description that undersells its own offer.
 */
const FROM_PRICE = Math.min(...orbiPackages.map(setupPriceUsd))

export const metadata: Metadata = {
  /*
   * "AI website companion" leads, because that is the thing someone would
   * actually type. The personality line that used to lead is still what the
   * page is about — it just is not what anyone searches for.
   */
  /*
   * No brand suffix here. The root layout's title template appends
   * "| xCalibur Labz" to every child title, so spelling it out again produced
   * "… | xCalibur Labz | xCalibur Labz" — 71 characters, most of them a
   * duplicate, in the one line a search result actually shows.
   */
  title: 'ORBI — AI Website Companion & Guide',
  description:
    `ORBI is an interactive AI website assistant: he greets visitors, guides them through your pages, and answers questions about your business. From $${FROM_PRICE}.`,
  keywords: [
    'AI website companion',
    'interactive website assistant',
    'AI website guide',
    'intelligent website assistant',
  ],
  alternates: { canonical: '/orbi' },
  /*
   * Spread rather than declared outright: metadata merges shallowly, so writing
   * a bare `openGraph` object here would drop the root's `siteName` and `locale`
   * instead of adding to them.
   *
   * No `images` — `app/orbi/opengraph-image.tsx` generates the card. It used to
   * point at `/images/orbi.png`, a 1254x1254 square handed to a card declared
   * `summary_large_image`, which every platform then cropped or letterboxed.
   */
  openGraph: {
    ...sharedOpenGraph,
    url: '/orbi',
    title: 'ORBI — an AI website companion with a personality',
    description:
      `An interactive AI assistant that guides visitors through your site and answers questions about your business. From $${FROM_PRICE}.`,
  },
  twitter: {
    ...sharedTwitter,
    title: 'ORBI — an AI website companion with a personality',
    description:
      'An interactive AI assistant that guides visitors through your site and answers questions about your business.',
  },
}

/**
 * Structured data for the product, built from the same prices the page prints.
 *
 * Generated from `orbiPackages` rather than written out, for exactly the reason
 * ORBI's own knowledge is: a second copy of a price is a copy that will
 * eventually disagree with the first, and a rich result showing a price the
 * page does not charge is worse than no rich result at all.
 *
 * Deliberately minimal. There is no `aggregateRating`, no `review`, and no
 * `availability` — ORBI has no published reviews and inventing them to earn
 * stars in a search result is fabricating a record. Everything asserted here
 * is something the page actually says: a name, a description, a category, and
 * three real offers.
 *
 * The FAQ block is the page's own questions and answers, which are real
 * copy a visitor can read, not keywords assembled for a crawler.
 */
function orbiJsonLd(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'ORBI',
        applicationCategory: 'WebApplication',
        operatingSystem: 'Web browser',
        url: `${siteUrl}/orbi`,
        description:
          'A site companion that reacts to scrolling and the cursor, guides visitors between sections, and answers questions about your business.',
        publisher: { '@type': 'Organization', name: 'xCalibur Labz', url: siteUrl },
        offers: orbiPackages.map((pkg) => ({
          '@type': 'Offer',
          name: pkg.name,
          // The setup fee, which is the figure the page leads with, at the
          // price actually charged — the offer price while one runs, since an
          // Offer must carry what a buyer pays, not a list price beside it.
          // The monthly component is described in the page copy rather than
          // encoded as a second price, because one Offer cannot honestly
          // carry both.
          price: String(setupPriceUsd(pkg)),
          priceCurrency: 'USD',
          category: 'Setup',
          url: `${siteUrl}/orbi`,
        })),
      },
      /*
       * The page's own FAQ, from the same array it renders. Google stopped
       * showing FAQ rich results for ordinary sites in 2023, so this earns no
       * dropdown in the listing — it is here because it tells a crawler what
       * the page answers, in the page's real words, and costs nothing.
       */
      {
        '@type': 'FAQPage',
        '@id': `${siteUrl}/orbi#faq`,
        mainEntity: orbiFaq.map((entry) => ({
          '@type': 'Question',
          name: entry.question,
          acceptedAnswer: { '@type': 'Answer', text: entry.answer },
        })),
      },
      // Breadcrumbs still are a supported rich result: it puts
      // "caliburlabz.com › ORBI" in the listing instead of a bare URL.
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'ORBI', item: `${siteUrl}/orbi` },
        ],
      },
    ],
  }
}

export default async function OrbiPage() {
  const { maintenance, emergencyPhone } = await readSiteSettingsSafe()

  if (maintenance) {
    return <MaintenanceScreen phone={emergencyPhone} />
  }

  return (
    <>
      <Navbar />
      {/*
        Emitted server-side, so it is in the HTML a crawler receives rather than
        something that appears after hydration. `JSON.stringify` of an object we
        built ourselves. `jsonLdScript` escapes `<` anyway: the FAQ and offer
        text is generated from `lib/data.ts`, and an escape is cheaper than
        auditing every future edit to that file for a stray tag.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(orbiJsonLd(SITE_URL)) }}
      />
      <main>
        <OrbiProduct />
      </main>
      <Footer />
      {/* The product, demonstrating itself. He has no section behaviours here —
          those are keyed to the homepage's ids — so he arrives, idles and
          reacts to the cursor, which is exactly the point of the page. */}
      <OrbiGuide />
    </>
  )
}
