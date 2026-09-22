import type { Metadata, Viewport } from 'next'
import { syne, poppins } from './fonts'
import { BRAND, SITE_URL, sharedOpenGraph, sharedTwitter } from './shared-metadata'
import MotionProvider from '@/components/MotionProvider'
import './globals.css'

/**
 * Brand second, what we do first.
 *
 * The title was the company name alone, which tells a search engine nothing
 * and a person scanning results only slightly more. Nobody searches for a
 * studio they have not heard of — they search for the work. The name still
 * closes the title, so the brand is present without leading with it.
 *
 * The country is in the title because the searches worth winning are local:
 * "software company Sri Lanka" is reachable in a way that "best web
 * development companies" — a phrase whose results page is entirely
 * directories and listicles — is not.
 */
const TITLE = 'Software Development Company in Sri Lanka'
/**
 * Written to be read, not to be counted. Each phrase we want to be found for
 * appears once, in a sentence that describes the business honestly — the copy
 * on the page already says the same thing.
 */
const DESCRIPTION =
  'xCalibur Labz is a software development company in Colombo, Sri Lanka. We build custom software, web applications, mobile apps and e-commerce platforms for businesses across Sri Lanka and Australia.'

export const metadata: Metadata = {
  /**
   * Next resolves every relative URL in this file — Open Graph images, canonical
   * links, the Twitter card — against this. Without it, Next warns at build time
   * and falls back to `localhost:3000`, which means a share card in production
   * points at a machine nobody else can reach.
   *
   * The apex 301-redirects to `www` (see `deploy/nginx-calibur-portfolio.conf`),
   * so `www` is the canonical origin: pointing canonicals at the apex would send
   * crawlers through a redirect on every page.
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${TITLE} | ${BRAND}`,
    // Child pages set their own title; this is the suffix they get for free.
    template: `%s | ${BRAND}`,
  },
  description: DESCRIPTION,
  applicationName: BRAND,
  /**
   * Google has ignored this since 2009. Kept only because Bing and a handful of
   * smaller crawlers still read it, and it costs one line.
   */
  keywords: [
    /* Long-tail first: these describe work already shown in `projects`, and
       almost nobody in this market is competing for them. */
    'villa booking system Sri Lanka',
    'hotel booking website development Sri Lanka',
    'online product ordering system Sri Lanka',
    'custom CMS development Sri Lanka',
    'POS system development Sri Lanka',
    'ERP system development Sri Lanka',
    'AI website assistant',
    'AI chatbot for website Sri Lanka',
    /* The head terms. Kept because they are what the business is, not
       because this tag will win them. */
    'software company Colombo',
    'web development company Sri Lanka',
  ],
  /**
   * Deliberately NOT set on the layout.
   *
   * `alternates` is merged shallowly, so a canonical declared here is inherited
   * verbatim by every child that does not override it — which would point every
   * service page at the homepage and drop it from the index. Each page declares
   * its own; the homepage's lives in `app/page.tsx`.
   */
  openGraph: {
    ...sharedOpenGraph,
    url: '/',
    title: `${TITLE} | ${BRAND}`,
    description: DESCRIPTION,
  },
  twitter: {
    ...sharedTwitter,
    title: `${TITLE} | ${BRAND}`,
    description: DESCRIPTION,
  },
  /**
   * No `openGraph.images` / `twitter.images` here on purpose. `app/opengraph-image.tsx`
   * generates the card, and file-based metadata takes priority over this object —
   * so there is no path to keep in sync and nothing to 404. The previous
   * `/images/og-image.png` did exactly that: it was referenced here and never
   * existed, so every share rendered blank.
   */
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
}

/**
 * Separate from `metadata` since Next 14 — `metadata.themeColor` is deprecated
 * and silently ignored. This tints the browser chrome on mobile to match
 * `--color-void`, so the page does not sit inside a white frame.
 */
export const viewport: Viewport = {
  themeColor: '#05070C',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  )
}
