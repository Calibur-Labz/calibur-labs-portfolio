import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse } from '@/lib/db'
import { getSession } from '@/lib/require-auth'
import { validateSiteInput, withEmbedCode } from '@/lib/orbi/orbiSites'
import { createSite, listSites } from '@/lib/orbi/orbiSitesDb'

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const sites = await listSites()
    return NextResponse.json({ sites: sites.map(withEmbedCode) })
  } catch (e) {
    return dbErrorResponse(e)
  }
}

export async function POST(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const input = validateSiteInput(body)
  if (!input.ok) {
    return NextResponse.json({ error: input.error }, { status: 400 })
  }

  try {
    const site = await createSite(input.value)
    return NextResponse.json({ site: withEmbedCode(site) }, { status: 201 })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
