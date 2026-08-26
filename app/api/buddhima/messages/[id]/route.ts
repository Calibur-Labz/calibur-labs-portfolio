import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse, ensureSchema, sql, type ContactMessage } from '@/lib/db'
import { getSession } from '@/lib/require-auth'

const STATUSES = ['new', 'read', 'archived'] as const

/** Change one message's status — used to mark read on open, or to archive. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const status = String(body.status ?? '')
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return NextResponse.json({ error: "status must be 'new', 'read' or 'archived'" }, { status: 400 })
  }
  // Re-flagging as unread clears the timestamp so the badge is honest again.
  const readAt = status === 'new' ? null : new Date().toISOString()

  try {
    await ensureSchema()
    const [item] = (await sql`
      UPDATE contact_messages
      SET status = ${status}, read_at = ${readAt}
      WHERE id = ${id}
      RETURNING id, name, email, company, phone, package, message, status, read_at, created_at
    `) as ContactMessage[]

    if (!item) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    return NextResponse.json({ item })
  } catch (e) {
    return dbErrorResponse(e)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    await ensureSchema()
    const rows = (await sql`
      DELETE FROM contact_messages WHERE id = ${id} RETURNING id
    `) as { id: number }[]
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
