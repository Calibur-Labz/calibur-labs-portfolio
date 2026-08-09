import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse, ensureSchema, sql, type Transaction } from '@/lib/db'
import { getSession } from '@/lib/require-auth'
import { normalizeCurrency } from '@/lib/currency'

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
  const occurredOn = body.occurred_on ? String(body.occurred_on) : null

  if (projectId != null && !Number.isInteger(projectId)) {
    return NextResponse.json({ error: 'Invalid project_id' }, { status: 400 })
  }

  try {
    await ensureSchema()
    const [transaction] = (await sql`
      UPDATE transactions
      SET kind = ${kind}, amount = ${amount}, currency = ${currency},
          category = ${category}, note = ${note}, project_id = ${projectId},
          occurred_on = COALESCE(${occurredOn}::date, occurred_on)
      WHERE id = ${id}
      RETURNING id, kind, amount, currency, category, note, project_id, occurred_on::text AS occurred_on, created_at
    `) as Transaction[]

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }
    return NextResponse.json({ transaction })
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
    const rows = (await sql`DELETE FROM transactions WHERE id = ${id} RETURNING id`) as {
      id: number
    }[]
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
