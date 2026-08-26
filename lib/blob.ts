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

/**
 * Why file storage will not work, in a sentence an operator can act on — or
 * `null` when it looks fine.
 *
 * The shape check matters more than it looks. A read/write token is
 * `vercel_blob_rw_<storeId>_<secret>`, and the SDK pulls the store id out by
 * splitting on underscores. Give it anything else — a truncated paste, a
 * read-only token, the value from a different project — and it throws
 * "Invalid BLOB_READ_WRITE_TOKEN" from deep inside token generation. That
 * surfaces as a 502 that says "File storage error", which reads like the
 * service is down rather than like the variable is wrong.
 *
 * Checking the shape here turns a confusing outage into a one-line fix. The
 * token itself is never returned, logged, or included in the message.
 */
export function blobTokenProblem(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) {
    return 'File storage is not configured. Create a Blob store in the Vercel project (Storage → Blob) and add BLOB_READ_WRITE_TOKEN to the environment.'
  }
  // `vercel_blob_rw_<storeId>_<secret>` — four segments, and a store id.
  const segments = token.split('_')
  if (!token.startsWith('vercel_blob_rw_') || segments.length < 5 || !segments[3]) {
    return 'BLOB_READ_WRITE_TOKEN is set but is not a valid Blob read/write token. Copy it again from the Vercel project (Storage → Blob → .env.local), making sure it is the full value and starts with "vercel_blob_rw_".'
  }
  return null
}

/** The same 503 everywhere, so the console can explain the one-time setup. */
export function blobNotConfigured(message?: string): NextResponse {
  return NextResponse.json(
    {
      error:
        message ??
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
