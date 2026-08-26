import type { MetadataRoute } from 'next'

/**
 * What crawlers may look at.
 *
 * Two things are deliberately closed: the admin area behind `/buddhima`, which
 * is a private console and has no business in an index, and `/api`, which
 * answers JSON to the site's own scripts and would only ever produce useless
 * results. Everything else is open — this is a portfolio, and being found is
 * the entire point.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://www.caliburlabz.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/buddhima', '/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
