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
      SELECT id, name, email, company, message, status, read_at, created_at
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
