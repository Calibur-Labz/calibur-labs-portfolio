import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse, ensureSchema, sql, type Infra } from '@/lib/db'
import { getSession } from '@/lib/require-auth'
import { normalizeCurrency } from '@/lib/currency'

const STATUSES = ['active', 'expired', 'cancelled']

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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const kind = String(body.kind ?? '')
  if (kind !== 'domain' && kind !== 'hosting') {
    return NextResponse.json({ error: "kind must be 'domain' or 'hosting'" }, { status: 400 })
  }
  const name = String(body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  const provider = body.provider ? String(body.provider).trim() : null
  const projectId =
    body.project_id === '' || body.project_id == null ? null : Number(body.project_id)
  const cost = body.cost === '' || body.cost == null ? null : Number(body.cost)
  const currency = normalizeCurrency(body.currency)
  const renewsOn = body.renews_on ? String(body.renews_on) : null
  const status = STATUSES.includes(String(body.status)) ? String(body.status) : 'active'
  const notes = body.notes ? String(body.notes).trim() : null

  if (projectId != null && !Number.isInteger(projectId)) {
    return NextResponse.json({ error: 'Invalid project_id' }, { status: 400 })
  }
  if (cost != null && !Number.isFinite(cost)) {
    return NextResponse.json({ error: 'Cost must be a number' }, { status: 400 })
  }

  try {
    await ensureSchema()
    const [item] = (await sql`
      UPDATE infra
      SET kind = ${kind}, name = ${name}, provider = ${provider}, project_id = ${projectId},
          cost = ${cost}, currency = ${currency},
          renews_on = ${renewsOn}::date, status = ${status}, notes = ${notes}
      WHERE id = ${id}
      RETURNING id, kind, name, provider, project_id, cost, currency,
        renews_on::text AS renews_on, status, notes, created_at
    `) as Infra[]

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    return NextResponse.json({ item })
  } catch (e) {
    return dbErrorResponse(e)
  }
}

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
    await ensureSchema()
    const rows = (await sql`DELETE FROM infra WHERE id = ${id} RETURNING id`) as { id: number }[]
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
