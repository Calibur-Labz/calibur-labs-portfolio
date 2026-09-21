/**
 * Metadata fragments shared across route segments.
 *
 * Next merges metadata from parent to child **shallowly**, replacing duplicate
 * keys outright. So a page that sets `openGraph: { title }` does not inherit the
 * root's `siteName` and `type` — it erases them. Spreading these constants keeps
 * that from being a silent, invisible regression on every new page.
 */

export const BRAND = 'xCalibur Labz'

/**
 * The production origin, and the value `metadataBase` resolves relative URLs
 * against. Overridable so a preview deployment describes itself honestly rather
 * than claiming to be production; not a secret, which is why `NEXT_PUBLIC_` is
 * correct here.
 *
 * Read at build time — see the note in `deploy/deploy.sh`.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://www.caliburlabz.com'

/** Spread into every page's `openGraph`, never set as a bare object. */
export const sharedOpenGraph = {
  type: 'website',
  siteName: BRAND,
  locale: 'en',
} as const

/** Spread into every page's `twitter`. */
export const sharedTwitter = {
  card: 'summary_large_image',
} as const

/**
 * Escape a JSON-LD payload before it goes into `dangerouslySetInnerHTML`.
 *
 * `JSON.stringify` does not neutralise a `</script>` sequence, so any string
 * that reaches the schema graph could close the tag and inject markup. Today
 * every value is a literal in `lib/data.ts`, but service and FAQ schema are
 * generated from that data, and the cost of being right is one replace.
 */
export function jsonLdScript(payload: unknown): string {
  return JSON.stringify(payload).replace(/</g, '\\u003c')
}
