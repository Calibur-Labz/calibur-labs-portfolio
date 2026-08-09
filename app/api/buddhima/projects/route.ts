import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse, ensureSchema, sql, type Project } from '@/lib/db'
import { getSession } from '@/lib/require-auth'

const STATUSES = ['active', 'completed', 'on-hold']

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await ensureSchema()
    const projects = (await sql`
      SELECT id, name, client, status, budget, notes, created_at
      FROM projects
      ORDER BY created_at DESC
    `) as Project[]
    return NextResponse.json({ projects })
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
    return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
  }
  const client = body.client ? String(body.client).trim() : null
  const status = STATUSES.includes(String(body.status)) ? String(body.status) : 'active'
  const budget = body.budget === '' || body.budget == null ? null : Number(body.budget)
  const notes = body.notes ? String(body.notes).trim() : null

  if (budget != null && !Number.isFinite(budget)) {
    return NextResponse.json({ error: 'Budget must be a number' }, { status: 400 })
  }

  try {
    await ensureSchema()
    const [project] = (await sql`
      INSERT INTO projects (name, client, status, budget, notes)
      VALUES (${name}, ${client}, ${status}, ${budget}, ${notes})
      RETURNING id, name, client, status, budget, notes, created_at
    `) as Project[]
    return NextResponse.json({ project }, { status: 201 })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
