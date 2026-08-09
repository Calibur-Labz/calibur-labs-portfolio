import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse, ensureSchema, sql, type Infra } from '@/lib/db'
import { getSession } from '@/lib/require-auth'
import { normalizeCurrency } from '@/lib/currency'

const STATUSES = ['active', 'expired', 'cancelled']

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await ensureSchema()
    const infra = (await sql`
      SELECT id, kind, name, provider, project_id, cost, currency,
        renews_on::text AS renews_on, status, notes, created_at
      FROM infra
      ORDER BY renews_on ASC NULLS LAST, created_at DESC
    `) as Infra[]
    return NextResponse.json({ infra })
  } catch (e) {
    return dbErrorResponse(e)
  }
}

export async function POST(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      INSERT INTO infra (kind, name, provider, project_id, cost, currency, renews_on, status, notes)
      VALUES (
        ${kind}, ${name}, ${provider}, ${projectId}, ${cost}, ${currency},
        ${renewsOn}::date, ${status}, ${notes}
      )
      RETURNING id, kind, name, provider, project_id, cost, currency,
        renews_on::text AS renews_on, status, notes, created_at
    `) as Infra[]
    return NextResponse.json({ item }, { status: 201 })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
