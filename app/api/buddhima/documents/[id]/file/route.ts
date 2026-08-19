import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { dbErrorResponse, ensureSchema, sql } from '@/lib/db'
import { getSession } from '@/lib/require-auth'
import { blobErrorResponse, blobNotConfigured, hasBlobToken } from '@/lib/blob'

type Row = { file_pathname: string; file_name: string; file_type: string | null }

/**
 * Streams a document's file back to the signed-in admin.
 *
 * Blobs are stored privately, so there is no public URL to hand out — every
 * read passes through here and through the session check. `?inline=1` renders
 * in the browser (PDF preview); the default forces a download.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!hasBlobToken()) {
    return blobNotConfigured()
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  let row: Row | undefined
  try {
    await ensureSchema()
    ;[row] = (await sql`
      SELECT file_pathname, file_name, file_type FROM documents WHERE id = ${id}
    `) as Row[]
  } catch (e) {
    return dbErrorResponse(e)
  }
  if (!row) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    const result = await get(row.file_pathname, { access: 'private' })
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: 'File is missing from storage' }, { status: 404 })
    }

    const inline = request.nextUrl.searchParams.get('inline') === '1'
    // Quote-safe ASCII name plus the RFC 5987 form for everything else.
    const ascii = row.file_name.replace(/["\\]/g, '').replace(/[^\x20-\x7E]/g, '_')
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType || row.file_type || 'application/octet-stream',
        'Content-Length': String(result.blob.size),
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
        // Private material — never let a shared cache hold on to it.
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return blobErrorResponse(e)
  }
}
