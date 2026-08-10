import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse, ensureSchema, sql, type TeamMember } from '@/lib/db'
import { getSession } from '@/lib/require-auth'

const STATUSES = ['active', 'inactive']

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

  const name = String(body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  const role = body.role ? String(body.role).trim() : null
  const email = body.email ? String(body.email).trim() : null
  const phone = body.phone ? String(body.phone).trim() : null
  const status = STATUSES.includes(String(body.status)) ? String(body.status) : 'active'
  const bankName = body.bank_name ? String(body.bank_name).trim() : null
  const accountName = body.account_name ? String(body.account_name).trim() : null
  const accountNumber = body.account_number ? String(body.account_number).trim() : null
  const branch = body.branch ? String(body.branch).trim() : null
  const notes = body.notes ? String(body.notes).trim() : null

  try {
    await ensureSchema()
    const [member] = (await sql`
      UPDATE team_members
      SET name = ${name}, role = ${role}, email = ${email}, phone = ${phone},
          status = ${status}, bank_name = ${bankName}, account_name = ${accountName},
          account_number = ${accountNumber}, branch = ${branch}, notes = ${notes}
      WHERE id = ${id}
      RETURNING id, name, role, email, phone, status,
        bank_name, account_name, account_number, branch, notes, created_at
    `) as TeamMember[]

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    return NextResponse.json({ member })
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
    const rows = (await sql`DELETE FROM team_members WHERE id = ${id} RETURNING id`) as {
      id: number
    }[]
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
