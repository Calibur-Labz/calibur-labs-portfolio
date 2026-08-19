import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse, ensureSchema, sql } from '@/lib/db'

/** Trim, collapse the empties to null, and cap length so one paste can't fill a column. */
function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const name = clean(body.name, 120)
  const email = clean(body.email, 200)
  const company = clean(body.company, 160) || null
  const message = clean(body.message, 5000)

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  // Loose on purpose — the browser already validated, this only blocks junk.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  try {
    await ensureSchema()
    // Lands as 'new', which is what lights up the bell in /buddhima.
    await sql`
      INSERT INTO contact_messages (name, email, company, message)
      VALUES (${name}, ${email}, ${company}, ${message})
    `
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
