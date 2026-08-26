import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse, ensureSchema, sql, type ContactMessage } from '@/lib/db'
import { getSession } from '@/lib/require-auth'

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await ensureSchema()
    const messages = (await sql`
      SELECT id, name, email, company, phone, package, message, status, read_at, created_at
      FROM contact_messages
      ORDER BY created_at DESC
      LIMIT 500
    `) as ContactMessage[]
    const unread = messages.filter((m) => m.status === 'new').length
    return NextResponse.json({ messages, unread })
  } catch (e) {
    return dbErrorResponse(e)
  }
}

/** Bulk action: `{ action: 'read-all' }` clears the notification badge. */
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

  if (body.action !== 'read-all') {
    return NextResponse.json({ error: "action must be 'read-all'" }, { status: 400 })
  }

  try {
    await ensureSchema()
    const rows = (await sql`
      UPDATE contact_messages
      SET status = 'read', read_at = now()
      WHERE status = 'new'
      RETURNING id
    `) as { id: number }[]
    return NextResponse.json({ success: true, updated: rows.length })
  } catch (e) {
    return dbErrorResponse(e)
  }
}

/**
 * Bulk delete. Two actions:
 *   `{ action: 'delete-read' }`            — everything already read
 *   `{ action: 'delete-ids', ids: [1,2] }` — the rows the operator ticked
 *
 * Scoped to `status = 'read'` on purpose. Unread messages have not been seen
 * yet, and archived ones were filed deliberately — sweeping either away from a
 * button labelled "delete read" would destroy work nobody asked to lose.
 */
export async function DELETE(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const action = body.action

  if (action !== 'delete-read' && action !== 'delete-ids') {
    return NextResponse.json(
      { error: "action must be 'delete-read' or 'delete-ids'" },
      { status: 400 },
    )
  }

  // Ids come from the browser, so nothing is trusted: keep the integers and
  // drop everything else rather than letting a stray value reach the query.
  let ids: number[] = []
  if (action === 'delete-ids') {
    if (!Array.isArray(body.ids)) {
      return NextResponse.json({ error: 'ids must be an array' }, { status: 400 })
    }
    ids = body.ids.map(Number).filter(Number.isInteger)
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No valid ids given' }, { status: 400 })
    }
    // A cap, so one request cannot be turned into an unbounded statement.
    if (ids.length > 500) {
      return NextResponse.json({ error: 'Too many ids in one request' }, { status: 400 })
    }
  }

  try {
    await ensureSchema()
    const rows = (
      action === 'delete-read'
        ? await sql`DELETE FROM contact_messages WHERE status = 'read' RETURNING id`
        : await sql`DELETE FROM contact_messages WHERE id = ANY(${ids}) RETURNING id`
    ) as { id: number }[]
    return NextResponse.json({ success: true, deleted: rows.length })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
