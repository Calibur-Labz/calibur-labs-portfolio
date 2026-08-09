import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse, ensureSchema, sql, type Transaction } from '@/lib/db'
import { getSession } from '@/lib/require-auth'
import { normalizeCurrency } from '@/lib/currency'

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await ensureSchema()
    const transactions = (await sql`
      SELECT id, kind, amount, currency, category, note, project_id, occurred_on::text AS occurred_on, created_at
      FROM transactions
      ORDER BY occurred_on DESC, id DESC
    `) as Transaction[]
    return NextResponse.json({ transactions })
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
  if (kind !== 'income' && kind !== 'expense') {
    return NextResponse.json({ error: "kind must be 'income' or 'expense'" }, { status: 400 })
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
  }

  const currency = normalizeCurrency(body.currency)
  const category = body.category ? String(body.category).trim() : null
  const note = body.note ? String(body.note).trim() : null
  const projectId =
    body.project_id === '' || body.project_id == null ? null : Number(body.project_id)
  const occurredOn = body.occurred_on ? String(body.occurred_on) : null // 'YYYY-MM-DD'

  if (projectId != null && !Number.isInteger(projectId)) {
    return NextResponse.json({ error: 'Invalid project_id' }, { status: 400 })
  }

  try {
    await ensureSchema()
    const [transaction] = (await sql`
      INSERT INTO transactions (kind, amount, currency, category, note, project_id, occurred_on)
      VALUES (
        ${kind}, ${amount}, ${currency}, ${category}, ${note}, ${projectId},
        COALESCE(${occurredOn}::date, CURRENT_DATE)
      )
      RETURNING id, kind, amount, currency, category, note, project_id, occurred_on::text AS occurred_on, created_at
    `) as Transaction[]
    return NextResponse.json({ transaction }, { status: 201 })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
