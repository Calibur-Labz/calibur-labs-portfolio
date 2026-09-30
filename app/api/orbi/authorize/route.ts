import { NextResponse } from 'next/server'
import { authorizeEmbed } from '@/lib/orbi/orbiSites'
import { findSiteBySiteId } from '@/lib/orbi/orbiSitesDb'
import { callerKey } from '@/lib/orbi/orbiRateLimit'
import { createRateLimiter } from '@/lib/rateLimit'

/**
 * May ORBI run on this website?
 *
 * Called by `public/orbi/embed.js` from the customer's page, cross-origin.
 * The website is identified by the browser's `Origin` header — never by
 * anything in the body — and compared exactly against the site's registered
 * origins (`lib/orbi/orbiSites.ts`). The answer is `{ authorized: false }` or
 * `{ authorized: true, token }`; nothing about the site or its customer ever
 * goes back.
 *
 * The request is a CORS "simple request" (POST, text/plain), so there is no
 * preflight. The response names the caller's own origin as allowed to read it,
 * which reveals nothing: it only ever says yes or no about that origin.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** A page view is one call. Generous for real traffic, useless for guessing. */
const limiter = createRateLimiter({ windowMs: 60_000, max: 60 })

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'cache-control': 'no-store', vary: 'Origin' }
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) headers['access-control-allow-origin'] = origin
  return headers
}

function respond(body: object, origin: string | null, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (!limiter.check(callerKey(request.headers)).allowed) {
    return respond({ authorized: false }, origin, 429)
  }

  let siteId: unknown = null
  try {
    // text/plain on the wire, JSON inside — see above.
    siteId = (JSON.parse(await request.text()) as { siteId?: unknown })?.siteId
  } catch {
    return respond({ authorized: false }, origin, 400)
  }

  try {
    const result = await authorizeEmbed(
      { siteId, origin },
      { findSite: findSiteBySiteId, secret: process.env.SESSION_SECRET || null },
    )
    return respond(result, origin)
  } catch (error) {
    // A database outage fails closed, and says nothing about why.
    console.error('[orbi/authorize]', error instanceof Error ? error.message : error)
    return respond({ authorized: false }, origin, 503)
  }
}

/** Only reached if a browser preflights anyway; embed.js never needs it. */
export function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(request.headers.get('origin')),
      'access-control-allow-methods': 'POST',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '600',
    },
  })
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
