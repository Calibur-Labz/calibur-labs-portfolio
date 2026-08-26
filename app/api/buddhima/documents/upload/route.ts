import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getSession } from '@/lib/require-auth'
import {
  DOCUMENT_CONTENT_TYPES,
  MAX_DOCUMENT_BYTES,
  blobErrorResponse,
  blobNotConfigured,
  blobTokenProblem,
} from '@/lib/blob'

/**
 * Issues short-lived upload tokens so the browser can send the file straight
 * to Vercel Blob. Going through this route instead of posting the bytes to the
 * server keeps uploads clear of the 4.5 MB serverless request-body ceiling.
 *
 * No `onUploadCompleted` on purpose: the row is written by the client once
 * `upload()` resolves, which also means this works on localhost, where Vercel
 * could not call a completion webhook back.
 */
export async function POST(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Checked for shape, not just presence: a malformed token otherwise fails
  // later as an opaque 502 from inside the SDK.
  const tokenProblem = blobTokenProblem()
  if (tokenProblem) {
    return blobNotConfigured(tokenProblem)
  }

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        // The token is scoped to one pathname; refuse anything outside the
        // documents/ prefix so a token can never overwrite something else.
        if (!pathname.startsWith('documents/')) {
          throw new Error('Uploads must be filed under documents/')
        }
        return {
          allowedContentTypes: DOCUMENT_CONTENT_TYPES,
          maximumSizeInBytes: MAX_DOCUMENT_BYTES,
          addRandomSuffix: true,
        }
      },
    })
    return NextResponse.json(result)
  } catch (e) {
    return blobErrorResponse(e)
  }
}
