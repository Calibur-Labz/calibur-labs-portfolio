import { NextRequest, NextResponse } from 'next/server'
import { dbErrorResponse, ensureSchema, sql, type Project } from '@/lib/db'
import { getSession } from '@/lib/require-auth'

const STATUSES = ['active', 'completed', 'on-hold']

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
      UPDATE projects
      SET name = ${name}, client = ${client}, status = ${status},
          budget = ${budget}, notes = ${notes}
      WHERE id = ${id}
      RETURNING id, name, client, status, budget, notes, created_at
    `) as Project[]

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    return NextResponse.json({ project })
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
    const rows = (await sql`DELETE FROM projects WHERE id = ${id} RETURNING id`) as { id: number }[]
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
