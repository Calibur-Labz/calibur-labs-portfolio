import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse } from '@/lib/db'
import { getSession } from '@/lib/require-auth'
import { getSiteSettings, setSiteSettings } from '@/lib/settings'

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
    return NextResponse.json({ settings })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
