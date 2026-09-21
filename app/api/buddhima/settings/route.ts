import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { dbErrorResponse } from '@/lib/db'
import { getSession } from '@/lib/require-auth'
import { SETTINGS_CACHE_TAG, getSiteSettings, setSiteSettings } from '@/lib/settings'

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const settings = await getSiteSettings()
    return NextResponse.json({ settings })
  } catch (e) {
    return dbErrorResponse(e)
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const patch: { maintenance?: boolean; emergencyPhone?: string } = {}

  if (body.maintenance !== undefined) {
    if (typeof body.maintenance !== 'boolean') {
      return NextResponse.json({ error: 'maintenance must be a boolean' }, { status: 400 })
    }
    patch.maintenance = body.maintenance
  }

  if (body.emergencyPhone !== undefined) {
    const phone = String(body.emergencyPhone).trim()
    if (!phone) {
      return NextResponse.json({ error: 'Emergency phone cannot be empty' }, { status: 400 })
    }
    patch.emergencyPhone = phone
  }

  try {
    const settings = await setSiteSettings(patch)
    /*
     * The public pages read these through a tagged cache so they can prerender.
     * Without this the maintenance toggle would appear to do nothing until the
     * cache happened to expire.
     *
     * `{ expire: 0 }` rather than the recommended `'max'` profile: `'max'` is
     * stale-while-revalidate, which would keep serving the live site to the
     * next visitor after someone hits the maintenance switch. Maintenance mode
     * is the one setting where "eventually" is the wrong answer, so this expires
     * the entry outright and the next request blocks on a fresh read.
     *
     * `updateTag` would be the idiomatic read-your-writes call, but the docs are
     * explicit that it "can only be called from within Server Actions" — this is
     * a Route Handler.
     */
    revalidateTag(SETTINGS_CACHE_TAG, { expire: 0 })
    return NextResponse.json({ settings })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
