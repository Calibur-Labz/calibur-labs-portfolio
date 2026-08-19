import { NextResponse } from 'next/server'

/**
 * File types the console accepts for documents, and the ceiling on one upload.
 * Kept deliberately narrow — this is a document cabinet, not a media library.
 */
export const DOCUMENT_CONTENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/rtf',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/zip',
]

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024 // 25 MB

/** True once a Blob store is wired up (Vercel sets this automatically). */
export function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/** The same 503 everywhere, so the console can explain the one-time setup. */
export function blobNotConfigured(): NextResponse {
  return NextResponse.json(
    {
      error:
        'File storage is not configured. Create a Blob store in the Vercel project (Storage → Blob) and add BLOB_READ_WRITE_TOKEN to the environment.',
    },
    { status: 503 }
  )
}

/** Turn a blob/network failure into JSON instead of an unhandled 500 page. */
export function blobErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'File storage error'
  console.error('[blob]', message)
  return NextResponse.json({ error: `File storage error: ${message}` }, { status: 502 })
}
