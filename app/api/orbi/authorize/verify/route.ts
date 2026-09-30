import { NextResponse } from 'next/server'
import { verifyEmbed } from '@/lib/orbi/orbiSites'
import { findSiteBySiteId } from '@/lib/orbi/orbiSitesDb'
import { callerKey } from '@/lib/orbi/orbiRateLimit'
import { createRateLimiter } from '@/lib/rateLimit'

/**
 * Is this embed token real, and is its site still allowed?
 *
 * Called by the ORBI frame (`app/orbi/frame`), same-origin, with the token the
 * host page handed it. Answers with the origin the token was issued to; the
 * frame runs ORBI only if that is exactly the origin that framed it. The site
 * is looked up again, so disabling it takes effect on the next page load.
 *
 * No CORS headers: only ORBI's own frame has any use for this answer.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const limiter = createRateLimiter({ windowMs: 60_000, max: 60 })

function respond(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  if (!limiter.check(callerKey(request.headers)).allowed) {
    return respond({ authorized: false }, 429)
  }

  let token: unknown = null
  try {
    token = ((await request.json()) as { token?: unknown })?.token
  } catch {
    return respond({ authorized: false }, 400)
  }

  try {
    return respond(
      await verifyEmbed(token, {
        findSite: findSiteBySiteId,
        secret: process.env.SESSION_SECRET || null,
      }),
    )
  } catch (error) {
    console.error('[orbi/authorize/verify]', error instanceof Error ? error.message : error)
    return respond({ authorized: false }, 503)
  }
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
