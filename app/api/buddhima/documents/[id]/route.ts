import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { dbErrorResponse, ensureSchema, sql, type Document } from '@/lib/db'
import { parseDocumentFields } from '@/lib/documents'
import { getSession } from '@/lib/require-auth'
import { hasBlobToken } from '@/lib/blob'

/**
 * Updates a document's metadata, and optionally swaps in a newly uploaded
 * file — handy for keeping a quotation or invoice template current without
 * losing its place in the cabinet. The replaced blob is deleted afterwards.
 */
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

  const fields = parseDocumentFields(body)
  if ('error' in fields) {
    return NextResponse.json({ error: fields.error }, { status: 400 })
  }

  // Present only when the browser uploaded a replacement file.
  const newFile =
    body.file_pathname && body.file_url && body.file_name
      ? {
          name: String(body.file_name),
          pathname: String(body.file_pathname),
          url: String(body.file_url),
          size: body.file_size == null ? null : Number(body.file_size),
          type: body.file_type ? String(body.file_type) : null,
        }
      : null

  try {
    await ensureSchema()
    const [existing] = (await sql`
      SELECT file_pathname FROM documents WHERE id = ${id}
    `) as { file_pathname: string }[]
    if (!existing) {
      if (newFile && hasBlobToken()) await del(newFile.pathname).catch(() => {})
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const [item] = (await sql`
      UPDATE documents
      SET title = ${fields.title}, kind = ${fields.kind}, project_id = ${fields.projectId},
          client = ${fields.client}, amount = ${fields.amount}, currency = ${fields.currency},
          issued_on = ${fields.issuedOn}::date, status = ${fields.status}, notes = ${fields.notes},
          file_name = COALESCE(${newFile?.name ?? null}, file_name),
          file_pathname = COALESCE(${newFile?.pathname ?? null}, file_pathname),
          file_url = COALESCE(${newFile?.url ?? null}, file_url),
          file_size = COALESCE(${newFile?.size ?? null}, file_size),
          file_type = COALESCE(${newFile?.type ?? null}, file_type)
      WHERE id = ${id}
      RETURNING id, title, kind, project_id, client, amount, currency,
        issued_on::text AS issued_on, status, notes,
        file_name, file_pathname, file_url, file_size::int AS file_size, file_type, created_at
    `) as Document[]

    // Only now that the row points at the new file is the old one expendable.
    if (newFile && newFile.pathname !== existing.file_pathname && hasBlobToken()) {
      await del(existing.file_pathname).catch(() => {})
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
      DELETE FROM documents WHERE id = ${id} RETURNING file_pathname
    `) as { file_pathname: string }[]
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    // A leftover blob is untidy but harmless; a failed delete here must not
    // resurrect a row the admin already removed.
    if (hasBlobToken()) await del(rows[0].file_pathname).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (e) {
    return dbErrorResponse(e)
  }
}
