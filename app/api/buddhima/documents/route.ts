import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { dbErrorResponse, ensureSchema, sql, type Document } from '@/lib/db'
import { parseDocumentFields } from '@/lib/documents'
import { getSession } from '@/lib/require-auth'
import { hasBlobToken } from '@/lib/blob'

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await ensureSchema()
    const documents = (await sql`
      SELECT id, title, kind, project_id, client, amount, currency,
        issued_on::text AS issued_on, status, notes,
        file_name, file_pathname, file_url, file_size::int AS file_size, file_type, created_at
      FROM documents
      ORDER BY COALESCE(issued_on, created_at::date) DESC, id DESC
    `) as Document[]
    return NextResponse.json({ documents })
  } catch (e) {
    return dbErrorResponse(e)
  }
}

/**
 * Records a document whose file the browser has already pushed to Blob. If the
 * row cannot be written the orphaned blob is removed, so a failed save never
 * leaves a file behind that nothing points at.
 */
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

  const fields = parseDocumentFields(body)
  if ('error' in fields) {
    return NextResponse.json({ error: fields.error }, { status: 400 })
  }

  const fileName = String(body.file_name ?? '').trim()
  const filePathname = String(body.file_pathname ?? '').trim()
  const fileUrl = String(body.file_url ?? '').trim()
  if (!fileName || !filePathname || !fileUrl) {
    return NextResponse.json({ error: 'A file is required' }, { status: 400 })
  }
  const fileSize = body.file_size == null ? null : Number(body.file_size)
  const fileType = body.file_type ? String(body.file_type) : null

  try {
    await ensureSchema()
    const [item] = (await sql`
      INSERT INTO documents (
        title, kind, project_id, client, amount, currency, issued_on, status, notes,
        file_name, file_pathname, file_url, file_size, file_type
      )
      VALUES (
        ${fields.title}, ${fields.kind}, ${fields.projectId}, ${fields.client},
        ${fields.amount}, ${fields.currency}, ${fields.issuedOn}::date, ${fields.status}, ${fields.notes},
        ${fileName}, ${filePathname}, ${fileUrl}, ${fileSize}, ${fileType}
      )
      RETURNING id, title, kind, project_id, client, amount, currency,
        issued_on::text AS issued_on, status, notes,
        file_name, file_pathname, file_url, file_size::int AS file_size, file_type, created_at
    `) as Document[]
    return NextResponse.json({ item }, { status: 201 })
  } catch (e) {
    // Don't leave the uploaded file stranded in the store.
    if (hasBlobToken()) await del(filePathname).catch(() => {})
    return dbErrorResponse(e)
  }
}
