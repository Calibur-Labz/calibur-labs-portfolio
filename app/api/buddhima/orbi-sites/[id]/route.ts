import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse } from '@/lib/db'
import { getSession } from '@/lib/require-auth'
import { validateSiteInput, withEmbedCode } from '@/lib/orbi/orbiSites'
import { deleteSite, updateSite } from '@/lib/orbi/orbiSitesDb'

/**
 * Edit a site. Partial: send only what changes — `{ status: 'disabled' }` is
 * how a site is switched off, and the next authorization check refuses it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const changes = validateSiteInput(body, true)
  if (!changes.ok) {
    return NextResponse.json({ error: changes.error }, { status: 400 })
  }

  try {
    const site = await updateSite(id, changes.value)
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }
    return NextResponse.json({ site: withEmbedCode(site) })
  } catch (e) {
    return dbErrorResponse(e)
  }
}

/** Deleting is final: the site's embed stops on its next load, like disabling. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    if (!(await deleteSite(id))) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
