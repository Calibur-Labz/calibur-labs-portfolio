import { services, type Service } from './data'

/**
 * Lookups for the `/services` routes.
 *
 * Both the page, its metadata, its share card and the sitemap resolve slugs
 * through here, so there is one definition of "which services exist" and adding
 * one to `lib/data.ts` is enough to publish it everywhere.
 */

/** Every service slug, in the order they appear on the homepage. */
export const serviceSlugs = services.map((service) => service.slug)

/** The service for a slug, or `undefined` so the caller can `notFound()`. */
export function getServiceBySlug(slug: string): Service | undefined {
  return services.find((service) => service.slug === slug)
}
