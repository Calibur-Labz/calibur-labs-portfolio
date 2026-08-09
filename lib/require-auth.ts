import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySessionToken } from './auth'

/**
 * Read and verify the session from the request cookies. Returns the admin
 * email when authenticated, or null otherwise.
 *
 * Route handlers verify auth themselves (defence in depth) rather than
 * relying solely on `proxy.ts` — see the Next.js data-security guidance.
 */
export async function getSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const payload = await verifySessionToken(token)
  return payload ? { email: payload.sub } : null
}
