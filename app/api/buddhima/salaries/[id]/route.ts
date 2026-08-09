import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse, ensureSchema, sql, type Salary } from '@/lib/db'
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

  const memberId = body.member_id === '' || body.member_id == null ? null : Number(body.member_id)
  const projectId =
    body.project_id === '' || body.project_id == null ? null : Number(body.project_id)
  const amount = Number(body.amount)
  const currency = normalizeCurrency(body.currency)
  const paidOn = body.paid_on ? String(body.paid_on) : null
  const note = body.note ? String(body.note).trim() : null

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
  }
  if (memberId != null && !Number.isInteger(memberId)) {
    return NextResponse.json({ error: 'Invalid member_id' }, { status: 400 })
  }
  if (projectId != null && !Number.isInteger(projectId)) {
    return NextResponse.json({ error: 'Invalid project_id' }, { status: 400 })
  }

  try {
    await ensureSchema()
    const [salary] = (await sql`
      UPDATE salaries
      SET member_id = ${memberId}, project_id = ${projectId}, amount = ${amount},
          currency = ${currency}, paid_on = COALESCE(${paidOn}::date, paid_on), note = ${note}
      WHERE id = ${id}
      RETURNING id, member_id, project_id, amount, currency,
        paid_on::text AS paid_on, note, created_at
    `) as Salary[]

    if (!salary) {
      return NextResponse.json({ error: 'Salary record not found' }, { status: 404 })
    }
    return NextResponse.json({ salary })
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
    const rows = (await sql`DELETE FROM salaries WHERE id = ${id} RETURNING id`) as { id: number }[]
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Salary record not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
