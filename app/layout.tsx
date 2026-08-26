import type { Metadata } from 'next'
import { syne, poppins } from './fonts'
import MotionProvider from '@/components/MotionProvider'
import './globals.css'

/**
 * The production origin, and the reason `metadataBase` exists.
 *
 * Next resolves every relative URL in this file — Open Graph images, canonical
 * links, the Twitter card — against this. Without it, Next warns at build time
 * and falls back to `localhost:3000`, which means a share card in production
 * points at a machine nobody else can reach.
 *
 * The apex 307-redirects to `www`, so `www` is the canonical origin: pointing
 * canonicals at the apex would send crawlers through a redirect on every page.
 *
 * Overridable so a preview deployment can describe itself honestly rather than
 * claiming to be production. Not a secret — it is the address of a public
 * website — which is why `NEXT_PUBLIC_` is correct here and never for a key.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://www.caliburlabz.com'

/**
 * Brand second, what we do first.
 *
 * The title was the company name alone, which tells a search engine nothing
 * and a person scanning results only slightly more. Nobody searches for a
 * studio they have not heard of — they search for the work. The name still
 * closes the title, so the brand is present without leading with it.
 */
const TITLE = 'Custom Software & Web Development'
const BRAND = 'xCalibur Labz'
/**
 * Written to be read, not to be counted. Each phrase we want to be found for
 * appears once, in a sentence that describes the business honestly — the copy
 * on the page already says the same thing.
 */
const DESCRIPTION =
  'xCalibur Labz builds custom software, web apps and e-commerce platforms for growing businesses — from first idea to launch. Based in Galle, Sri Lanka.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${TITLE} | ${BRAND}`,
    // Child pages set their own title; this is the suffix they get for free.
    template: `%s | ${BRAND}`,
  },
  description: DESCRIPTION,
  applicationName: BRAND,
  keywords: [
    'software development',
    'web development',
    'custom software',
    'e-commerce development',
    'digital products',
    'Sri Lanka',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: BRAND,
    url: '/',
    title: `${TITLE} | ${BRAND}`,
    description: DESCRIPTION,
    images: [{ url: '/images/og-image.png', width: 1200, height: 630, alt: BRAND }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} | ${BRAND}`,
    description: DESCRIPTION,
    images: ['/images/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
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
