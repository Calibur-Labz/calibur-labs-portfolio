import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse, ensureSchema, sql, type TeamMember } from '@/lib/db'
import { getSession } from '@/lib/require-auth'

const STATUSES = ['active', 'inactive']

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await ensureSchema()
    const team = (await sql`
      SELECT id, name, role, email, phone, status, notes, created_at
      FROM team_members
      ORDER BY name ASC
    `) as TeamMember[]
    return NextResponse.json({ team })
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

  const name = String(body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  const role = body.role ? String(body.role).trim() : null
  const email = body.email ? String(body.email).trim() : null
  const phone = body.phone ? String(body.phone).trim() : null
  const status = STATUSES.includes(String(body.status)) ? String(body.status) : 'active'
  const notes = body.notes ? String(body.notes).trim() : null

  try {
    await ensureSchema()
    const [member] = (await sql`
      INSERT INTO team_members (name, role, email, phone, status, notes)
      VALUES (${name}, ${role}, ${email}, ${phone}, ${status}, ${notes})
      RETURNING id, name, role, email, phone, status, notes, created_at
    `) as TeamMember[]
    return NextResponse.json({ member }, { status: 201 })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
