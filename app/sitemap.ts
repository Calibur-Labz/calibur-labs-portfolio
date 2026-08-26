import type { MetadataRoute } from 'next'

/**
 * The two pages worth indexing.
 *
 * Listed by hand rather than crawled: the app has exactly two public routes,
 * and a generated sitemap would need a filter to keep the admin console out —
 * a filter that fails open the day somebody adds a route. Two literals cannot
 * leak a private page by accident.
 *
 * No `lastModified`: a date that is really "whenever this deployed" is worse
 * than no date, because it tells crawlers every page changed on every deploy.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://www.caliburlabz.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/orbi`, changeFrequency: 'monthly', priority: 0.8 },
  ]
}
