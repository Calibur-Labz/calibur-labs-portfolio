import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifyCredentials,
} from '@/lib/auth'
import { callerKey } from '@/lib/orbi/orbiRateLimit'
import { createRateLimiter } from '@/lib/rateLimit'

/**
 * Brute-force brake: ten attempts per address per fifteen minutes, counted
 * whether they succeed or not. A person who mistypes a few times never meets
 * it; a script guessing passwords meets it on its eleventh try.
 */
const attempts = createRateLimiter({ windowMs: 15 * 60_000, max: 10 })

export async function POST(request: NextRequest) {
  const verdict = attempts.check(callerKey(request.headers))
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'retry-after': String(verdict.retryAfter) } }
    )
  }

  let email = ''
  let password = ''
  try {
    const body = await request.json()
    email = String(body.email ?? '')
    password = String(body.password ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  if (!verifyCredentials(email, password)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const token = await createSessionToken(email.trim().toLowerCase())
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
  return response
}
